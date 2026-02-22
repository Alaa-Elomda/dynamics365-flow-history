# ?? Quick Start Guide

Get the Dynamics 365 Flow History Extension running in **5 minutes**.

---

## Step 1: Install the Extension

1. Download/install the extension in Chrome
2. The extension icon appears in your toolbar: ![icon](icon16.png)

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
1. Go to **Authentication** ? **Add a platform** ? **Single-page application**
2. Find your extension ID at `chrome://extensions/`
3. Enter redirect URI: `https://YOUR-EXTENSION-ID.chromiumapp.org/`
4. Check ? **Access tokens** and ? **ID tokens**
5. Click **Save**

### D. Add API Permission
1. Go to **API permissions** ? **Add a permission**
2. Select **APIs my organization uses** ? Search **"Power Automate"** or **"Flow"**
3. Select **Delegated permissions** ? Check available permissions
4. Click **Add permissions**

---

## Step 3: Configure the Extension

1. Click the extension icon in Chrome
2. Enter your **Client ID** and **Tenant ID**
3. Click **Save Settings**

---

## Step 4: Use It!

1. Open any **Dynamics 365 record** (Contact, Account, etc.)
2. Click the **extension icon**
3. Click **"Launch Flow Monitor"**
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

## Need Help?

See the full [USER_GUIDE.md](USER_GUIDE.md) for detailed instructions and troubleshooting.

---

*Setup complete! Enjoy faster flow debugging.* ?
