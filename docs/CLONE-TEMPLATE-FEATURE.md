# Rack Clone & Template Feature Guide

**Version:** 1.0
**Date:** 2026-02-09
**Status:** ✅ Implemented

---

## Overview

The Clone & Template feature provides two powerful workflows for creating new rack configurations:

1. **Clone Existing Racks** - Duplicate existing rack configurations to create variants
2. **Load Arena Templates** - Import comprehensive Arena BOMs as starting points (150% configuration approach)

Both workflows create **PLACEHOLDER** status racks that can be freely edited before pushing to Arena, ensuring safe experimentation without affecting production data.

---

## Feature Summary

### What It Does
- **Clones existing rack configurations** with all BOM data and formatting preserved
- **Loads Arena item BOMs as templates** for the "options catalog" workflow
- **Creates PLACEHOLDER racks** ready for customization
- **Maintains full history tracking** of all clone/template operations
- **Provides multiple access points** (menus, tabs, inline icons) for user convenience

### Key Benefits
- **Time Savings:** No need to manually recreate similar rack configurations
- **Flexibility:** Explore comprehensive Arena BOMs without commitment
- **Risk Reduction:** Edit freely in PLACEHOLDER mode before pushing to Arena
- **Workflow Consistency:** Integrates naturally with existing rack management patterns

---

## User Workflows

### Workflow 1: Clone Existing Rack

**Use Case:** You have "Server Type A" and want to create "Server Type B" with minor changes.

**Steps:**
1. Open Rack Picker (Menu: `Arena Data Center → Show Rack Picker`)
2. Click the **Templates** tab
3. Ensure **Clone Existing** mode is selected (default)
4. Search for "Server Type A"
5. Click the clone icon ⧉ on the rack
6. In the modal:
   - **Source:** Shows "Server Type A" with component count
   - **New Item Number:** Enter `SERVER-TYPE-B`
   - **New Rack Name:** Enter `Server Type B`
   - **Description:** Auto-filled "Cloned from SERVER-TYPE-A"
7. Click **Clone Rack**
8. New PLACEHOLDER sheet created with all 20 components
9. Edit the 3 components that differ from Type A
10. Later, push to Arena to create the new item

**Result:** New rack configuration ready for editing in seconds.

---

### Workflow 2: Arena Template (150% Configuration)

**Use Case:** Arena has "SERVER-ALL-OPTIONS" with 50 components. You want to select 15 for your custom build.

**Steps:**
1. Open Rack Picker
2. Click **Templates** tab
3. Switch to **Arena Template** mode
4. Search for "SERVER-ALL-OPTIONS"
5. Click the globe icon 🌐 to load as template
6. **Preview Modal** shows:
   - Item: SERVER-ALL-OPTIONS
   - Component count: 50
   - First 5 components preview
   - Categories: Server Hardware, Storage, Memory, etc.
7. Confirm by entering:
   - **New Item Number:** `MY-CUSTOM-SERVER`
   - **New Rack Name:** `My Custom Server Build`
   - **Description:** Auto-filled
8. Click **Load Template**
9. New PLACEHOLDER sheet created with all 50 components
10. **Instruction row** at top: "⚠ Template loaded - trim before pushing"
11. Delete 35 unwanted rows (keep 15 needed)
12. Remove instruction row
13. Push to Arena as streamlined new item

**Result:** Comprehensive options loaded, trimmed to your needs, ready to push.

---

### Workflow 3: Quick Clone from Current Sheet

**Use Case:** You're viewing a rack sheet and want to quickly duplicate it.

**Steps:**
1. Open the rack configuration sheet (e.g., "Server Type A")
2. Menu: `Arena Data Center → Create Layout → Clone This Rack`
3. Prompts:
   - **New Item Number:** `SERVER-002`
   - **New Rack Name:** `Server Type B`
4. New PLACEHOLDER sheet created immediately
5. Sheet switches to new rack automatically

**Result:** Instant duplication without opening dialogs.

---

## Access Points

The clone/template functionality is accessible through **four intuitive entry points**:

### 1. Menu Items
**Location:** `Arena Data Center → Create Layout`

- **Clone Existing Rack** - Opens Rack Picker in clone mode
- **Load Arena Item as Template** - Opens Rack Picker in template mode
- **Clone This Rack** *(context-sensitive)* - Appears when viewing a rack sheet

### 2. Templates Tab (Rack Picker)
**Primary interface** for browsing and selecting racks/templates:

- **Clone Existing Mode (default):**
  - Search existing rack configurations
  - View component counts
  - Click clone icon to duplicate

- **Arena Template Mode:**
  - Browse all Arena items
  - Preview BOMs before loading
  - Load comprehensive templates

