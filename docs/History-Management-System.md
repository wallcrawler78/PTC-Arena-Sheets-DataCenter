# Rack History Management System

## Overview
The Rack History Management System provides centralized tracking, status monitoring, and audit logging for all rack configurations in the Arena Data Center tool. This system replaces the previous Row 1 metadata approach with a dedicated History tab that serves as the single source of truth for rack status and lifecycle events.

## Key Features

### 1. Centralized History Tab
- **Single source of truth** for all rack metadata
- **Summary section** showing current status of all racks at a glance
- **Detail section** with chronological event log for audit trail
- **Protected sheet** prevents accidental user edits
- **Auto-filtering** sidebar for easy navigation

### 2. Visual Status Indicators
All racks display emoji indicators in their tab names showing current sync status:
- 🟢 **SYNCED** - Rack matches Arena exactly
- 🟡 **ARENA_MODIFIED** - Arena has changes not yet pulled to sheet
- 🟠 **LOCAL_MODIFIED** - Sheet has local edits not yet pushed to Arena
- 🔴 **PLACEHOLDER** - Rack created locally but not yet in Arena
- ❌ **ERROR** - Last sync operation failed

### 3. Automatic Status Updates
Status indicators automatically update when:
- Running "Check all Rack Status (vs. PDM)"
- Performing BOM refresh operations
- Pushing BOMs to Arena
- Creating new rack configurations

### 4. History Filter Sidebar
Interactive sidebar (auto-opens when viewing History tab) provides:
- **Rack selector** dropdown to filter history by specific rack
- **Quick Stats** panel showing count of racks by status
- **Help documentation** with ? icon
- **Apply/Clear filter** controls

### 5. Data Integrity Tools
Advanced features for maintaining data quality:
- **Validate History Integrity** - Checks for missing/orphaned/invalid data
- **Repair History Issues** - Auto-fixes common problems
- **Protection** - Sheet-level protection prevents manual editing

## Architecture

### History Tab Structure

#### Summary Section (Rows 1-N)
Frozen at top, shows one row per rack:
- Rack Item#
- Rack Name
- Current Status (with emoji)
- Arena GUID
- Created Date
- Last Refresh
- Last Sync
- Last Push
- BOM Checksum

#### Detail Section (Rows N+1 onward)
Scrollable event log with columns:
- Timestamp
- Rack Item#
- Event Type
- User
- Status Before
- Status After
- Changes Summary
- Details
- Link (to rack sheet)

### Event Types
The system logs the following events:
- `RACK_CREATED` - New rack configuration created
- `STATUS_CHANGE` - Rack status updated
- `LOCAL_EDIT` - User edited rack BOM
- `REFRESH_ACCEPTED` - User accepted Arena BOM refresh
- `REFRESH_DECLINED` - User declined Arena BOM refresh
- `REFRESH_NO_CHANGES` - BOM refresh showed no changes
- `POD_PUSH` - Rack included in POD push to Arena
- `BOM_PULL` - BOM pulled from Arena
- `MANUAL_SYNC` - User manually marked as synced
- `BATCH_CHECK` - Status check ran
- `ERROR` - Error occurred
- `CHECKSUM_MISMATCH` - BOM checksum didn't match
- `MIGRATION` - Migrated from old metadata system

### Status Constants
```javascript
var RACK_STATUS = {
  PLACEHOLDER: 'PLACEHOLDER',      // Created locally, not yet in Arena
  SYNCED: 'SYNCED',               // Matches Arena exactly
  LOCAL_MODIFIED: 'LOCAL_MODIFIED', // User edited after sync
  ARENA_MODIFIED: 'ARENA_MODIFIED', // Arena changed externally
  ERROR: 'ERROR'                   // Last sync failed
};
```

## Implementation Details

### Migration from Row 1 Metadata
The system provides migration functions to move from the deprecated Row 1 metadata storage:
1. `migrateRackMetadataToHistory()` - Moves metadata from Row 1 to History tab
2. `clearOldRackMetadata()` - Removes old Row 1 metadata (run after verification)

### Key Functions

#### History Management
- `getOrCreateRackHistoryTab()` - Gets/creates History tab with proper formatting
- `createRackHistorySummaryRow()` - Adds new rack to summary section
- `updateRackHistorySummary()` - Updates rack metadata
- `addRackHistoryEvent()` - Logs event to detail section
- `filterHistoryByRack()` - Applies auto-filter for specific rack

#### Status Functions
- `getRackStatusFromHistory()` - Reads current status from History tab
- `updateRackSheetStatus()` - Updates status and logs event
- `updateRackTabName()` - Updates tab name with emoji indicator
- `checkAllRackStatuses()` - Batch check all racks against Arena

#### Integrity Functions
- `validateHistoryTabIntegrity()` - Checks for data issues
- `repairHistoryTabIntegrity()` - Auto-fixes problems
- `protectHistoryTab()` - Applies sheet protection

### Status Checking Logic
When checking rack status against Arena:
1. **PLACEHOLDER** racks are skipped (no Arena GUID)
2. **SYNCED/ARENA_MODIFIED/LOCAL_MODIFIED** racks are checked:
   - Fetch Arena BOM via API
   - Compare with sheet BOM
   - If changes detected:
     - Check local BOM checksum
     - If checksum changed → LOCAL_MODIFIED
     - If checksum unchanged → ARENA_MODIFIED
   - If no changes → SYNCED

### BOM Checksum Algorithm
Simple concatenation of item numbers and quantities:
```javascript
"ITEM-001:2|ITEM-002:1|ITEM-003:4"
```
Stored in History tab, used to detect local vs Arena changes.

