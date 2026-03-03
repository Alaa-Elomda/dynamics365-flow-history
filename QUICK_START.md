# ? Quick Start Guide

Get the Dynamics 365 Flow History Extension running in **5 minutes**.

---

## Step 1: Install the Extension

### From Chrome Web Store (Recommended)
[![Install from Chrome Web Store](https://img.shields.io/badge/Install-Chrome%20Web%20Store-blue?style=for-the-badge&logo=googlechrome)](https://chromewebstore.google.com/detail/dynamics-365-flow-history/gogaoihholdamhahafnjpfaaogheklfk)

### Manual Installation
1. Download/clone the extension files
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the folder

---

## Step 2: Create Azure AD App (One-Time Setup)

### A. Register the App
1. Go to [Azure Portal](https://portal.azure.com) ? **Azure Active Directory** ? **App registrations**
2. Click **"+ New registration"**
3. Name it `Flow History Extension`
4. Select **"Accounts in this organizational directory only"** (or multi-tenant if needed)
5. Click **Register**

### B. Copy Your IDs
From the Overview page, copy:
- ? **Application (client) ID** ? `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- ? **Directory (tenant) ID** ? `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### C. Add Redirect URI
1. Go to **Authentication** ? **Add a platform** ? **Web**
2. Enter this redirect URI (for Chrome Web Store version):
   ```
   https://gogaoihholdamhahafnjpfaaogheklfk.chromiumapp.org/
   ```
   > ?? If using Developer Mode, find your extension ID at `chrome://extensions/` and use: `https://YOUR-EXTENSION-ID.chromiumapp.org/`

3. Check ? **Access tokens** and ? **ID tokens**
4. Click **Save**

### D. Add API Permission
1. Go to **API permissions** ? **Add a permission**
2. Select **APIs my organization uses** ? Search **"Power Automate"** or **"Flow Service"**
3. Select **Delegated permissions** ? Check available permissions
4. Click **Add permissions**

---

## Step 3: Configure the Extension

1. **Right-click** the extension icon in Chrome/Edge toolbar
2. Click **Extension options**
3. Enter your **Client ID** and **Tenant ID**
4. Click **Save Settings**

<img src="screenshots/Flow History Extension Settings.png" alt="Extension Settings" width="400">

---

## Step 4: Use It!

1. Open any **Dynamics 365 record** (Contact, Account, etc.)
2. Click the **extension icon**
3. The **Flow Monitor** panel opens automatically
4. Sign in with your Microsoft account when prompted
5. View your flows! ??

---

## Quick Feature Overview

| Button | What It Does |
|--------|--------------|
| **Recent Runs** | Shows latest runs for this flow |
| **This Record** | Searches runs related to YOUR current record |
| **Recent Failed** | Shows recent failures |
| **Failed (This)** | Searches failures for YOUR current record |

---

## Extension Info (Fixed)

| Property | Value |
|----------|-------|
| **Extension ID** | `gogaoihholdamhahafnjpfaaogheklfk` |
| **Redirect URI** | `https://gogaoihholdamhahafnjpfaaogheklfk.chromiumapp.org/` |
| **Chrome Web Store** | [Install Link](https://chromewebstore.google.com/detail/dynamics-365-flow-history/gogaoihholdamhahafnjpfaaogheklfk) |

---

## Need Help?

See the full [USER_GUIDE.md](USER_GUIDE.md) for detailed instructions and troubleshooting.

---

*Setup complete! Enjoy faster flow debugging.* ??