### 3. Clone Icons (Inline Actions)
**Location:** Rack Picker → Racks tab

- Clone icon ⧉ appears next to rename pencil 🖊 on each rack item
- One-click access to clone dialog
- Works from both Racks tab and Templates tab

### 4. Quick Clone Menu (Context-Sensitive)
**Location:** Menu appears only when viewing a rack sheet

- Fast duplication workflow
- Two prompts (item number, name)
- Immediately creates clone

---

## Technical Details

### Backend Implementation

**File:** `RackCloneManager.gs`

**Core Functions:**
- `cloneRackConfiguration()` - Clones existing rack config
- `createRackFromArenaTemplate()` - Loads Arena BOM as template
- `getArenaTemplateBOMPreview()` - Previews Arena BOM
- `cloneCurrentRackConfiguration()` - Quick clone from active sheet

**Helper Functions:**
- `readRackBOMData()` - Extracts BOM rows with formatting
- `copyBOMRowsToSheet()` - Writes BOM with formatting preserved
- `createRackSheetStructure()` - Creates sheet skeleton
- `applyRackTabFormatting()` - Applies colors and styling
- `insertTemplateInstructionRow()` - Adds template instruction banner
- `validateCloneInputs()` - Validates clone parameters

**UI Wrapper Functions:**
- `handleCloneRackRequest()` - Handles clone from UI
- `handleTemplateLoadRequest()` - Handles template load from UI
- `getRacksForCloning()` - Returns racks list for UI

### History Tracking

**File:** `HistoryManager.gs`

**New Event Types:**
- `HISTORY_EVENT.RACK_CLONED` - Logged when rack is cloned
- `HISTORY_EVENT.TEMPLATE_LOADED` - Logged when template is loaded

**Event Details:**
```javascript
// RACK_CLONED event
{
  changesSummary: 'Rack cloned from SOURCE-RACK',
  details: 'Cloned X components from SOURCE-RACK (Sheet Name)',
  statusAfter: 'PLACEHOLDER'
}

// TEMPLATE_LOADED event
{
  changesSummary: 'Template loaded from Arena item ITEM-NUMBER',
  details: 'Loaded X components from ITEM-NUMBER as template',
  statusAfter: 'PLACEHOLDER'
}
```

### UI Components

**File:** `RackPicker.html`

**New UI Elements:**
- **Templates Tab** - 4th tab in Rack Picker
- **Mode Switcher** - Toggle between Clone Existing / Arena Template
- **Clone Modal** - Input form for clone parameters
- **Template Preview Modal** - Shows BOM preview with component list
- **Clone Icons** - SVG icon added to icon definitions
- **Template Icon** - SVG icon for template mode

**JavaScript Functions:**
- `switchTab('templates')` - Activates Templates tab
- `loadTemplatesTab()` - Initializes Templates tab
- `switchTemplateMode(mode)` - Switches between clone/template modes
- `loadCloneRacks()` - Fetches racks for cloning
- `loadTemplateItems()` - Fetches Arena items for templates
- `displayCloneRacks()` - Renders clone rack list
- `displayTemplateItems()` - Renders template item list
- `filterCloneRacks()` - Filters clone list by search
- `filterTemplateItems()` - Filters template list by search
- `openCloneDialog()` - Opens clone modal
- `closeCloneDialog()` - Closes clone modal
- `submitClone()` - Submits clone request
- `openTemplatePreviewDialog()` - Opens template preview
- `closeTemplatePreviewDialog()` - Closes template preview
- `submitTemplateLoad()` - Submits template load request

---

## Status Management

### PLACEHOLDER Status
All cloned and template-loaded racks are created with **PLACEHOLDER** status.

**Why PLACEHOLDER?**
- **Cloned Racks:** Even if source is SYNCED, the clone is a new entity not yet in Arena
- **Template Racks:** Loaded from Arena but intended for editing before push
- **Safety:** User can freely edit without affecting source or Arena item

**Status Indicators:**
- 🔴 Red dot on tab name
- Status column shows "PLACEHOLDER"
- History tab tracks status = PLACEHOLDER

**Pushing to Arena:**
Once editing is complete, use standard BOM push workflow to create the item in Arena. Status will change to SYNCED after successful push.

---

## Data Integrity

### BOM Data Preservation
When cloning, the following are preserved:
- ✅ Item numbers, names, descriptions
- ✅ Categories and lifecycles
- ✅ Quantities
- ✅ Custom attribute values
- ✅ Row backgrounds (category colors)
- ✅ Font weights, styles, colors
- ✅ Cell formatting

### Template Instruction Row
When loading an Arena template, an instruction row is inserted at Row 3:

