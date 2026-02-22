document.addEventListener('DOMContentLoaded', async () => {
    // Views
    const launchView = document.getElementById('launch-view');
    const settingsView = document.getElementById('settings-view');
    const settingsToggle = document.getElementById('settings-toggle');
    const backBtn = document.getElementById('backBtn');

    // Inputs
    const clientIdInput = document.getElementById('clientId');
    const tenantIdInput = document.getElementById('tenantId');

    // Actions
    const saveBtn = document.getElementById('saveBtn');
    const launchBtn = document.getElementById('launchBtn');

    // Status
    const launchStatus = document.getElementById('launch-status');
    const settingStatus = document.getElementById('setting-status');

    // GUID validation regex
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Helper: Show specific view
    const showView = (viewName) => {
        if (viewName === 'settings') {
            launchView.style.display = 'none';
            settingsView.style.display = 'block';
            settingsToggle.style.visibility = 'hidden'; // Hide gear in settings
        } else {
            launchView.style.display = 'flex';
            settingsView.style.display = 'none';
            settingsToggle.style.visibility = 'visible';
        }
    };

    // Load saved settings
    const data = await chrome.storage.local.get(['azureClientId', 'azureTenantId']);
    if (data.azureClientId) clientIdInput.value = data.azureClientId;
    if (data.azureTenantId) tenantIdInput.value = data.azureTenantId;

    // Check configuration
    if (!data.azureClientId && !data.azureTenantId) {
        showView('settings'); // First run
    }

    // Toggle Handlers
    settingsToggle.addEventListener('click', () => showView('settings'));
    backBtn.addEventListener('click', () => showView('launch'));

    // Check if we are on a Dynamics page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isDynamics = tab.url && (tab.url.includes('.crm.dynamics.com') || tab.url.includes('.dynamics.com'));

    if (!isDynamics) {
        launchBtn.disabled = true;
        launchBtn.innerText = "Only for Dynamics 365";
        launchBtn.title = "Navigate to a Dynamics 365 record to use this extension.";
    }

    // Save Settings
    saveBtn.addEventListener('click', async () => {
        const clientId = clientIdInput.value.trim();
        const tenantId = tenantIdInput.value.trim();

        if (!clientId) {
            showStatus(settingStatus, 'Client ID is required', 'error');
            return;
        }

        // Validate Client ID GUID format
        if (!guidRegex.test(clientId)) {
            showStatus(settingStatus, 'Invalid Client ID format. Use a valid GUID.', 'error');
            return;
        }

        // Validate Tenant ID (must be 'common' or a valid GUID)
        if (tenantId && tenantId !== 'common' && !guidRegex.test(tenantId)) {
            showStatus(settingStatus, 'Invalid Tenant ID. Use "common" or a valid GUID.', 'error');
            return;
        }

        // Disable button during save
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';

        try {
            await chrome.storage.local.set({
                azureClientId: clientId,
                azureTenantId: tenantId || 'common'
            });
            showStatus(settingStatus, 'Settings saved!', 'success');
            setTimeout(() => showView('launch'), 800); // Auto-back to launcher
        } catch (error) {
            showStatus(settingStatus, 'Error: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = 'Save Settings';
        }
    });

    // Launch Flow History
    launchBtn.addEventListener('click', async () => {
        if (!isDynamics) return;

        // Disable button during injection
        launchBtn.disabled = true;
        const originalText = launchBtn.innerText;
        launchBtn.innerText = 'Opening...';

        try {
            // Inject the script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["main_world_script.js"],
                world: "MAIN"
            });

            window.close(); // Close popup after successful launch
        } catch (err) {
            console.error("Injection failed:", err);
            showStatus(launchStatus, 'Error: ' + err.message, 'error');
            launchBtn.disabled = false;
            launchBtn.innerText = originalText;
        }
    });

    function showStatus(element, msg, type) {
        element.textContent = msg;
        element.className = 'status ' + type;
    }
});
