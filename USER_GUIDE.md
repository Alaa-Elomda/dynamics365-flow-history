# Dynamics 365 Flow History Extension - User Guide

## ?? Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Azure AD App Setup](#azure-ad-app-setup)
5. [Extension Configuration](#extension-configuration)
6. [Using the Extension](#using-the-extension)
7. [Understanding the Interface](#understanding-the-interface)
8. [Features Explained](#features-explained)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Overview

The **Dynamics 365 Flow History Extension** (Flow Monitor) is a Chrome browser extension that helps you quickly view Power Automate cloud flows related to the current Dynamics 365 record you're viewing.

### What Can It Do?

- ?? **Find flows triggered by** the current entity (e.g., when a Contact is created/modified)
- ?? **Find flows that update** the current entity
- ?? **Find flows that read** the current entity
- ?? **View run history** for any flow
- ?? **Search runs for the specific record** you're viewing
- ? **Find failed runs** quickly for troubleshooting

---

## Prerequisites

Before using this extension, you need:

1. ? **Google Chrome browser** (or Chromium-based browser like Edge)
2. ? **Access to a Dynamics 365 environment** (CRM)
3. ? **Access to Power Automate** in the same environment
4. ? **An Azure AD App Registration** (see [Azure AD App Setup](#azure-ad-app-setup))

---

## Installation

### Option 1: Install from Chrome Web Store (Recommended)
1. Go to the Chrome Web Store listing (link TBD)
2. Click **"Add to Chrome"**
3. Confirm by clicking **"Add extension"**

### Option 2: Install from Source (Developer Mode)
1. Download or clone the extension files to a folder on your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the folder containing the extension files (with `manifest.json`)
6. The extension icon should appear in your toolbar

---

## Azure AD App Setup

The extension requires an Azure AD App Registration to authenticate with Power Automate APIs. Follow these steps:

### Step 1: Create the App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** ? **App registrations**
3. Click **"+ New registration"**
4. Fill in the details:
   - **Name:** `Flow History Extension` (or any name you prefer)
   - **Supported account types:** Choose based on your needs:
     - *Single tenant* - Only your organization
     - *Multitenant* - Any Azure AD organization
   - **Redirect URI:** Leave blank for now
5. Click **"Register"**

### Step 2: Get Your Application (Client) ID

1. After registration, you'll see the **Overview** page
2. Copy the **Application (client) ID** - you'll need this later
3. If using single-tenant, also copy the **Directory (tenant) ID**

### Step 3: Configure Redirect URI

1. In your App Registration, go to **Authentication**
2. Click **"+ Add a platform"**
3. Select **"Single-page application"** (SPA)
4. For the Redirect URI, enter:
   ```
   https://<extension-id>.chromiumapp.org/
   ```
   > **How to find your extension ID:**
   > 1. Go to `chrome://extensions/`
   > 2. Find "Dynamics 365 Flow History"
   > 3. Copy the ID shown (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
   > 4. Your redirect URI will be: `https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`

5. Click **"Configure"**

### Step 4: Configure API Permissions

1. In your App Registration, go to **API permissions**
2. Click **"+ Add a permission"**
3. Select **"APIs my organization uses"**
4. Search for **"Power Automate"** or **"Microsoft Flow Service"**
5. Select it, then choose **Delegated permissions**
6. Check **"User"** or **"Flows.Read.All"** (if available)
7. Click **"Add permissions"**
8. **(Optional)** Click **"Grant admin consent"** if you have admin rights

### Step 5: Enable Implicit Grant (if needed)

1. Go to **Authentication**
2. Under **Implicit grant and hybrid flows**, check:
   - ? **Access tokens**
   - ? **ID tokens**
3. Click **"Save"**

---

## Extension Configuration

### First-Time Setup

1. Click the **Flow History Extension icon** in Chrome toolbar
2. You'll be prompted to enter your Azure AD credentials
3. Enter:
   - **Client ID:** The Application (client) ID from Azure AD
   - **Tenant ID:** (Optional) Your Directory (tenant) ID, or leave as `common` for multi-tenant
4. Click **"Save Settings"**

### Accessing Settings Later

**Option 1: Via Popup**
1. Click the extension icon
2. Click the **?? gear icon** in the top-right corner

**Option 2: Via Chrome Settings**
1. Right-click the extension icon
2. Select **"Options"**

---

## Using the Extension

### Step 1: Navigate to a Dynamics 365 Record

1. Open your Dynamics 365 environment in Chrome
2. Navigate to any record (e.g., a Contact, Account, Opportunity, etc.)
3. Make sure you're on the **record form** (not a list view)

### Step 2: Open Flow Monitor

**Option 1: Click the Extension Icon**
1. Click the **Flow History Extension icon** in your toolbar
2. Click **"Launch Flow Monitor"**

**Option 2: Direct Click (if configured)**
1. Simply click the extension icon while on a Dynamics record
2. The panel will open automatically

### Step 3: View Related Flows

The extension panel opens on the right side of your screen showing:

1. **Header:** Current entity name and record ID
2. **Tabs:** Three categories of flows
3. **Flow Cards:** Individual flows with action buttons

---

## Understanding the Interface

### Header Section
```
???????????????????????????????????????
?  ?? Flow Monitor              [X]   ?
?  Entity: contact | ID: abc-123...   ?
???????????????????????????????????????
```
- Shows the current **entity type** and **record ID**
- Click **X** to close the panel

### Tab Navigation
```
??????????????????????????????????????????????
? Triggered By ? Modified By  ?   Read By    ?
?     (5)      ?     (3)      ?     (2)      ?
??????????????????????????????????????????????
```

| Tab | Description |
|-----|-------------|
| **Triggered By** | Flows that start when this entity is created/modified/deleted |
| **Modified By** | Flows that update/modify this entity |
| **Read By** | Flows that retrieve/read this entity |

### Toolbar
```
???????????????????????????????????????
? Status: [All ?]   [?? Search flows] ?
???????????????????????????????????????
```
- **Status Filter:** Show All, Active only, or Draft only
- **Search:** Filter flows by name

### Flow Card
```
???????????????????????????????????????
? My Flow Name                [Active]?
? [System] [Create or Update]         ?
?                                     ?
? ?? Open in Maker                    ?
? ?????????????? ??????????????       ?
? ?Recent Runs ? ?This Record ?       ?
? ?????????????? ??????????????       ?
? ?????????????? ??????????????       ?
? ?Recent Failed? ?Failed(This)?       ?
? ?????????????? ??????????????       ?
???????????????????????????????????????
```

---

## Features Explained

### ?? Open in Maker
Click **"?? Open in Maker"** to open the flow in Power Automate portal where you can view/edit the flow definition.

### ?? Recent Runs
Shows the **most recent runs** for this flow (not filtered by record).
- Quick overview of flow activity
- Shows status (Succeeded/Failed/Running)
- Click any run to open in Power Automate

### ?? This Record
**Searches all runs** to find those related to the **specific record** you're viewing.
- Uses streaming - results appear as they're found
- Checks trigger data and action inputs
- May take time for flows with many runs
- Click **"Stop Search"** to cancel

### ?? Recent Failed
Shows **recent failed runs** for this flow (not filtered by record).
- Quick way to find errors
- Useful for troubleshooting

### ?? Failed (This)
Searches for **failed runs related to this specific record**.
- Combines record filtering with failure filtering
- Best for troubleshooting issues with a specific record

---

## Troubleshooting

### "Client ID not configured" Error

**Problem:** The extension doesn't have Azure AD credentials.

**Solution:**
1. Click the gear icon or go to extension options
2. Enter your Azure AD Client ID
3. Enter Tenant ID if using single-tenant app
4. Save and retry

### "AADSTS50194" Error

**Problem:** The tenant doesn't allow the requested operation.

**Solution:**
1. Make sure you entered the correct **Tenant ID**
2. For single-tenant apps, use your specific tenant ID (not "common")
3. Verify the app is registered in your tenant

### "401 Unauthorized" Errors

**Problem:** Authentication token is invalid or expired.

**Solution:**
1. The extension will automatically retry with a fresh token
2. If it persists, try signing in again
3. Check that your Azure AD app has correct API permissions

### Panel Not Updating When Navigating

**Problem:** The flow list doesn't refresh when you navigate to a different record.

**Solution:**
1. The panel should auto-refresh within 1-2 seconds
2. If not, close and reopen the panel
3. Make sure you're on a record form (not a list view)

### No Flows Found

**Problem:** All tabs show "No flows found."

**Possible Causes:**
1. There are no cloud flows in your environment
2. No flows are related to this entity type
3. Status filter is set incorrectly (try "All")
4. You don't have permission to view the flows

### Buttons Appear Frozen

**Problem:** Buttons don't respond to clicks.

**Solution:**
1. Buttons show loading states during operations
2. Wait for the operation to complete
3. If stuck, close and reopen the panel

---

## FAQ

### Q: Does this extension store my credentials?
**A:** The extension stores your Azure AD Client ID and Tenant ID locally in Chrome storage. Your actual Microsoft account credentials are never stored - authentication is handled securely through Chrome's Identity API.

### Q: Can other users see my flows?
**A:** The extension shows flows based on your Dataverse/Power Automate permissions. You'll only see flows you have access to view.

### Q: Does this work with on-premises Dynamics?
**A:** No, this extension only works with Dynamics 365 Online (cloud) environments.

### Q: Can I use this with multiple environments?
**A:** Yes! The extension automatically detects the current environment. Your Azure AD app should be configured as multi-tenant, or you'll need to register it in each tenant.

### Q: Why do I need to create my own Azure AD app?
**A:** This ensures you have full control over the authentication and permissions. It also means the extension doesn't have any backend server - everything runs locally in your browser.

### Q: Is my data sent to any external servers?
**A:** No. The extension only communicates with:
- Microsoft's Azure AD (for authentication)
- Power Automate API (for flow data)
- Your Dynamics 365 environment (for record context)

No data is sent to any third-party servers.

### Q: How do I uninstall the extension?
**A:** 
1. Go to `chrome://extensions/`
2. Find "Dynamics 365 Flow History"
3. Click **"Remove"**
4. Confirm removal

### Q: Can I use this in Microsoft Edge?
**A:** Yes! Edge is Chromium-based, so this extension works in Edge. Install it the same way using Edge's extension management.

---

## Support

If you encounter issues not covered in this guide:

1. Enable **Debug Mode** (for developers):
   - Set `DEBUG = true` in `background.js` and `main_world_script.js`
   - Check browser console (F12 ? Console) for detailed logs

2. Check the following documentation files:
   - `TESTING_GUIDE.md` - Comprehensive testing checklist
   - `PRODUCTION_READY_CHANGES.md` - Technical change log

---

## Version History

| Version | Changes |
|---------|---------|
| 2.2 | Production-ready release with all security and performance fixes |
| 2.1 | Initial version |

---

## Quick Reference Card

| Action | How To |
|--------|--------|
| Open Flow Monitor | Click extension icon on Dynamics 365 record |
| View triggered flows | Click "Triggered By" tab |
| View modifying flows | Click "Modified By" tab |
| View reading flows | Click "Read By" tab |
| Search flows | Type in search box |
| Filter by status | Use Status dropdown |
| View recent runs | Click "Recent Runs" button |
| Find runs for this record | Click "This Record" button |
| View failed runs | Click "Recent Failed" button |
| Find failures for this record | Click "Failed (This)" button |
| Open flow in maker | Click "?? Open in Maker" link |
| Configure settings | Click gear icon or right-click ? Options |
| Close panel | Click X in header |

---

*Dynamics 365 Flow History Extension v2.2*
*User Guide - Last Updated: 2024*
