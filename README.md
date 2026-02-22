# Dynamics 365 Flow History Extension

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-blue?logo=googlechrome)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)

A Chrome extension that allows you to view Power Automate flow run history directly from Dynamics 365 records.

<p align="center">
  <img src="screenshots/main-panel.png" alt="Extension Screenshot" width="400">
</p>

## :sparkles: Features

- :mag: **Flow Discovery** - Automatically finds all flows related to the current record
- :bar_chart: **Three View Modes**:
  - **Triggered By** - Flows that trigger when this record changes
  - **Modified By** - Flows that update this record
  - **Read By** - Flows that retrieve this record
- :dart: **Record-Specific Runs** - Search flow runs for the specific record you're viewing
- :zap: **Real-time Streaming** - Results appear as they're found
- :lock: **Secure Authentication** - Uses your Azure AD credentials via OAuth 2.0

## :camera: Screenshots

<table>
  <tr>
    <td align="center">
      <img src="screenshots/main-panel.png" alt="Main Panel" width="280"><br>
      <em>Main Panel</em>
    </td>
    <td align="center">
      <img src="screenshots/run-history.png" alt="Run History" width="280"><br>
      <em>Run History</em>
    </td>
    <td align="center">
      <img src="screenshots/setup-dialog.png" alt="Setup" width="280"><br>
      <em>Setup Configuration</em>
    </td>
  </tr>
</table>

## :rocket: Installation

### From Chrome Web Store (Recommended)
*Coming Soon*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder

## :gear: Configuration

### Prerequisites
You need an Azure AD App Registration to use the record-specific run search feature.

### Azure AD Setup
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `Flow History Extension` (or your choice)
   - **Supported account types**: Choose based on your needs
     - *Single tenant* - Only your organization
     - *Multitenant* - Any Azure AD organization
   - **Redirect URI**: Select **Single-page application (SPA)** and enter:
     ```
     https://<your-extension-id>.chromiumapp.org/
     ```
5. After creation, copy the **Application (client) ID**

### Finding Your Extension ID
1. Go to `chrome://extensions/`
2. Find "Dynamics 365 Flow History"
3. Copy the ID shown below the extension name

### Extension Configuration
1. Click the extension icon on a Dynamics 365 page
2. Click the :gear: gear icon
3. Enter your **Azure AD Client ID**
4. (Optional) Enter your **Tenant ID** or leave blank for "common"
5. Click **Save Settings**

## :book: Usage

1. Navigate to any Dynamics 365 record
2. Click the extension icon in Chrome toolbar
3. Click **Open Flow Monitor**
4. Browse flows in the three tabs:
   - **Triggered By** - Flows triggered by changes to this entity
   - **Modified By** - Flows that update this entity
   - **Read By** - Flows that read this entity
5. Click buttons to view run history:
   - **Recent Runs** - All recent runs (from Dataverse)
   - **This Record** - Runs related to THIS specific record
   - **Recent Failed** - Recent failed runs
   - **Failed (This)** - Failed runs for this record

## :closed_lock_with_key: Privacy

This extension:
- :white_check_mark: Stores configuration locally only
- :white_check_mark: Does NOT collect personal data
- :white_check_mark: Does NOT track usage analytics
- :white_check_mark: Only communicates with Microsoft services

See [PRIVACY.md](PRIVACY.md) for full details.

## :wrench: Development

### Project Structure
```
??? manifest.json          # Extension manifest (V3)
??? background.js          # Service worker (API calls, auth)
??? injector.js            # Content script bridge (ISOLATED world)
??? main_world_script.js   # Main UI & logic (MAIN world)
??? popup.html/js          # Extension popup
??? settings.html/js       # Options page
??? icons/                 # Extension icons
```

### Building
No build step required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in developer mode
2. Navigate to a Dynamics 365 record
3. Click the extension icon
4. See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed testing steps

## :memo: Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## :page_facing_up: License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## :handshake: Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## :warning: Disclaimer

This extension is not affiliated with, endorsed by, or sponsored by Microsoft Corporation.

---

**Made with :heart: for the Dynamics 365 Community**