## User Workflows

### Viewing Rack History
1. Click **Arena Data Center > BOM Operations > View Rack History**
2. History tab opens with sidebar auto-displayed
3. Use dropdown to select specific rack
4. Click "Apply Filter" to show only that rack's events
5. Click "Clear Filter" to show all events

### Checking Rack Status
1. Click **Arena Data Center > BOM Operations > Check all Rack Status (vs. PDM)**
2. System checks all racks against Arena
3. Tab indicators automatically update
4. Results dialog shows count by status
5. History tab updated with check events

### Handling Out-of-Sync Racks
When a rack shows 🟡 (Arena Modified):
1. Open the rack sheet
2. Right-click to see "Refresh BOM from Arena" option
3. Review proposed changes in diff dialog
4. Accept or decline changes
5. Status updates to 🟢 if accepted

### Handling Locally Modified Racks
When a rack shows 🟠 (Local Modified):
1. User has made edits to rack BOM
2. Push BOMs to Arena to sync changes
3. Or use "Refresh BOM" to discard local changes

## Technical Notes

### Performance Optimizations
- **Dynamic freeze point** - Freezes summary section + separator + detail header
- **Direct cell reads** - Stats read directly from column C instead of complex lookups
- **Caching** - Sidebar auto-open uses session cache (6 hour TTL)
- **Batch operations** - Status checks use batch API calls

### Error Handling
- All History functions use try/catch with logging
- Protection failures are logged but don't block operations
- Missing racks are auto-added during integrity repair
- Invalid status values are flagged during validation

### Data Integrity Safeguards
1. **Sheet Protection** - Prevents accidental edits
2. **Validation** - Checks for orphaned/missing data
3. **Repair** - Auto-fixes common issues
4. **Single Source of Truth** - All status reads from History tab
5. **Emoji Stripping** - Robust regex to handle status values with/without emojis

## Recent Bug Fixes

### Status Reading Fix (2025-11-16)
**Problem:** PLACEHOLDER racks showing as errors during status check.

**Root Cause:** Status values stored as "🔴 PLACEHOLDER" but emoji stripping didn't trim whitespace, causing comparison failures.

**Fix:** Added `.trim()` and global regex flag to properly clean status strings.

### Tab Indicator Fix (2025-11-16)
**Problem:** PLACEHOLDER racks not getting red dot (🔴) indicators.

**Root Cause:** Status check correctly identified placeholders but returned early without calling `updateRackTabName()`.

**Fix:** Added `updateRackTabName()` call for PLACEHOLDER racks before skipping Arena check.

### Actions Column Removal (2025-11-16)
**Problem:** Non-functional "View" text in column J was confusing.

**Resolution:** Removed Actions column entirely - users can click rack rows or use filter sidebar instead.

## Configuration

### History Tab Constants
```javascript
// Summary section columns
var HIST_SUMMARY_ITEM_NUM_COL = 1;      // A: Rack Item#
var HIST_SUMMARY_RACK_NAME_COL = 2;     // B: Rack Name
var HIST_SUMMARY_STATUS_COL = 3;        // C: Current Status
var HIST_SUMMARY_ARENA_GUID_COL = 4;    // D: Arena GUID
var HIST_SUMMARY_CREATED_COL = 5;       // E: Created Date
var HIST_SUMMARY_LAST_REFRESH_COL = 6;  // F: Last Refresh
var HIST_SUMMARY_LAST_SYNC_COL = 7;     // G: Last Sync
var HIST_SUMMARY_LAST_PUSH_COL = 8;     // H: Last Push
var HIST_SUMMARY_CHECKSUM_COL = 9;      // I: BOM Checksum

// Detail section columns
var HIST_DETAIL_TIMESTAMP_COL = 1;      // A: Timestamp
var HIST_DETAIL_RACK_COL = 2;           // B: Rack Item#
var HIST_DETAIL_EVENT_TYPE_COL = 3;     // C: Event Type
var HIST_DETAIL_USER_COL = 4;           // D: User
var HIST_DETAIL_STATUS_BEFORE_COL = 5;  // E: Status Before
var HIST_DETAIL_STATUS_AFTER_COL = 6;   // F: Status After
var HIST_DETAIL_SUMMARY_COL = 7;        // G: Changes Summary
var HIST_DETAIL_DETAILS_COL = 8;        // H: Details
var HIST_DETAIL_LINK_COL = 9;           // I: Link
```

### Color Scheme
- **History Tab Color:** Purple (#9c27b0) - distinct from rack tabs
- **Summary Header:** Blue (#1a73e8)
- **Detail Header:** Green (#34a853)
- **Separator Row:** Gray (#f0f0f0)
- **Metadata Row (D1):** Blue background (#e8f0fe)

## Future Enhancements

### Potential Features
- Export history to CSV/JSON
- Archive old events (date range filtering)
- Restore previous rack state from history
- Batch status updates for multiple racks
- Email notifications for status changes
- History comparison between two time points
- Undo/redo for BOM changes

### Performance Improvements
- Lazy loading for large history logs
- Pagination in detail section
- Background status checking
- Delta sync instead of full BOM comparison

## Related Files
- `HistoryManager.gs` - Core history management functions
- `HistoryFilterSidebar.html` - Filter UI
- `StatusManager.gs` - Status tracking and tab indicators
- `RackConfigManager.gs` - Rack creation/metadata
- `Code.gs` - Menu integration

## See Also
- [Status Indicator Feature](Status-Indicator-Feature.md)
- [BOM Position Attribute Feature](BOM-Position-Attribute-Feature.md)
- [Architecture Overview](ARCHITECTURE.md)
