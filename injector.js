// Message Bridge: MAIN World <-> Content Script <-> Background Script
window.addEventListener("message", (event) => {
    // Only accept messages from the same window and our specific source
    if (event.source !== window || event.data.source !== "FLOW_HISTORY_EXTENSION") {
        return;
    }

    const { type, payload, requestId } = event.data;

    if (type === "API_REQUEST" || type === "SIGN_IN_REQUEST") {
        // console.log("Injector: Forwarding request", payload?.type || "SIGN_IN", "to background");

        try {
            chrome.runtime.sendMessage(payload || { type: "SIGN_IN" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Injector: Chrome runtime error:", chrome.runtime.lastError.message);
                    window.postMessage({
                        source: "FLOW_HISTORY_EXTENSION_RESPONSE",
                        requestId: requestId,
                        response: { ok: false, error: chrome.runtime.lastError.message }
                    }, "*");
                    return;
                }

                // console.log("Injector: Got response from background", response);
                window.postMessage({
                    source: "FLOW_HISTORY_EXTENSION_RESPONSE",
                    requestId: requestId,
                    response: response
                }, "*");
            });
        } catch (e) {
            console.error("Injector: Exception sending message:", e);
            window.postMessage({
                source: "FLOW_HISTORY_EXTENSION_RESPONSE",
                requestId: requestId,
                response: { ok: false, error: e.message }
            }, "*");
        }
    }
});

console.log("Flow History Extension: Bridge loaded.");
