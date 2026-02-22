# Testing Guide - Dynamics 365 Flow History Extension v2.2

## Quick Start Testing

### 1. Load Extension in Chrome
```
1. Open Chrome and go to: chrome://extensions/
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the extension folder: D:\Flow History Extension\FlowHistoryExtension\
5. Verify extension appears with version 2.2
```

### 2. Initial Configuration Test
```
1. Click extension icon in Chrome toolbar
2. Verify popup appears
3. If no configuration exists, should see Settings view
4. Try saving WITHOUT entering Client ID
   ? Should show error: "Client ID is required"
5. Try entering invalid Client ID: "test123"
   ? Should show error: "Invalid Client ID format"
6. Enter valid Client ID: "12345678-1234-1234-1234-123456789abc"
7. Try invalid Tenant ID: "invalid"
   ? Should show error: "Invalid Tenant ID. Use 'common' or a valid GUID."
8. Leave Tenant ID empty or enter "common"
9. Click Save Settings
   ? Button should show "Saving..." and be disabled
   ? Should show success message
   ? Should auto-redirect to launch view after 800ms
```

### 3. Settings Page Test
```
1. Right-click extension icon ? Options
2. Verify settings.html loads correctly
3. Test same validation as above
4. Verify saved values persist after page reload
```

### 4. Dynamics 365 Integration Test
```
1. Navigate to a Dynamics 365 environment (*.crm.dynamics.com)
2. Open any record (e.g., Account, Contact, Opportunity)
3. Click extension icon
4. Verify popup shows launch view (not settings)
5. Verify button says "Open Flow Monitor" (not "Only for Dynamics 365")
6. Click "Open Flow Monitor"
   ? Button should show "Opening..." and be disabled
   ? Panel should appear on right side of screen
```

### 5. Main Panel Test
```
1. Verify panel header shows:
   - Title: "Flow Monitor"
   - Current entity name
   - Current record ID (without braces)
   - Close button (×)

2. Verify three tabs appear:
   - Triggered By (active by default)
   - Modified By
   - Read By

3. Verify toolbar shows:
   - Status filter (All/Active/Draft)
   - Search input field

4. Wait for flows to load
   ? Should show "Scanning..." initially
   ? Should populate with flows or show "No flows found"
```

### 6. Flow Card Test
For each flow card, verify:

```
1. Flow name and status displayed
2. Change type or operation details shown
3. System flows marked with yellow "System" pill
4. Active flows marked with green pill

5. Four buttons present:
   - "? Recent Runs" (gray outline)
   - "? This Record" (green)
   - "? Recent Failed" (red outline)
   - "?? Failed (This)" (red)
```

### 7. Recent Runs Button Test
```
1. Click "? Recent Runs" button on any flow
   ? Button should disable and show "? Loading..."
   ? Run list should appear below card
   ? Button should re-enable after load
   ? Should show up to 50 recent runs from Dataverse
2. Click same button again
   ? Should toggle (hide) the run list
```

### 8. Record-Specific Runs Test (Streaming)
```
1. Click "? This Record" button
   ? Button should disable and show "? Starting..."
   ? Should show streaming UI with:
     - Progress text: "Initializing search..."
     - Settings gear icon (?)
     - Stop Search button (red)
   ? Button re-enables after stream starts

2. Watch progress
   ? Should update: "Scanned X runs..."
   ? Should find relevant runs and display them
   ? Should show "Search complete" when done

3. Test Stop button
   ? Should disable and show "Stopping..."
   ? Should halt the search
   ? Should show "Search stopped by user"
```

### 9. Navigation Test (Context Refresh)
```
1. With panel open, navigate to a different record
2. Wait up to 1.5 seconds (1s poll + 500ms debounce)
   ? Header should update with new entity/ID
   ? All tabs should show "Rescanning..."
   ? Flow lists should refresh for new record

3. Navigate back to home/grid (no record)
   ? Header should show "No Record Selected" and "—"
   ? Tabs should show "Please open a record to view flows."
```

### 10. Cleanup Test (Memory Leak Prevention)
```
1. Open panel on a Dynamics record
2. Click close button (×)
   ? Panel should remove from DOM
   ? Navigation poller should stop (no more console activity)

3. Re-open panel
   ? Should work normally
   ? Fresh poller should start
```

