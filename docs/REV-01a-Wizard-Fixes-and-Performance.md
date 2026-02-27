# REV-01a: POD Wizard Bug Fixes & Performance Optimization

**Date:** 2026-02-27
**Files changed:** BOMBuilder.gs, PODPushWizard.html, HistoryManager.gs, Code.gs

---

## Overview

Post-REV-01 fixes addressing three issues found during testing:
1. History Filter sidebar not auto-opening when navigating to the Rack History tab
2. BOM Change Preview section showing empty (Stage 3 of POD Push Wizard)
3. Rows incorrectly showing "NEW" status (and GUID as name) in Step 2 of the wizard
4. POD Push Wizard taking ~90 seconds to load (performance optimization)

---

## Fix 1 — History Sidebar Auto-Open

### Root cause
Google Apps Script **simple triggers** (`onSelectionChange`, `onOpen`, etc.) cannot open
sidebars or dialogs — this is a hard platform restriction. The previous attempt to open the
sidebar from `onSelectionChange` failed silently.

### Solution
**Installable triggers** registered via `ScriptApp.newTrigger()` CAN open sidebars.

**HistoryManager.gs** — added `_ensureHistoryAutoOpenTrigger()`:
- Called from `showHistoryFilterSidebar()` (which runs in an authorized context when the
  user clicks the menu item)
- Checks for an existing `onSelectionChangeInstallable` trigger before creating one
- Safe to call repeatedly

**Code.gs** — added `onSelectionChangeInstallable(e)`:
- The actual handler for the installable trigger
- Detects transition TO the Rack History tab and opens the sidebar
- Simple `onSelectionChange` now only tracks sheet state (no sidebar attempt)

**Activation:** The first time the user opens the History Filter via the menu, the installable
trigger is silently registered. All subsequent tab navigations to Rack History auto-open the sidebar.

---

## Fix 2 — BOM Change Preview Empty

### Root cause
`renderBOMPreview()` in `PODPushWizard.html` calls `escapeHtml()` throughout, but
`escapeHtml` was never defined in that file. This caused a `ReferenceError` on the
first iteration of the row loop, before any HTML was written. Because the function
had no try/catch, the error propagated silently and `preview.innerHTML` was never set,
leaving the div completely empty.

### Solution
**PODPushWizard.html:**
- Added `escapeHtml(str)` function in the script section (before `nextStage()`)
- Wrapped `renderBOMPreview()` in a try/catch that displays the error message in the
  div instead of leaving it blank

---

## Fix 3 — Rows Showing "NEW" with GUID Names

### Root cause
After a POD push, the overview sheet stores Arena **GUIDs** in the Row Item column
(not human-readable item numbers). The wizard called `client.getItemByNumber(GUID)`,
which:
1. Did not find the GUID in the item cache (cache is keyed by item number)
2. Called `refreshItemCache()` to fetch all Arena items — a slow operation
3. Still didn't find the GUID after refresh (GUIDs aren't in that cache)
4. Called `refreshItemCache()` a second time ("force refresh")
5. Returned `null` → `rowExists = false` → "NEW" badge shown

With 8 rows, this caused **16 unnecessary `refreshItemCache()` calls** — the root
cause of the ~90-second wizard load time.

### Solution
**BOMBuilder.gs:**
- Added `_looksLikeArenaGuid(s)` helper: detects GUID-shaped strings (`/^[A-Z0-9]{15,25}$/`)
- Row lookup now skips `getItemByNumber` for GUID identifiers, going straight to a
  direct `client.getItem(guid)` call
- Push flow (`executeStructuredPush`) updated to use `row.guid` from wizard data
  directly if available, skipping a redundant API call

---

## Fix 4 — Performance: Parallel API Calls in Wizard

### Root cause
`preparePODWizardDataForModal()` made all API calls sequentially:
- 2 rack existence checks (~800ms in cache if warm)
- 2 rack BOM fetches (~800ms serial)
- 8 row lookups with GUID fallback (~4-8 seconds with 2 refreshes each)
- 1 POD lookup (~400ms)

Total: ~90 seconds worst case (GUID rows causing cache thrash).

### Solution
**BOMBuilder.gs** — restructured `preparePODWizardDataForModal()`:

#### New helpers added (before `_computeWizardBOMDiff`):
```javascript
_looksLikeArenaGuid(s)          // Regex: /^[A-Z0-9]{15,25}$/
_buildWizardFetchRequest(client, endpoint)  // Builds request object for fetchAll()
```

#### Phase 3 — Parallel rack BOM fetches:
```javascript
// Before: serial loop (400ms × N racks)
existingRacks.forEach(rack => { client.makeRequest('/items/{guid}/bom', GET); });

// After: one parallel batch
var bomFetchRequests = existingRackMeta.map(rack => _buildWizardFetchRequest(client, '/items/{guid}/bom'));
var bomResponses = UrlFetchApp.fetchAll(bomFetchRequests);
```

#### Phase 5 — Parallel row GUID fetches:
```javascript
// Before: getItemByNumber(GUID) per row → 2 refreshItemCache() calls each

// After: detect GUIDs first, batch fetch in parallel
var guidFetchRequests = guidRows.map(guid => _buildWizardFetchRequest(client, '/items/{guid}?responseview=full'));
var guidRowResponses = UrlFetchApp.fetchAll(guidFetchRequests);
```

### Expected performance improvement

| Operation | Before | After |
|-----------|--------|-------|
| Row GUID lookups (8 rows) | ~64s (16 refreshItemCache calls) | ~0.5s (1 parallel batch) |
| Rack BOM fetches (2 racks) | ~0.8s serial | ~0.4s parallel |
| Cache warmup (racks) | ~2s (triggered once) | ~2s (unchanged) |
| **Total** | **~90s** | **~5-8s** |

---

## Verification Checklist

1. **History auto-open**: Open the History Filter via the menu once. Then click away and back to Rack History tab → sidebar should auto-open
2. **BOM Change Preview**: Open POD Push Wizard, advance to Step 3 → colored diff rows (ADD/CHG/REM) visible, no empty section
3. **Row status**: Step 2 shows correct "EXISTS" badges for rows that were previously pushed, with actual Arena item names (not GUIDs)
4. **Performance**: Wizard should load in ~5-10 seconds (vs ~90 seconds before)
