(async function () {
  const DEBUG = false;
  if (DEBUG) console.log("Flow History Extension: Starting...");

  // GUID validation regex
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // 1. Check for Xrm Object
  if (typeof Xrm === "undefined" || !Xrm.Page || !Xrm.Page.data) {
    alert("Flow History: Xrm object not found. Please open a Dynamics 365 record.");
    return;
  }

  let entityName = "";
  let recordId = "";
  let envId = "";
  let entitySetName = "";

  async function loadContext() {
    if (!Xrm.Page || !Xrm.Page.data || !Xrm.Page.data.entity) {
      entityName = "";
      recordId = "";
      return false;
    }

    const newEntity = Xrm.Page.data.entity.getEntityName();
    const newId = Xrm.Page.data.entity.getId()?.replace(/[{}]/g, "").toLowerCase();

    if (!newEntity || !newId) {
      entityName = "";
      recordId = "";
      return false;
    }

    entityName = newEntity;
    recordId = newId;

    // ... (Env ID logic remains) ...
    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const orgSettings = globalContext.organizationSettings;
      envId = orgSettings?.bapEnvironmentId || orgSettings?.organizationId || "";
    } catch (e) { 
      if (DEBUG) console.error("Error getting env ID:", e); 
    }

    entitySetName = entityName + "s";
    try {
      const meta = await Xrm.Utility.getEntityMetadata(entityName, ["EntitySetName"]);
      entitySetName = meta.EntitySetName;
    } catch (e) { }

    if (DEBUG) console.log(`Flow History: Context Updated - Entity: ${entityName}, ID: ${recordId}`);
    return true;
  }

  // --- Helpers ---
  const safeJson = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
  const toCols = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const statusLbl = (wf) => (wf.statecode === 1 ? "Active" : wf.statecode === 0 ? "Draft" : `Unknown (${wf.statecode})`);
  const stripBraces = (id) => String(id || "").replace(/[{}]/g, "");

  const buildRunsUrl = (envGuid, flowIdMaker) =>
    envGuid && flowIdMaker
      ? `https://make.powerautomate.com/environments/${encodeURIComponent(envGuid)}/solutions/~preferred/flows/${flowIdMaker}/runs`
      : "";

  // Helper to identify Microsoft system flows
  const isSystemFlow = (flow) => {
    if (!flow.ismanaged) return false;

    const name = (flow.name || "");
    const nameLower = name.toLowerCase();

    // Microsoft system flows have these patterns:
    // 1. Start with [Flow] prefix
    // 2. Contain "Microsoft Copilot Studio" or similar Microsoft product names
    const isSystem =
      name.startsWith("[Flow]") ||
      nameLower.includes("microsoft copilot studio") ||
      nameLower.includes("microsoft dataverse") ||
      nameLower.startsWith("microsoft") ||
      nameLower.startsWith("dynamics") ||
      nameLower.startsWith("system") ||
      nameLower.startsWith("default");

    return isSystem;
  };

  function decodeChangeType(message) {
    let added = false, modified = false, deleted = false;
    if (typeof message === "number") {
      added = (message & 1) === 1;
      modified = (message & 2) === 2;
      deleted = (message & 4) === 4;
    } else {
      const s = String(message ?? "").toLowerCase();
      added = /(^|\b)(add|create)(ed)?(\b|$)/.test(s);
      modified = /\b(modif|updat)(e|ed|es)?\b/.test(s);
      deleted = /\bdelet(e|ed|es)?\b/.test(s);
    }
    const parts = [];
    if (added) parts.push("Added");
    if (modified) parts.push("Modified");
    if (deleted) parts.push("Deleted");
    return { label: parts.length ? parts.join(" or ") : "Unknown", added, modified, deleted };
  }

  // --- Action Walkers ---
  const isDataverseAction = (n) =>
    n?.type === "OpenApiConnection" &&
    (n?.inputs?.host?.apiId?.includes("shared_commondataserviceforapps") ||
      (n?.inputs?.host?.connectionName || "").includes("shared_commondataserviceforapps"));

  const opIdOf = (n) => (n?.inputs?.host?.operationId || "");
  const entityOf = (n) => n?.inputs?.parameters?.entityName;
  const isUpdateOpId = (id) => /^Update/i.test(id) || /Upsert/i.test(id);
  const isRetrieveOpId = (id) => /(GetItem|GetRecord|Retrieve)/i.test(id) || /(ListRecords|ListRows)/i.test(id);
  const getUpdatedFields = (n) => Object.keys(n?.inputs?.parameters || {}).filter(k => k.startsWith("item/")).map(k => k.slice(5));

  function walkActions(actionsRoot, visitor) {
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      visitor(node);
      if (node.actions && typeof node.actions === "object") Object.values(node.actions).forEach(walk);
      if (node.cases && typeof node.cases === "object") Object.values(node.cases).forEach(walk);
      if (Array.isArray(node.branches)) node.branches.forEach(walk);
      if (node.else && typeof node.else === "object") walk(node.else);
      if (node.default && typeof node.default === "object") walk(node.default);
      for (const [k, v] of Object.entries(node)) {
        if (["inputs", "host", "parameters", "metadata"].includes(k)) continue;
        if (v && typeof v === "object") walk(v);
      }
    };
    walk({ actions: actionsRoot });
  }

  // --- Scanners ---
  async function fetchCloudFlows() {
    const SELECT = "$select=name,workflowid,workflowidunique,clientdata,statecode,statuscode,modifiedon,category,ismanaged";
    const FILTER = "$filter=category eq 5";
    const TOP = "$top=500";
    let next = `?${SELECT}&${FILTER}&${TOP}&$orderby=modifiedon desc`;
    const flows = [];
    try {
      do {
        const res = await Xrm.WebApi.retrieveMultipleRecords("workflow", next);
        flows.push(...(res.entities || []));
        next = res.nextLink || null;
      } while (next);
      if (DEBUG) console.log(`Flow History: Fetched ${flows.length} total cloud flows from Dataverse`);
    } catch (e) {
      console.error("Error fetching cloud flows:", e);
      alert(`Error fetching flows: ${e.message}`);
    }
    return flows;
  }

  async function scanTriggers(flows, entityName, envId) {
    const rows = [];
    for (const f of flows) {
      const def = safeJson(f.clientdata)?.properties?.definition;
      if (!def) continue;

      for (const trig of Object.values(def?.triggers || {})) {
        const p = trig?.inputs?.parameters || {};
        const trigEntity = p["subscriptionRequest/entityname"] ?? p.entityname;
        if (!trigEntity || trigEntity.toLowerCase() !== entityName.toLowerCase()) continue;

        const message = p["subscriptionRequest/message"] ?? p["subscriptionRequest/notificationMessage"] ?? p.message;
        const { label } = decodeChangeType(message);
        const flowIdMaker = stripBraces(f.workflowidunique || f.workflowid);

        rows.push({
          name: f.name,
          status: statusLbl(f),
          changeType: label,
          flowIdMaker,
          flowIdAlt: stripBraces(f.workflowid),
          runHistoryUrl: buildRunsUrl(envId, flowIdMaker),
          isSystem: isSystemFlow(f)
        });
      }
    }
    return rows;
  }

  async function scanUpdates(flows, entitySet, envId) {
    const rows = [];
    for (const f of flows) {
      const def = safeJson(f.clientdata)?.properties?.definition;
      if (!def) continue;

      const updates = [];
      walkActions(def.actions, (node) => {
        if (!node.type || !node.inputs) return;
        if (!isDataverseAction(node)) return;
        const op = opIdOf(node);
        const ent = entityOf(node);
        if (!ent || String(ent).toLowerCase() !== String(entitySet).toLowerCase()) return;
        if (!isUpdateOpId(op)) return;
        updates.push({ op, fields: getUpdatedFields(node) });
      });

      if (!updates.length) continue;
      const flowIdMaker = stripBraces(f.workflowidunique || f.workflowid);
      rows.push({
        name: f.name,
        status: statusLbl(f),
        operations: [...new Set(updates.map(u => u.op))].join(", "),
        fields: [...new Set(updates.flatMap(u => u.fields))].join(", ") || "—",
        flowIdMaker,
        flowIdAlt: stripBraces(f.workflowid),
        runHistoryUrl: buildRunsUrl(envId, flowIdMaker),
        isSystem: isSystemFlow(f)
      });
    }
    return rows;
  }

  async function scanRetrieves(flows, entitySet, envId) {
    const rows = [];
    for (const f of flows) {
      const def = safeJson(f.clientdata)?.properties?.definition;
      if (!def) continue;

      const retrieves = [];
      walkActions(def.actions, (node) => {
        if (!node.type || !node.inputs) return;
        if (!isDataverseAction(node)) return;
        const op = opIdOf(node);
        const ent = entityOf(node);
        if (!ent || String(ent).toLowerCase() !== String(entitySet).toLowerCase()) return;
        if (!isRetrieveOpId(op)) return;

        const p = node.inputs.parameters || {};
        retrieves.push({
          op,
          columns: toCols(p["$select"] || p.select || ""),
          filter: p["$filter"] || p.filter || ""
        });
      });

      if (!retrieves.length) continue;
      const flowIdMaker = stripBraces(f.workflowidunique || f.workflowid);
      rows.push({
        name: f.name,
        status: statusLbl(f),
        operations: [...new Set(retrieves.map(r => r.op))].join(", "),
        columns: [...new Set(retrieves.flatMap(r => r.columns))].join(", ") || "—",
        flowIdMaker,
        flowIdAlt: stripBraces(f.workflowid),
        runHistoryUrl: buildRunsUrl(envId, flowIdMaker),
        isSystem: isSystemFlow(f)
      });
    }
    return rows;
  }

  // --- API Helper ---

  // Helper to call background API via injector
  function callBackgroundApi(type, payload, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(7);
      const handler = (event) => {
        if (event.source !== window || event.data.source !== "FLOW_HISTORY_EXTENSION_RESPONSE" || event.data.requestId !== requestId) return;
        window.removeEventListener("message", handler);
        if (event.data.response && event.data.response.ok) resolve(event.data.response.data);
        else reject(event.data.response ? event.data.response.error : "Unknown error");
      };
      window.addEventListener("message", handler);
      window.postMessage({ source: "FLOW_HISTORY_EXTENSION", type: "API_REQUEST", requestId, payload: { type, ...payload } }, "*");
      setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(`Timeout after ${timeoutMs}ms for ${type}`);
      }, timeoutMs);
    });
  }

  // --- Flow Run Functions ---

  // Function 1: List ALL runs for a flow (from Dataverse - unfiltered or filtered by status)
  async function listAllRunsForFlow(idA, idB, statusFilter = null) {
    const top = 50;

    async function _retrieveAll(entityLogicalName, options) {
      try {
        const page = await Xrm.WebApi.retrieveMultipleRecords(entityLogicalName, options);
        return page.entities || [];
      } catch (e) {
        if (DEBUG) console.warn(`Flow History: Dataverse fetch error (${entityLogicalName}):`, e.message);
        return [];
      }
    }

    const query = (id) => {
      let q = `?$filter=workflowid eq '${id}'`;
      if (statusFilter) q += ` and status eq '${statusFilter}'`;
      q += `&$select=status,starttime,endtime,name&$orderby=starttime desc&$top=${top}`;
      return q;
    };

    let runs = [];
    if (idA) runs = await _retrieveAll("flowrun", query(idA));
    if (!runs.length && idB && idB !== idA) runs = await _retrieveAll("flowrun", query(idB));

    if (runs.length > 0) {
      return runs.map(r => ({
        name: r.name,
        status: r.status || "Unknown",
        starttime: r.starttime,
        endtime: r.endtime
      }));
    }
    return [];
  }

  // Function 2: List RECORD-SPECIFIC runs for a flow (Streaming)
  async function listRecordRunsForFlow(idA, idB, options = {}) {
    const { onRunFound, onProgress, shouldStop, filter, onError } = options;
    const top = 250; // Max allowed by API

    // Helper: Check if a run is relevant
    async function isRunRelevant(run, flowId) {
      if (!envId || !run.name) return false;
      try {
        const url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/${envId}/flows/${flowId}/runs/${run.name}?api-version=2016-11-01`;
        const details = await callBackgroundApi("GET_JSON", { url });

        let jsonStr = JSON.stringify(details).toLowerCase();
        const searchId = recordId.toLowerCase().replace(/[{}]/g, "");
        const searchIdNoHyphens = searchId.replace(/-/g, "");
        const primaryAttr = (Xrm.Page.data.entity.getPrimaryAttributeValue() || "").toLowerCase();

        // 1. Check initial details
        if (jsonStr.includes(searchId) || jsonStr.includes(searchIdNoHyphens)) return true;
        if (primaryAttr && primaryAttr.length > 3 && jsonStr.includes(primaryAttr)) return true;

        // 2. Check Trigger Outputs
        const triggerOutputsLink = details?.properties?.trigger?.outputsLink?.uri;
        if (triggerOutputsLink) {
          const triggerOutputs = await callBackgroundApi("GET_JSON", { url: triggerOutputsLink, noAuth: true });
          const triggerJson = JSON.stringify(triggerOutputs).toLowerCase();

          if (triggerJson.includes(searchId) || triggerJson.includes(searchIdNoHyphens)) return true;
          if (primaryAttr && primaryAttr.length > 3 && triggerJson.includes(primaryAttr)) return true;
        }

        return false;
      } catch (e) {
        if (DEBUG) console.warn(`Flow History: Failed to inspect run ${run.name}`, e);
        return false;
      }
    }

    if (!envId) {
      console.error("Environment ID missing");
      return; // Stop
    }

    try {
      const targetId = idA || idB;
      let currentNextLink = null;
      let totalScanned = 0;
      let isLegacy = false;

      do {
        // Check stop signal
        if (shouldStop && shouldStop()) {
          break;
        }

        const responseData = await callBackgroundApi("LIST_RUNS", { envId, makerId: targetId, top, nextLink: currentNextLink, filter });

        let apiRuns = [];
        let newNextLink = null;

        if (Array.isArray(responseData)) {
          apiRuns = responseData;
          isLegacy = true; // Old background script
        } else if (responseData && typeof responseData === "object") {
          apiRuns = responseData.runs || [];
          newNextLink = responseData.nextLink || null;
        }

        // Update progress
        totalScanned += apiRuns.length;
        if (onProgress) onProgress(totalScanned, !!newNextLink);

        // Process batch
        if (apiRuns.length > 0) {
          const checks = apiRuns.map(async (run) => {
            if (await isRunRelevant(run, targetId)) return run;
            return null;
          });

          const results = await Promise.all(checks);
          const found = results.filter(r => r);

          if (found.length > 0 && onRunFound) {
            found.forEach(r => {
              onRunFound({
                name: r.name,
                status: r.properties?.status || r.status,
                starttime: r.properties?.startTime || r.startTime,
                endtime: r.properties?.endTime || r.endTime
              });
            });
          }
        }

        currentNextLink = newNextLink;
        if (isLegacy) break; // Can't page with legacy

      } while (currentNextLink);

    } catch (e) {
      console.error("Flow History: Stream error", e);
      if (onError) onError(e);
    }
  }

  // Keep the old function name for backward compatibility, but use listAllRunsForFlow
  async function listRunsForFlow(idA, idB) {
    return await listAllRunsForFlow(idA, idB);
  }

  // --- UI Setup ---
  const hostId = "flow-history-extension-host";
  let host = document.getElementById(hostId);
  if (host) host.remove();

  host = document.createElement("div");
  host.id = hostId;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.right = "0";
  host.style.height = "100vh";
  host.style.width = "450px";
  host.style.zIndex = "999999";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host { 
        --primary: #0078d4; 
        --primary-dark: #106ebe; 
        --danger: #d13438;
        --danger-light: #a4262c;
        --success: #107c10;
        --text: #323130;
        --text-secondary: #605e5c;
        --border: #e1dfdd;
        --bg-hover: #f3f2f1;
        --shadow: 0 2px 4px rgba(0,0,0,0.1);
        --font: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        
        font-family: var(--font); 
        background: white; 
        box-shadow: -4px 0 16px rgba(0,0,0,0.15); 
        height: 100%; 
    }
    .main-container { display: flex; flex-direction: column; height: 100%; background: #f8f9fa; }
    
    .header { padding: 20px 24px; background: #eff6fc; color: #323130; display: flex; flex-direction: column; gap: 12px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-bottom: 1px solid #c8c6c4; border-top: 4px solid #0078d4; position: relative; }
    .header-top { display: flex; justify-content: center; align-items: center; position: relative; }
    .title-wrapper { display: flex; align-items: center; gap: 10px; }
    .title-icon { width: 24px; height: 24px; fill: none; stroke: #0078d4; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #005a9e; letter-spacing: -0.3px; }
    .close-btn { position: absolute; right: -8px; top: -8px; background: none; border: none; color: #605e5c; font-size: 20px; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s, color 0.2s; }
    .close-btn:hover { background: rgba(255,255,255,0.5); color: #000; }
    
    .context-bar { background: #f3f2f1; border-radius: 6px; padding: 6px 12px; display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 12px; color: #201f1e; border: 1px solid #edebe9; }
    .context-item { display: flex; align-items: center; gap: 6px; }
    .context-label { color: #605e5c; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .context-value { font-weight: 600; color: #201f1e; }
    .context-value.mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; background: white; padding: 1px 5px; border-radius: 4px; border: 1px solid #e1dfdd; color: #004b87; }
    .divider { color: #c8c6c4; }
    
    .tabs { display: flex; background: white; border-bottom: 1px solid var(--border); flex-shrink: 0; padding: 0 16px; gap: 8px; margin-top: 0; }
    .tab { flex: 1; padding: 12px 0; text-align: center; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-secondary); border-bottom: 3px solid transparent; transition: all 0.2s; background: none; }
    .tab:hover { color: var(--primary); background: var(--bg-hover); border-radius: 4px 4px 0 0; }
    .tab.active { border-bottom-color: var(--primary); color: var(--primary); background: none; }
    
    .toolbar { padding: 12px 24px; background: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 12px; }

    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-label { font-size: 12px; color: var(--text); font-weight: 600; }
    .filter-select { font-size: 12px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: white; cursor: pointer; outline: none; }
    .filter-select:focus { border-color: var(--primary); }
    
    .content { flex: 1; overflow-y: auto; padding: 16px; position: relative; min-height: 0; }
    .tab-pane { display: none; animation: fadeIn 0.2s; }
    .tab-pane.active { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    .search-input { width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid var(--border); border-radius: 4px; box-sizing: border-box; transition: border-color 0.2s; }
    .search-input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 2px rgba(0,120,212,0.1); }
    
    .flow-card { background: white; border: 1px solid var(--border); border-radius: 6px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.2s, transform 0.2s; }
    .flow-card:hover { border-color: #c8c6c4; box-shadow: 0 4px 8px rgba(0,0,0,0.08); transform: translateY(-1px); }
    
    .flow-name { font-weight: 600; color: var(--text); margin-bottom: 8px; font-size: 15px; display: flex; align-items: center; justify-content: space-between; }
    .flow-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    
    .pill { background: var(--bg-hover); padding: 3px 8px; border-radius: 12px; border: 1px solid var(--border); font-size: 11px; font-weight: 500; }
    .pill.system { background: #fff4ce; color: #8a6d3b; border-color: #f0e68c; }
    .pill.active-status { background: #e6ffcc; color: #107c10; border-color: #9bdc9b; }
    
    .action-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f2f1; }
    .btn-group { display: flex; gap: 6px; } /* Legacy, can remove if unused */
    .button-container { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 260px; } /* Fixed width grid for consistency */
    
    /* Clean Button Styles */
    .btn { 
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        background: var(--primary); color: white; border: none; padding: 5px 12px; 
        cursor: pointer; border-radius: 4px; font-size: 12px; font-weight: 500;
        transition: background 0.2s, transform 0.1s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        min-width: 110px; /* Ensure consistent width */
    }
    .btn:hover { background: var(--primary-dark); }
    .btn:active { transform: translateY(1px); }
    .btn:disabled { background: #c8c6c4; cursor: not-allowed; opacity: 0.6; }
    
    .btn-success { background: var(--success); }
    .btn-success:hover { background: #0b5a0b; }
    
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #a80000; }
    
    .btn-outline { background: white; border: 1px solid var(--border); color: var(--text); }
    .btn-outline:hover { background: var(--bg-hover); }
    
    .btn-danger-outline { background: white; border: 1px solid var(--danger-light); color: var(--danger-light); }
    .btn-danger-outline:hover { background: #fdf3f3; }
    
    .link { color: var(--primary); text-decoration: none; font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
    .link:hover { text-decoration: underline; }
    
    .run-list { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--border); margin-top: 12px; padding-top: 8px; display: none; max-height: 400px; overflow-y: auto; }
    .run-item { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 12px; border-radius: 4px; transition: background 0.1s; }
    .run-item:hover { background: var(--bg-hover); }
    
    .status-Succeeded { color: var(--success); font-weight: 600; }
    .status-Failed { color: var(--danger); font-weight: 600; }
    .status-Running { color: #d83b01; font-weight: 600; }
    
    .loading { text-align: center; padding: 30px; color: var(--text-secondary); }
    .empty { text-align: center; padding: 30px; color: var(--text-secondary); font-style: italic; background: white; border-radius: 5px; border: 1px dashed var(--border); }

  `;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.className = "main-container";
  container.innerHTML = `
    <div class="header">
      <div class="header-top">
        <div class="title-wrapper">
            <!-- Power Automate Style Icon (Arrow) -->
            <svg class="title-icon" viewBox="0 0 24 24">
                <path d="M2.5,12 L20.5,12 L14,5.5" />
                <path d="M20,12 L14,18.5" />
            </svg>
            <h2>Flow Monitor</h2>
        </div>
        <button class="close-btn" title="Close Extension">&times;</button>
      </div>
      <div class="context-bar">
        <div class="context-item">
            <span class="context-label">Entity</span>
            <span class="context-value" id="header-entity">${entityName}</span>
        </div>
        <span class="divider">|</span>
        <div class="context-item">
            <span class="context-label">ID</span>
            <span class="context-value mono" id="header-id">${recordId || ''}</span>
        </div>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" data-target="triggers" title="Flows that trigger when this record changes">Triggered By <span id="count-triggers">(0)</span></div>
      <div class="tab" data-target="updates" title="Flows that update this record">Modified By <span id="count-updates">(0)</span></div>
      <div class="tab" data-target="retrieves" title="Flows that read/retrieve this record">Read By <span id="count-retrieves">(0)</span></div>
    </div>
    <div class="toolbar">
        <div class="filter-group">
            <span class="filter-label">Status:</span>
            <select id="status-filter" class="filter-select">
                <option value="all">All</option>
                <option value="active" selected>Active</option>
                <option value="draft">Draft</option>
            </select>
        </div>
        <div style="flex: 1; margin-left: 12px;">
            <input type="text" id="flow-search" class="search-input" placeholder="Search flows...">
        </div>
    </div>
    <div class="content">
        <div id="pane-triggers" class="tab-pane active">
            <div class="loading">Scanning Triggers...</div>
        </div>
        <div id="pane-updates" class="tab-pane">
            <div class="loading">Scanning Updates...</div>
        </div>
        <div id="pane-retrieves" class="tab-pane">
            <div class="loading">Scanning Retrieves...</div>
        </div>
    </div>
  `;
  shadow.appendChild(container);

  let statusFilter = "active";
  let searchQuery = "";

  let cachedData = { triggers: [], updates: [], retrieves: [] };

  // Event Listeners
  container.querySelector(".close-btn").addEventListener("click", () => {
    host.remove();
    // Cleanup poller
    if (window._flowHistoryPoller) {
      clearInterval(window._flowHistoryPoller);
      window._flowHistoryPoller = null;
      if (DEBUG) console.log("Flow History: Navigation poller cleaned up.");
    }
  });

  const tabs = container.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      container.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      container.querySelector(`#pane-${tab.dataset.target}`).classList.add("active");
    });
  });

  const statusSelect = container.querySelector("#status-filter");
  statusSelect.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    refreshAllPanes();
  });

  const searchInput = container.querySelector("#flow-search");
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    refreshAllPanes();
  });



  // --- Main Logic ---
  async function main() {
    try {
      const flows = await fetchCloudFlows();

      // 1. Triggers
      cachedData.triggers = await scanTriggers(flows, entityName, envId);
      if (DEBUG) console.log(`Flow History: Found ${cachedData.triggers.length} trigger flows for entity '${entityName}'`);
      renderList("triggers", cachedData.triggers);

      // 2. Updates
      cachedData.updates = await scanUpdates(flows, entitySetName, envId);
      if (DEBUG) console.log(`Flow History: Found ${cachedData.updates.length} update flows for entity set '${entitySetName}'`);
      renderList("updates", cachedData.updates);

      // 3. Retrieves
      cachedData.retrieves = await scanRetrieves(flows, entitySetName, envId);
      if (DEBUG) console.log(`Flow History: Found ${cachedData.retrieves.length} retrieve flows for entity set '${entitySetName}'`);
      renderList("retrieves", cachedData.retrieves);

    } catch (e) {
      console.error("Main error:", e);
      container.querySelector(".content").innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
  }

  function refreshAllPanes() {
    renderList("triggers", cachedData.triggers);
    renderList("updates", cachedData.updates);
    renderList("retrieves", cachedData.retrieves);
  }

  function renderList(type, items) {
    const pane = container.querySelector(`#pane-${type}`);
    const countEl = container.querySelector(`#count-${type}`);

    let filteredItems = items;

    // Filter by search query
    if (searchQuery) {
      filteredItems = filteredItems.filter(i => i.name.toLowerCase().includes(searchQuery));
    }

    // Then apply status filter
    if (statusFilter === "active") {
      filteredItems = filteredItems.filter(i => i.status === "Active");
    } else if (statusFilter === "draft") {
      filteredItems = filteredItems.filter(i => i.status === "Draft");
    }

    countEl.textContent = `(${filteredItems.length})`;
    pane.innerHTML = "";

    if (filteredItems.length === 0) {
      pane.innerHTML = `<div class="empty">No flows found.</div>`;
      return;
    }

    filteredItems.forEach(item => pane.appendChild(createCard(item)));
  }

  function createCard(item) {
    const card = document.createElement("div");
    card.className = "flow-card";

    let details = "";
    if (item.isSystem) details += `<span class="pill system">System</span>`;
    if (item.changeType) details += `<span class="pill">${item.changeType}</span>`;
    if (item.operations) details += `<span class="pill">${item.operations}</span>`;
    if (item.fields) details += `<div style="margin-top:4px; font-size:11px; color:#666;">Fields: ${item.fields}</div>`;
    if (item.columns) details += `<div style="margin-top:4px; font-size:11px; color:#666;">Cols: ${item.columns}</div>`;

    card.innerHTML = `
        <div class="flow-name">
            <span>${item.name}</span>
            <span class="pill ${item.status === 'Active' ? 'active-status' : ''}">${item.status}</span>
        </div>
        <div class="flow-meta">
            ${details}
        </div>
        
        <div class="action-row">
            <a href="${item.runHistoryUrl}" target="_blank" class="link"><span>↗</span> Open in Maker</a>
            
              <div class="button-container">
                  <button class="btn btn-outline btn-load-runs" title="Show recent runs from Dataverse (not record specific)">
                      <span>≡</span> Recent Runs
                  </button>
                  <button class="btn btn-success btn-record-runs" title="Search runs for this specific record">
                      <span>▶</span> This Record
                  </button>
                  <button class="btn btn-danger-outline btn-all-failed" title="Show recent failed runs from Dataverse (not record specific)">
                      <span>⚠</span> Recent Failed
                  </button>
                  <button class="btn btn-danger btn-record-failed" title="Search failed runs for this specific record">
                      <span>🔴</span> Failed (This)
                  </button>
            </div>
        </div>
        
        <div class="run-list"></div>
    `;

    const btnAll = card.querySelector(".btn-load-runs");
    const btnAllFailed = card.querySelector(".btn-all-failed");
    const btnRecord = card.querySelector(".btn-record-runs");
    const btnRecordFailed = card.querySelector(".btn-record-failed");
    const runList = card.querySelector(".run-list");

    // Track active operation
    let activeOperation = null;

    // Helper to reset all buttons
    const resetAllButtons = () => {
      btnAll.disabled = false;
      btnAllFailed.disabled = false;
      btnRecord.disabled = false;
      btnRecordFailed.disabled = false;
      
      btnAll.innerHTML = '<span>≡</span> Recent Runs';
      btnAllFailed.innerHTML = '<span>⚠</span> Recent Failed';
      btnRecord.innerHTML = '<span>▶</span> This Record';
      btnRecordFailed.innerHTML = '<span>🔴</span> Failed (This)';
    };

    // Helper for Dataverse runs (All / All Failed)
    const loadDataverseRuns = async (button, mode, statusFilter = null) => {
      // If clicking the same button, toggle off
      if (runList.style.display === "block" && runList.dataset.mode === mode && activeOperation === mode) {
        runList.style.display = "none";
        runList.innerHTML = "";
        activeOperation = null;
        resetAllButtons();
        return;
      }

      // Reset all buttons and hide runList
      resetAllButtons();
      runList.style.display = "none";
      runList.innerHTML = "";
      activeOperation = mode;

      // Disable the clicked button
      button.disabled = true;
      const originalText = button.innerHTML;
      button.innerHTML = '<span>⏳</span> Loading...';

      runList.style.display = "block";
      runList.dataset.mode = mode;
      const statusLabel = statusFilter ? statusFilter : "all";
      runList.innerHTML = `<div style='color:#999; padding:5px;'>Loading ${statusLabel} runs...</div>`;

      try {
        const runs = await listAllRunsForFlow(item.flowIdMaker, item.flowIdAlt, statusFilter);
        if (runs.length === 0) {
          runList.innerHTML = `<div style='color:#666; padding:8px; font-style:italic;'>No ${statusLabel} runs found.</div>`;
        } else {
          renderRuns(runList, runs, envId, item.flowIdMaker);
        }
      } catch (error) {
        runList.innerHTML = `<div style='color:#d13438; padding:8px;'>Error: ${error.message}</div>`;
      } finally {
        // Only reset the button that was clicked
        button.disabled = false;
        button.innerHTML = originalText;
      }
    };

    // All Runs button
    btnAll.addEventListener("click", () => loadDataverseRuns(btnAll, "all"));

    // All Failed button
    btnAllFailed.addEventListener("click", () => loadDataverseRuns(btnAllFailed, "all_failed", "Failed"));

    // Helper for streaming runs (Record/Failed)
    const startStream = async (button, mode, filter = null) => {
      // If clicking the same button, toggle off
      if (runList.style.display === "block" && runList.dataset.mode === mode && activeOperation === mode) {
        runList.style.display = "none";
        runList.innerHTML = "";
        activeOperation = null;
        resetAllButtons();
        return;
      }

      // Reset all buttons and hide runList
      resetAllButtons();
      runList.style.display = "none";
      runList.innerHTML = "";
      activeOperation = mode;

      // Disable the clicked button
      button.disabled = true;
      const originalText = button.innerHTML;
      button.innerHTML = '<span>⏳</span> Starting...';

      runList.style.display = "block";
      runList.dataset.mode = mode;

      // Container for results
      const resultsContainer = document.createElement("div");
      runList.appendChild(resultsContainer);

      // Controls area
      const controls = document.createElement("div");
      controls.style.padding = "8px";
      controls.style.background = "#f9f9f9";
      controls.style.borderTop = "1px solid #eee";
      controls.style.textAlign = "center";
      controls.style.position = "relative"; // For absolute positioning of gear
      runList.appendChild(controls);

      // Explicit Config Button (Gear)
      const configBtn = document.createElement("button");
      configBtn.innerHTML = "<span>⚙</span>";
      configBtn.title = "Configure Client/Tenant ID";
      configBtn.style.position = "absolute";
      configBtn.style.right = "8px";
      configBtn.style.top = "8px";
      configBtn.style.background = "none";
      configBtn.style.border = "none";
      configBtn.style.cursor = "pointer";
      configBtn.style.color = "#999";
      configBtn.style.fontSize = "14px";
      configBtn.onclick = async () => {
        // Manually trigger the lazy config form
        stopped = true; // Pause stream
        resultsContainer.innerHTML = "";

        // 1. Fetch current config to pre-fill
        let currentConfig = {};
        try {
          currentConfig = await callBackgroundApi("GET_CONFIG", {});
        } catch (cfgErr) { 
          if (DEBUG) console.warn("Failed to fetch config", cfgErr); 
        }

        const settingsDiv = document.createElement("div");
        settingsDiv.style.padding = "16px";
        settingsDiv.style.textAlign = "left";
        settingsDiv.innerHTML = `
            <h3 style="margin:0 0 12px; font-size:14px; color:#323130;">Setup Flow Monitor</h3>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:12px;">Azure AD Client ID</label>
                <input type="text" id="lazy-client-id" class="search-input" placeholder="Application (client) ID" value="${currentConfig.clientId || ''}">
                <div id="lazy-client-error" style="font-size:11px; color:#d13438; margin-top:2px; display:none;"></div>
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block; font-weight:600; margin-bottom:4px; font-size:12px;">Tenant ID (Optional)</label>
                <input type="text" id="lazy-tenant-id" class="search-input" placeholder="${envId || 'c9b1687e-c304-4684-9573-dcb972d1f81e'}" value="${(currentConfig.tenantId === 'common' ? '' : currentConfig.tenantId) || ''}">
                <div id="lazy-tenant-error" style="font-size:11px; color:#d13438; margin-top:2px; display:none;"></div>
                <div style="font-size:11px; color:#605e5c; margin-top:2px;">Required for single-tenant apps.</div>
            </div>
            <button id="lazy-save-btn" class="btn btn-success" style="width:100%;">Save & Retry</button>
            <button id="lazy-cancel-btn" class="btn btn-outline" style="width:100%; margin-top:8px;">Cancel</button>
          `;
        resultsContainer.appendChild(settingsDiv);
        controls.style.display = "none"; // Hide controls while editing

        const btn = settingsDiv.querySelector("#lazy-save-btn");
        const cancelBtn = settingsDiv.querySelector("#lazy-cancel-btn");
        const clientInput = settingsDiv.querySelector("#lazy-client-id");
        const tenantInput = settingsDiv.querySelector("#lazy-tenant-id");
        const clientError = settingsDiv.querySelector("#lazy-client-error");
        const tenantError = settingsDiv.querySelector("#lazy-tenant-error");

        cancelBtn.onclick = () => {
          startStream(button, mode, filter); // Restart/Reset view
        };

        btn.onclick = async () => {
          const clientId = clientInput.value.trim();
          const tenantId = tenantInput.value.trim();
          
          // Reset error state
          clientInput.style.borderColor = "";
          clientError.style.display = "none";
          tenantInput.style.borderColor = "";
          tenantError.style.display = "none";
          
          let hasError = false;
          
          if (!clientId) {
            clientInput.style.borderColor = "#d13438";
            clientError.textContent = "Client ID is required";
            clientError.style.display = "block";
            hasError = true;
          } else if (!guidRegex.test(clientId)) {
            clientInput.style.borderColor = "#d13438";
            clientError.textContent = "Invalid format. Use a valid GUID (e.g., 12345678-1234-1234-1234-123456789abc)";
            clientError.style.display = "block";
            hasError = true;
          }
          
          // Validate Tenant ID (optional, but if provided must be 'common' or a valid GUID)
          if (tenantId && tenantId.toLowerCase() !== 'common' && !guidRegex.test(tenantId)) {
            tenantInput.style.borderColor = "#d13438";
            tenantError.textContent = "Invalid format. Use 'common' or a valid GUID";
            tenantError.style.display = "block";
            hasError = true;
          }
          
          if (hasError) return;
          
          btn.disabled = true;
          btn.innerText = "Saving...";
          try {
            await callBackgroundApi("SAVE_CONFIG", { clientId, tenantId });
            setTimeout(() => startStream(button, mode, filter), 500);
          } catch (saveErr) {
            btn.innerText = "Error Saving";
            console.error(saveErr);
          }
        };
      };
      controls.appendChild(configBtn);

      const statusText = document.createElement("div");
      statusText.style.fontSize = "11px";
      statusText.style.color = "#666";
      statusText.style.marginBottom = "5px";
      statusText.innerText = "Initializing search...";
      controls.appendChild(statusText);

      const stopBtn = document.createElement("button");
      stopBtn.className = "btn";
      stopBtn.style.background = "#d13438";
      stopBtn.style.color = "white";
      stopBtn.innerText = "Stop Search";
      controls.appendChild(stopBtn);

      let stopped = false;
      stopBtn.onclick = () => {
        stopped = true;
        stopBtn.disabled = true;
        stopBtn.innerText = "Stopping...";
        stopBtn.style.opacity = "0.7";
      };

      // Start streaming
      await listRecordRunsForFlow(item.flowIdMaker, item.flowIdAlt, {
        onRunFound: (run) => {
          renderRuns(resultsContainer, [run], envId, item.flowIdMaker, true);
        },
        onProgress: (count, hasMore) => {
          statusText.innerText = `Scanned ${count} runs... ${hasMore ? '(More available)' : '(End of results)'}`;
        },
        onError: async (err) => {
          stopped = true;
          let msg = err.message || String(err);
          const needsConfig = msg.includes("Client ID not configured") || msg.includes("AADSTS50194");

          if (needsConfig) {
            resultsContainer.innerHTML = ""; // Clear partial results

            // 1. Fetch current config to pre-fill
            let currentConfig = {};
            try {
              currentConfig = await callBackgroundApi("GET_CONFIG", {});
            } catch (cfgErr) { 
              if (DEBUG) console.warn("Failed to fetch config", cfgErr); 
            }

            const settingsDiv = document.createElement("div");
            settingsDiv.style.padding = "16px";
            settingsDiv.style.textAlign = "left";
            settingsDiv.innerHTML = `
                <h3 style="margin:0 0 12px; font-size:14px; color:#323130;">Setup Flow Monitor</h3>
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-weight:600; margin-bottom:4px; font-size:12px;">Azure AD Client ID</label>
                    <input type="text" id="lazy-client-id" class="search-input" placeholder="Application (client) ID" value="${currentConfig.clientId || ''}">
                    <div id="lazy-client-error" style="font-size:11px; color:#d13438; margin-top:2px; display:none;"></div>
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block; font-weight:600; margin-bottom:4px; font-size:12px;">Tenant ID (Optional)</label>
                    <input type="text" id="lazy-tenant-id" class="search-input" placeholder="${envId || 'c9b1687e-c304-4684-9573-dcb972d1f81e'}" value="${(currentConfig.tenantId === 'common' ? '' : currentConfig.tenantId) || ''}">
                    <div id="lazy-tenant-error" style="font-size:11px; color:#d13438; margin-top:2px; display:none;"></div>
                    <div style="font-size:11px; color:#605e5c; margin-top:2px;">Required for single-tenant apps.</div>
                </div>
                <button id="lazy-save-btn" class="btn btn-success" style="width:100%;">Save & Retry</button>
              `;
            resultsContainer.appendChild(settingsDiv);

            const btn = settingsDiv.querySelector("#lazy-save-btn");
            const clientInput = settingsDiv.querySelector("#lazy-client-id");
            const tenantInput = settingsDiv.querySelector("#lazy-tenant-id");
            const clientError = settingsDiv.querySelector("#lazy-client-error");
            const tenantError = settingsDiv.querySelector("#lazy-tenant-error");

            btn.onclick = async () => {
              const clientId = clientInput.value.trim();
              const tenantId = tenantInput.value.trim();
              
              // Reset error state
              clientInput.style.borderColor = "";
              clientError.style.display = "none";
              tenantInput.style.borderColor = "";
              tenantError.style.display = "none";
              
              let hasError = false;
              
              if (!clientId) {
                clientInput.style.borderColor = "#d13438";
                clientError.textContent = "Client ID is required";
                clientError.style.display = "block";
                hasError = true;
              } else if (!guidRegex.test(clientId)) {
                clientInput.style.borderColor = "#d13438";
                clientError.textContent = "Invalid format. Use a valid GUID (e.g., 12345678-1234-1234-1234-123456789abc)";
                clientError.style.display = "block";
                hasError = true;
              }
              
              // Validate Tenant ID (optional, but if provided must be 'common' or a valid GUID)
              if (tenantId && tenantId.toLowerCase() !== 'common' && !guidRegex.test(tenantId)) {
                tenantInput.style.borderColor = "#d13438";
                tenantError.textContent = "Invalid format. Use 'common' or a valid GUID";
                tenantError.style.display = "block";
                hasError = true;
              }
              
              if (hasError) return;

              btn.disabled = true;
              btn.innerText = "Saving...";

              try {
                await callBackgroundApi("SAVE_CONFIG", { clientId, tenantId });
                // Add small delay for storage propagation
                setTimeout(() => startStream(button, mode, filter), 500);
              } catch (saveErr) {
                btn.innerText = "Error Saving";
                console.error(saveErr);
              }
            };

            // Hide controls since we are showing a form
            controls.style.display = "none";
            return;
          }

          statusText.innerHTML = `<span style='color:#d13438; font-weight:600;'>${msg}</span>`;

          const retryBtn = document.createElement("button");
          retryBtn.className = "btn";
          retryBtn.style.background = "#0078d4";
          retryBtn.style.marginTop = "8px";
          retryBtn.innerText = "Retry / Sign In";
          retryBtn.onclick = () => startStream(button, mode, filter);
          controls.appendChild(retryBtn);

          stopBtn.remove();
        },
        shouldStop: () => stopped,
        filter: filter
      });

      // Cleanup - only reset the button that was clicked
      button.disabled = false;
      button.innerHTML = originalText;

      if (stopped && !controls.querySelector("button:not(.btn-outline)")) {
        // If stopped manually (and not replaced by retry button)
        if (statusText.innerText !== "Error") statusText.innerHTML = "<b style='color:#d13438'>Search stopped by user.</b>";
      } else if (!stopped) {
        statusText.innerText = "Search complete.";
        if (resultsContainer.children.length === 0) {
          const noRunsMsg = document.createElement("div");
          noRunsMsg.style.color = "#666";
          noRunsMsg.style.padding = "8px";
          noRunsMsg.style.fontStyle = "italic";
          noRunsMsg.innerText = "No runs found for this record.";
          resultsContainer.appendChild(noRunsMsg);
        }
      }
      stopBtn.remove();
    };

    // Record Runs button
    btnRecord.addEventListener("click", () => startStream(btnRecord, "record", null));

    // Record Failed runs button
    btnRecordFailed.addEventListener("click", () => startStream(btnRecordFailed, "record_failed", "status eq 'Failed'"));

    return card;
  }

  function renderRuns(container, runs, envId, flowId, append = false) {
    if (!append) container.innerHTML = "";

    // Insert before the load more container (last child) if it exists
    const loadMoreContainer = container.lastElementChild?.tagName === "DIV" && container.lastElementChild.querySelector("button") ? container.lastElementChild : null;

    runs.forEach(run => {
      const status = run.status;
      const startTime = new Date(run.starttime || run.start).toLocaleString();
      const runLink = `https://make.powerautomate.com/environments/${envId}/solutions/~preferred/flows/${flowId}/runs/${run.name}`;

      const item = document.createElement("div");
      item.className = "run-item";
      item.innerHTML = `
            <span>${startTime}</span>
            <span class="status-${status}">${status}</span>
            <a href="${runLink}" target="_blank" style="text-decoration:none;">↗</a>
        `;

      if (loadMoreContainer) {
        container.insertBefore(item, loadMoreContainer);
      } else {
        container.appendChild(item);
      }
    });
  }

  async function refreshExtension() {
    // 1. Update Context (returns false if no record context)
    const hasContext = await loadContext();

    // 2. Update UI Header
    const headerEntity = container.querySelector("#header-entity");
    const headerId = container.querySelector("#header-id");

    if (hasContext) {
      if (headerEntity) headerEntity.textContent = entityName;
      if (headerId) headerId.textContent = recordId;
    } else {
      if (headerEntity) headerEntity.textContent = "No Record Selected";
      if (headerId) headerId.textContent = "—";
    }

    // 3. Reset Data & UI Lists (Always clear logic)
    cachedData = { triggers: [], updates: [], retrieves: [] };
    ["triggers", "updates", "retrieves"].forEach(t => {
      const pane = container.querySelector(`#pane-${t}`);
      const count = container.querySelector(`#count-${t}`);

      if (hasContext) {
        if (pane) pane.innerHTML = `<div class="loading">Rescanning...</div>`;
      } else {
        if (pane) pane.innerHTML = `<div class="empty">Please open a record to view flows.</div>`;
      }
      if (count) count.textContent = "(0)";
    });

    // 4. Run Main Logic ONLY if context exists
    if (hasContext) {
      await main();
    }
  }

  // Initial Load
  (async () => {
    await refreshExtension();
  })();

  // Listen for Navigation via Polling with Debouncing
  if (!window._flowHistoryPoller) {
    let debounceTimer = null;
    window._flowHistoryPoller = setInterval(async () => {
      // Check if we HAVE context currently
      const hasXrm = (typeof Xrm !== "undefined" && Xrm.Page && Xrm.Page.data && Xrm.Page.data.entity);

      let currentId = "";
      let currentEntity = "";

      if (hasXrm) {
        try {
          currentId = Xrm.Page.data.entity.getId()?.replace(/[{}]/g, "").toLowerCase() || "";
          currentEntity = Xrm.Page.data.entity.getEntityName() || "";
        } catch (e) { }
      }

      // Trigger refresh if context changed (with debouncing)
      if ((currentId !== recordId) || (currentEntity !== entityName)) {
        if (DEBUG) console.log("Flow History: Context change detected via poller.");
        
        // Debounce to avoid multiple rapid refreshes
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (DEBUG) console.log("Flow History: Executing refresh after debounce.");
          await refreshExtension();
          debounceTimer = null;
        }, 500); // 500ms debounce
      }

    }, 1000);
    if (DEBUG) console.log("Flow History: Navigation poller started.");
  }

})();
