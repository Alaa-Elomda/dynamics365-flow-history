// Production flag - set to true temporarily for debugging
const DEBUG = false;

// Token caching variables
let cachedToken = null;
let tokenExpiration = 0;
let tokenRequestPromise = null;

// Get Azure AD configuration from storage
async function getAzureConfig() {
    const data = await chrome.storage.local.get(['azureClientId', 'azureTenantId']);
    return {
        clientId: data.azureClientId,
        tenantId: data.azureTenantId || 'common'
    };
}

// Get Microsoft OAuth token using configured Client ID
async function getMicrosoftToken(forceRefresh = false) {
    const now = Date.now();

    // 1. Return cached token if valid (buffer 5 mins) and not forced refresh
    if (!forceRefresh && cachedToken && now < tokenExpiration - 300000) {
        if (DEBUG) console.log("Background: Using cached token");
        return cachedToken;
    }

    // 2. If a request is already in progress, wait for it
    if (tokenRequestPromise) {
        if (DEBUG) console.log("Background: Waiting for existing token request");
        return tokenRequestPromise;
    }

    // 3. Start a new request
    tokenRequestPromise = (async () => {
        try {
            const config = await getAzureConfig();
            if (!config.clientId) {
                throw new Error('Azure AD Client ID not configured. Please go to extension settings.');
            }

            const redirectUrl = chrome.identity.getRedirectURL();
            const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
                `client_id=${encodeURIComponent(config.clientId)}` +
                `&response_type=token` +
                `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
                `&scope=${encodeURIComponent('https://service.flow.microsoft.com/.default')}` +
                `&prompt=select_account`;

            if (DEBUG) console.log("Background: Launching auth flow");

            const responseUrl = await new Promise((resolve, reject) => {
                chrome.identity.launchWebAuthFlow({
                    url: authUrl,
                    interactive: true
                }, (url) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(url);
                });
            });

            // Extract access token
            const url = new URL(responseUrl);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const queryParams = new URLSearchParams(url.search);

            const error = hashParams.get('error') || queryParams.get('error');
            const errorDesc = hashParams.get('error_description') || queryParams.get('error_description');

            if (error) {
                console.error("Background: Auth Error:", error, errorDesc);
                throw new Error(`Azure AD Error: ${error} - ${errorDesc}`);
            }

            const token = hashParams.get('access_token');
            const expiresIn = parseInt(hashParams.get('expires_in') || '3600', 10);

            if (token) {
                if (DEBUG) console.log("Background: Got OAuth token");
                cachedToken = token;
                tokenExpiration = Date.now() + (expiresIn * 1000);
                return token;
            } else {
                console.error("Background: No token in response:", responseUrl);
                throw new Error('No access token in response. Check console for details.');
            }
        } finally {
            tokenRequestPromise = null; // Clear promise so next call can retry if needed
        }
    })();

    return tokenRequestPromise;
}

// Helper to fetch with bearer token (with automatic retry on 401)
async function fetchJsonWithToken(url, init = {}, retryOn401 = true) {
    if (DEBUG) console.log("Background: Fetching with token", url);

    const token = await getMicrosoftToken();

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "accept": "application/json",
            ...(init.headers || {})
        },
        ...init
    });

    const text = await res.text();
    if (DEBUG) console.log("Background: Response status", res.status);

    // Handle 401 Unauthorized - token may be expired
    if (res.status === 401 && retryOn401) {
        if (DEBUG) console.log("Background: 401 detected, refreshing token and retrying");
        // Clear cached token and retry once
        cachedToken = null;
        tokenExpiration = 0;
        return fetchJsonWithToken(url, init, false); // Retry without further 401 retries
    }

    if (!res.ok) {
        console.error("Background: HTTP Error", res.status, text.slice(0, 500));
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
        console.error("Background: Non-JSON response");
        throw new Error(`Non-JSON response. Got: ${ct}`);
    }
    return JSON.parse(text);
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === "LIST_RUNS") {
                const { envId, makerId, top, nextLink, filter } = msg; // Accept nextLink and filter
                let url;

                if (nextLink) {
                    url = nextLink;
                } else {
                    let qs = `api-version=2016-11-01&$top=${encodeURIComponent(top || 100)}`; // Increased default top to 100
                    if (filter) {
                        qs += `&$filter=${encodeURIComponent(filter)}`;
                    }
                    url = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/${encodeURIComponent(envId)}/flows/${encodeURIComponent(makerId)}/runs?${qs}`;
                }

                const data = await fetchJsonWithToken(url);
                // Return structure with runs AND nextLink
                // Robust nextLink extraction
                const extractedNextLink = data['@odata.nextLink'] || data['nextLink'] || data['@nextLink'];
                if (DEBUG) console.log("Background: Run count", data.value?.length, "NextLink:", extractedNextLink ? "Yes" : "No");

                sendResponse({
                    ok: true,
                    data: {
                        runs: data.value,
                        nextLink: extractedNextLink
                    }
                });
                return;
            }

            if (msg.type === "GET_JSON") {
                const { url, noAuth } = msg;
                let data;
                if (noAuth) {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    data = await res.json();
                } else {
                    data = await fetchJsonWithToken(url);
                }
                sendResponse({ ok: true, data });
                return;
            }

            if (msg.type === "SAVE_CONFIG") {
                const { clientId, tenantId } = msg;
                await chrome.storage.local.set({
                    azureClientId: clientId,
                    azureTenantId: tenantId
                });
                // Invalidate token cache on config change
                cachedToken = null;
                tokenExpiration = 0;
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "GET_CONFIG") {
                const config = await getAzureConfig();
                sendResponse({ ok: true, data: config });
                return;
            }

            sendResponse({ ok: false, error: "Unknown message type" });
        } catch (e) {
            console.error("Background Error:", e);
            sendResponse({ ok: false, error: String(e.message || e) });
        }
    })();

    return true; // keep channel open
});

// Handle extension icon click (Direct Launch)
chrome.action.onClicked.addListener(async (tab) => {
    console.log("Flow History: Extension icon clicked!", tab.url);
    
    if (!tab.url || (!tab.url.includes('.crm.dynamics.com') && !tab.url.includes('.dynamics.com'))) {
        console.warn("Flow History: Not a Dynamics 365 page. URL:", tab.url);
        // Show a notification to the user
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    alert("Flow Monitor: Please navigate to a Dynamics 365 record to use this extension.");
                }
            });
        } catch (e) {
            // If we can't inject (e.g., chrome:// pages), just log it
            console.warn("Flow History: Cannot show alert on this page:", e.message);
        }
        return;
    }

    console.log("Flow History: URL matched, injecting scripts...");

    try {
        // First, inject the content script bridge (ISOLATED world) to ensure message passing works
        // This is needed in case the content script wasn't loaded (e.g., extension was reloaded)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["injector.js"],
            world: "ISOLATED"
        });
        console.log("Flow History: Injector bridge loaded.");

        // Then inject the main script (MAIN world)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["main_world_script.js"],
            world: "MAIN"
        });
        console.log("Flow History: Script injected successfully.");
    } catch (err) {
        console.error("Flow History: Injection failed", err);
        // Show error to user
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (errorMsg) => {
                    alert("Flow Monitor Error: " + errorMsg);
                },
                args: [err.message]
            });
        } catch (e) {
            // Silently fail if we can't show the alert
        }
    }
});