### 11. Filter & Search Test
```
1. Change Status filter:
   - Select "Active"
     ? Should show only active flows
   - Select "Draft"
     ? Should show only draft flows
   - Select "All"
     ? Should show all flows

2. Use search box:
   - Type partial flow name
     ? Should filter flows in real-time
     ? Should update count badges: "Triggered By (X)"
   - Clear search
     ? Should show all flows again
```

### 12. OAuth Error Recovery Test
```
1. With panel open, manually clear Chrome identity cache:
   - Open DevTools ? Application ? Storage ? Clear site data

2. Click "? This Record" button
   ? If auth fails, should show inline config form
   ? Should pre-fill existing Client/Tenant ID
   ? "Save & Retry" button should work
   ? Should re-attempt streaming after save

OR manually test gear (?) button:
   ? Should show config form
   ? Cancel button should restart stream
```

### 13. Button State Test (Double-Click Prevention)
```
1. Click "? Recent Runs" button rapidly 3 times
   ? Should only execute once
   ? Button should be disabled during load
   ? Should re-enable after completion

2. Same test for all 4 buttons on each card
   ? All should prevent double-click
   ? All should show loading state
   ? All should restore original state
```

### 14. Error Handling Test
```
1. Test with invalid environment (no network)
   ? Should show error message
   ? Should not crash
   ? Should allow retry

2. Test with invalid record ID
   ? Should handle gracefully
   ? Should show empty results or error

3. Test on non-Dynamics page (e.g., google.com)
   ? Popup should show "Only for Dynamics 365"
   ? Launch button should be disabled
```

---

## Debug Mode Testing

### Enable Debug Logs
```javascript
// In background.js (line 2):
const DEBUG = true;

// In main_world_script.js (line 2):
const DEBUG = true;
```

### With DEBUG = true, verify:
```
1. Open DevTools Console (F12)
2. Perform actions in extension
3. Check console for detailed logs:
   - "Background: Fetching with token..."
   - "Background: Response status 200"
   - "Flow History: Context Updated..."
   - "Flow History: Found X trigger flows..."
   - etc.
```

### Production Mode (DEBUG = false)
```
1. Set both DEBUG flags to false
2. Reload extension
3. Perform same actions
4. Verify NO console logs appear
   ? Only errors should appear (console.error)
   ? User-facing messages should still work
```

---

## Performance Benchmarks

### Expected Metrics
| Scenario | Expected Time | Max Acceptable |
|----------|---------------|----------------|
| Panel open | < 2 seconds | 5 seconds |
| Fetch 500 flows | < 3 seconds | 8 seconds |
| Recent runs load | < 1 second | 3 seconds |
| Navigation refresh | < 2 seconds | 5 seconds |
| Search filter | < 100ms | 500ms |

---

## Known Limitations (Not Bugs)
1. **500 workflow limit** - Dataverse API limitation
2. **250 runs per page** - Power Automate API limitation
3. **1-second navigation polling** - Balance between responsiveness and performance
4. **Trigger output inspection** - Additional API call per run (slower but accurate)

---

## Browser Compatibility
? **Tested & Supported:**
- Chrome 100+
- Edge 100+

?? **Not Tested:**
- Firefox (different extension API)
- Safari (different extension API)
- Older Chrome versions (< 100)

---

## Passing Criteria
Extension is production-ready if:
- ? All 14 test sections pass
- ? No console errors in production mode (DEBUG = false)
- ? No memory leaks (poller cleanup verified)
- ? All buttons have proper loading states
- ? All inputs have validation
- ? OAuth retry works automatically
- ? Navigation context updates correctly

---

## Test Report Template

```
TESTER: _______________
DATE: _______________
VERSION: 2.2

[ ] 1. Load Extension - PASS / FAIL
[ ] 2. Initial Configuration - PASS / FAIL
[ ] 3. Settings Page - PASS / FAIL
[ ] 4. Dynamics Integration - PASS / FAIL
[ ] 5. Main Panel - PASS / FAIL
[ ] 6. Flow Cards - PASS / FAIL
[ ] 7. Recent Runs - PASS / FAIL
[ ] 8. Record-Specific Runs - PASS / FAIL
[ ] 9. Navigation - PASS / FAIL
[ ] 10. Cleanup - PASS / FAIL
[ ] 11. Filter & Search - PASS / FAIL
[ ] 12. OAuth Recovery - PASS / FAIL
[ ] 13. Button States - PASS / FAIL
[ ] 14. Error Handling - PASS / FAIL

NOTES:
_________________________________
_________________________________
_________________________________

RECOMMENDATION: APPROVE / NEEDS FIXES
```

---

*Happy Testing!* ??