**Appearance:**
- Yellow background (#fff3cd)
- Italic, bold text
- Dark yellow/brown color (#856404)

**Message:**
```
⚠ Template loaded from ITEM-NUMBER (X components) - Trim to desired components before pushing to Arena
```

**Purpose:**
- Visual reminder that template needs customization
- User can delete row when ready
- Prevents accidental push of unmodified template

---

## Validation & Error Handling

### Input Validation

**Clone/Template Validation:**
- ✅ Source rack exists (for clones)
- ✅ New item number is non-empty
- ✅ New rack name is non-empty
- ✅ New item number doesn't already exist
- ✅ Sheet name length ≤ 100 characters
- ✅ No invalid characters in rack name (`[]:\*?/\`)

**Error Messages:**
```
❌ Source rack "RACK-001" not found
❌ New rack item number cannot be empty
❌ A rack with item number "RACK-002" already exists
❌ Sheet name would be too long (105 chars, max 100)
❌ Rack name contains invalid characters
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate rack number | Validation error with message |
| Source rack not found | Error: "Source rack not found" |
| Arena item has no BOM | Error: "Cannot load template - item has no components" |
| Arena fetch fails | Error with retry suggestion |
| Invalid rack name | Validation error listing invalid characters |
| Sheet name conflict | Auto-append " (2)" or use timestamp |
| Clone from placeholder | Allowed - user might want to fork WIP config |
| Template from synced rack | Allowed - creates independent copy |
| Very large BOM (200+ rows) | Progress indicator, batch write if needed |

---

## Testing Checklist

### Clone Testing
- [ ] Clone rack with 1 component
- [ ] Clone rack with 50+ components
- [ ] Clone placeholder rack
- [ ] Clone synced rack
- [ ] Clone with invalid name (should fail validation)
- [ ] Clone with duplicate item number (should fail)
- [ ] Clone from Racks tab (inline icon)
- [ ] Clone from Templates tab
- [ ] Quick clone from menu (current sheet)
- [ ] Quick clone when not on rack sheet (should show error)
- [ ] Verify BOM formatting preserved (category colors)
- [ ] Verify tab colors applied
- [ ] Verify history event logged (RACK_CLONED)
- [ ] Verify status is PLACEHOLDER

### Template Testing
- [ ] Load Arena template with 10 components
- [ ] Load Arena template with 100+ components
- [ ] Preview shows correct component count
- [ ] Preview shows first 5-10 components
- [ ] Preview shows categories
- [ ] Cancel template load from preview (should not create sheet)
- [ ] Load template and verify instruction row appears
- [ ] Load template with custom attributes
- [ ] Load template from Arena item with no BOM (should fail)
- [ ] Verify history event logged (TEMPLATE_LOADED)
- [ ] Verify status is PLACEHOLDER

### UI Testing
- [ ] Templates tab appears as 4th tab
- [ ] Mode switcher works (Clone ↔ Template)
- [ ] Search filters work in both modes
- [ ] Clone icon appears on all rack items
- [ ] Clone modal opens and closes correctly
- [ ] Template preview modal opens and closes correctly
- [ ] Modal close on ESC key
- [ ] Modal close on click outside
- [ ] Loading indicators show during operations
- [ ] Success/error messages display correctly

---

## Future Enhancements

### Potential Additions (Out of Scope)
- Batch clone multiple racks at once
- Smart BOM merge from multiple sources
- Side-by-side diff preview before cloning
- Clone with quantity multiplier (2x all quantities)
- Template library for common configurations
- Clone history genealogy tracking (parent/child relationships)
- Partial BOM clone (select specific components to copy)
- Template tags and favorites

---

## Troubleshooting

### Issue: Clone button doesn't appear
**Solution:** Refresh the Rack Picker sidebar

### Issue: Template preview fails
**Solution:**
1. Check Arena API connection
2. Verify item exists in Arena
3. Check if item has a BOM in Arena

### Issue: Clone creates empty sheet
**Solution:**
1. Verify source rack has BOM data (Row 3+)
2. Check if source rack is properly formatted

### Issue: Template instruction row doesn't appear
**Solution:** Row insert may have failed. Manually add instruction or proceed with caution.

### Issue: Cloned rack has wrong status (not PLACEHOLDER)
**Solution:** Check History tab. Status should be PLACEHOLDER. If not, use "Mark as Synced" menu option carefully.

---

## Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Developer implementation details
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md) - Arena API integration patterns

---

## Support

For questions or issues:
1. Check this documentation
2. Review Help Modal in application (`Arena Data Center → Help and Documentation`)
3. Check execution logs (View → Logs in Apps Script editor)
4. Report issues at: https://github.com/anthropics/claude-code/issues

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Feature Status:** ✅ Production Ready
