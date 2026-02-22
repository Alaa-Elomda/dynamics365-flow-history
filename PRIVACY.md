# Privacy Policy for Dynamics 365 Flow History Extension

**Last Updated:** January 2025

## Overview

The Dynamics 365 Flow History Extension ("Extension") is designed to help users view Power Automate flow run history for Dynamics 365 records. This privacy policy explains how the Extension handles user data.

## Data Collection

### What We Collect
The Extension collects and stores the following data **locally on your device only**:

- **Azure AD Client ID**: Required for authentication with Microsoft services
- **Azure AD Tenant ID**: Optional, used for single-tenant app configurations

### What We DO NOT Collect
- We do **not** collect personal information
- We do **not** track user behavior or analytics
- We do **not** send any data to external servers (other than Microsoft's authentication and Power Automate APIs)
- We do **not** store flow run data, record IDs, or any Dynamics 365 data

## Data Storage

All configuration data is stored locally using Chrome's `chrome.storage.local` API. This data:
- Remains on your device
- Is not synced across devices
- Is deleted when you uninstall the Extension

## Third-Party Services

The Extension communicates with the following Microsoft services:

1. **Microsoft Identity Platform** (`login.microsoftonline.com`)
   - Used for OAuth 2.0 authentication
   - Required to obtain access tokens

2. **Power Automate API** (`api.flow.microsoft.com`)
   - Used to retrieve flow run history
   - Requires user authentication

3. **Dynamics 365** (`*.dynamics.com`, `*.crm.dynamics.com`)
   - The Extension operates within Dynamics 365 pages
   - Reads entity metadata and flow definitions from Dataverse

## Permissions

The Extension requires the following permissions:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current Dynamics 365 tab |
| `scripting` | Inject the Flow Monitor UI |
| `storage` | Store configuration settings locally |
| `identity` | Authenticate with Microsoft |
| `cookies` | Required for authentication flow |

## User Rights

You have the right to:
- **Access** your stored settings via the Extension options page
- **Modify** your configuration at any time
- **Delete** all stored data by uninstalling the Extension

## Security

- Authentication tokens are cached in memory only and expire automatically
- All communication with Microsoft services uses HTTPS
- The Extension does not store passwords or sensitive credentials

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

For questions or concerns about this privacy policy, please open an issue on the Extension's repository.

---

*This Extension is not affiliated with, endorsed by, or sponsored by Microsoft Corporation.*
