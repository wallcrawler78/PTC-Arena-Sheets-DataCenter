# REV-01: Revision Tracking, Smart Sync & Visual Diff

**Date:** 2026-02-26
**Commit:** `9034aa7`
**Files changed:** BOMBuilder.gs, BOMRefresh.gs, BOMTreeModal.html, HistoryManager.gs, PODPushWizard.html, RackConfigManager.gs, StatusManager.gs

---

## Overview

This release adds revision number tracking to rack BOM sheets, smart diff-based BOM sync to Arena, semantic history events for ECO-driven changes, and a color-coded visual diff in Stage 3 of the POD Push Wizard.

---

## Track 1 — Revision Column in Rack BOM Sheets

### What changed
- Rack config sheets now have a **Revision** column in column G (between Qty and custom attributes).
- All rack-sheet read functions updated to read 7 columns instead of 6.
- `RackConfigManager.gs`: added `'Revision'` to the header array and column G width (80px) in `createRackConfigSheet()`.
- `RackConfigManager.gs`: `populateRackBOMFromArena()` now writes `revisionNumber` to col G.
- `BOMRefresh.gs`: `getCurrentRackBOMData()` reads 7 cols, returns `revision: row[6] || ''`.
- `StatusManager.gs`: both `getCurrentRackBOMData()` and `calculateBOMChecksum()` updated.
- `BOMBuilder.gs`: `readBOMFromSheet()` detects `Revision` column by header name.

### Checksum format change
Old: `ITEM-001:1|ITEM-002:2`
New: `ITEM-001:1:RevA|ITEM-002:2:—`

**Important:** All existing racks will show `ARENA_MODIFIED` on the first "Check All Rack Status" run after deploy. This is expected and correct — checksums will re-sync after the first check.

---

## Track 2 — Revision-Aware Comparison

### What changed
- `BOMRefresh.gs` `compareBOMs()`: Arena item map now includes `revisionNumber` extracted from full item.
- Revision comparison added after lifecycle comparison: if Arena revision differs from sheet revision, a `{ field: 'Revision', oldValue, newValue }` change entry is created.

---

## Track 3 — Semantic History Events

### What changed
- `HistoryManager.gs`: added `REVISION_CHANGE` and `LIFECYCLE_CHANGE` to `HISTORY_EVENT` constants.
- `BOMRefresh.gs` `applyBOMChanges()`: after applying field changes, iterates `entry.changes` and calls `addRackHistoryEvent()` for Revision and Lifecycle changes. Events appear in the Rack History tab.

---

## Track 4 — Smart BOM Sync

### What changed
- `BOMBuilder.gs` `syncBOMToArena()`: replaced the delete-all + post-all approach with a diff algorithm.

### Algorithm
1. Fetch existing Arena BOM → build `existingLinesByItemGuid` map
2. Build `localByItemGuid` from input `bomLines`
3. Compute: `toRemove` (in Arena, not local), `toAdd` (in local, not Arena), `toUpdate` (both, qty differs)
4. DELETE `toRemove` lines
5. PUT `toUpdate` lines (quantity only) — with automatic fallback to DELETE+POST if Arena returns 405
6. POST `toAdd` lines

### Benefits
- Preserves Arena BOM line GUIDs (important for Arena change history)
- Minimal API calls for typical pushes (1 change → 1 PUT instead of N deletes + N posts)
- Validation phase unchanged — still fails fast on missing GUIDs

---

## Track 5 — Pre-Push Visual Diff (Stage 3 POD Wizard)

### Server side (`BOMBuilder.gs`)
- New helper: `_computeWizardBOMDiff(localBOM, arenaBOMLines)` — returns `{ added, modified, removed, summary }`.
- `preparePODWizardDataForModal()`:
  - Existing racks: fetches Arena BOM, computes diff vs local sheet, attaches `rackDiff` to each entry.
  - Placeholder racks: reads local sheet, sets all items as `added` in `rackDiff`.

### Client side (`PODPushWizard.html`)
- Replaced ASCII `.bom-tree*` CSS with new `.diff-*` CSS classes.
- `renderBOMPreview()` replaced with a visual diff renderer:
  - Per-row sections with row name header
  - Per-rack section with NEW RACK / EXISTS badge and +N ~N -N summary
  - Green `ADD` / Yellow `CHG` / Red `REM` badges with item number, name, quantity
  - "No BOM changes" muted message when rack matches Arena exactly

---

## Track 6 — BOM Tree Modal Visual Polish

### What changed (`BOMTreeModal.html`)
- **Hover highlight:** rows turn `#f0f4ff` on hover
- **Striped rows:** even rows get `#fafbfc` background
- **CSS expand icon:** replaced `▶` text character with pure CSS border-triangle (`::before`), works on all OS fonts
- **Qty column alignment:** right-aligned in both header and data cells
- **Header nowrap:** prevents column header text wrapping

---

## Verification Checklist

1. **Revision column**: Open any rack BOM sheet → col G header reads "Revision", values populated after Refresh BOM From Arena
2. **Comparison**: Run "Check All Rack Status" on a rack where Arena has a newer revision → col G updates, BOM History tab shows Revision change entry
3. **History events**: Check Rack History tab for REVISION_CHANGE / LIFECYCLE_CHANGE event types after status check
4. **Smart sync**: Push BOM with 1 qty change → execution log shows "Smart BOM sync complete — removed 0, updated 1, added 0"
5. **Pre-push diff**: Open POD Push Wizard → Stage 3 shows green/yellow/red diff rows with summary badges
6. **BOM Tree Modal**: Open BOM tree → rows have hover highlight, clean CSS expand icons, stripes; expand/collapse still works
