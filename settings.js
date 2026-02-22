// Settings page logic
document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const clientIdInput = document.getElementById('clientId');
    const tenantIdInput = document.getElementById('tenantId');
    const statusEl = document.getElementById('status');

    // GUID validation regex
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const clientId = clientIdInput.value.trim();
        const tenantId = tenantIdInput.value.trim() || 'common';

        if (!clientId) {
            showStatus('Please enter a Client ID', 'error');
            return;
        }

        // Validate Client ID GUID format
        if (!guidRegex.test(clientId)) {
            showStatus('Invalid Client ID format. Should be a GUID like: 12345678-1234-1234-1234-123456789abc', 'error');
            return;
        }

        // Validate Tenant ID (must be 'common' or a valid GUID)
        if (tenantId !== 'common' && !guidRegex.test(tenantId)) {
            showStatus('Invalid Tenant ID format. Use "common" or a valid GUID.', 'error');
            return;
        }

        try {
            // Save to chrome.storage
            await chrome.storage.local.set({
                azureClientId: clientId,
                azureTenantId: tenantId
            });

            showStatus('✓ Settings saved successfully!', 'success');
        } catch (error) {
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    });

    // Load existing settings
    async function loadSettings() {
        try {
            const data = await chrome.storage.local.get(['azureClientId', 'azureTenantId']);
            if (data.azureClientId) {
                clientIdInput.value = data.azureClientId;
            }
            if (data.azureTenantId) {
                tenantIdInput.value = data.azureTenantId;
            } else {
                tenantIdInput.value = 'common';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading settings. Please refresh the page.', 'error');
        }
    }

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'status ' + type;
        statusEl.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    // Load settings on page load
    loadSettings();
});
