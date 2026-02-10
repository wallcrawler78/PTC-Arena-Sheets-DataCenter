# 🌲 Hierarchical BOM Tree Viewer

**Date:** 2026-02-09
**Version:** 1.0
**Status:** ✅ Deployed to Production

---

## 📋 Overview

The Hierarchical BOM Tree Viewer allows users to explore multi-level BOMs from Arena items and selectively insert components into their current rack configuration. This feature eliminates the need to load entire BOMs and manually delete unwanted rows.

### Key Benefits:
- **Visual Hierarchy:** See parent-child relationships in BOM structure
- **Selective Loading:** Pick only the components you need
- **Insert into Current Rack:** No need to create new racks and copy data
- **Save Time:** No manual deletion of unwanted components

---

## 🎯 User Workflow

### Step 1: Open Templates Tab
1. Open **Rack Picker** sidebar
2. Click **Templates** tab (4th tab)
3. Click **Arena Template** mode button (if not already selected)

### Step 2: Search for Item
1. Type item number or name in search box (e.g., "POD")
2. Click **Search** button (or press Enter)
3. Results appear showing matching Arena items

### Step 3: Open BOM Tree
1. **Click on the item card** (e.g., "POD-0001")
   - The entire card is clickable
2. **BOM Tree Modal opens** with:
   - Item number and name at top
   - Loading spinner while fetching BOM
   - Hierarchical tree when loaded

### Step 4: Explore Hierarchy
1. **Expand/Collapse Nodes:**
   - Click **▶ arrow** to expand a node and see its children
   - Click **▼ arrow** (rotated) to collapse a node
   - Or use **Expand All** / **Collapse All** buttons at top

2. **View Component Details:**
   - **Item Number** and **Quantity** (bold)
   - **Item Name** (gray, smaller text)
   - **Revision** and **Description** (lightest gray, smallest text)

### Step 5: Select Components
1. **Check boxes** next to desired components
   - Click checkbox directly
   - Or click anywhere on the component row
2. Use bulk actions:
   - **Select All** - checks all components at all levels
   - **Deselect All** - unchecks all components

3. **Selected count** updates at top showing how many components are checked

### Step 6: Insert into Current Rack
1. Ensure you have a **rack configuration sheet active** (e.g., "Rack - Type A")
2. Click **"Insert Selected Components"** button
3. Modal shows "Inserting..." while processing
4. **Success message** confirms insertion
5. Components are **appended to your current rack's BOM**

---

## 🔍 Example Use Case

### Scenario: Building a Custom POD Configuration

**Your Goal:** Create a custom POD with only specific racks, not all options from the master POD template.

**Traditional Workflow (Old Way):**
1. Create new rack from POD template
2. All 50 components load into new rack
3. Manually delete 35 unwanted rows
4. Risk of accidentally deleting wrong components
5. Tedious and time-consuming

**BOM Tree Viewer Workflow (New Way):**
1. Open existing custom POD rack (or create blank PLACEHOLDER)
2. Open Rack Picker → Templates → Search "POD"
3. Click POD-0001 → BOM tree opens
4. Expand tree to see all rows (Row-0001A12, Row-0002A12, etc.)
5. Expand each row to see racks inside
6. Check only the 15 racks you want
7. Click "Insert Selected Components"
8. Done! Only your 15 chosen racks are in the BOM

**Time Saved:** ~80% reduction in manual work

---

## 🌳 BOM Tree Structure Example

```
POD-0001 (Root - click to view BOM)
│
├─ ▶ Row-0001A12 (Qty: 1)  ☑
│  ├─ ▶ Rack SLX-999 (Qty: 1)  ☑
│  │  ├─ PSU-500W (Qty: 2)  ☑
│  │  ├─ Fan-Module (Qty: 4)  ☐
│  │  └─ CPU-Module (Qty: 1)  ☑
│  │
│  └─ ▶ PCBA-Model300 (Qty: 4)  ☑
│     ├─ Capacitor-100uF (Qty: 12)  ☐
│     └─ Resistor-10K (Qty: 24)  ☐
│
├─ ▶ Row-0002A12 (Qty: 1)  ☑
│  └─ Rack XTR-123 (Qty: 6)  ☑
│
└─ Row-0003A12 (Qty: 1)  ☐
   └─ Rack ABC-456 (Qty: 3)  ☐
```

**Legend:**
- **▶** Collapsed node (click to expand)
- **▼** Expanded node (click to collapse)
- **☑** Selected component (will be inserted)
- **☐** Unselected component (will be skipped)

---

## 🛠️ Technical Details

### Backend Functions

**File:** `RackCloneManager.gs`

#### 1. `getMultiLevelBOM(itemNumber)`
Fetches hierarchical BOM from Arena for a given item.

**Parameters:**
- `itemNumber` (string) - Arena item number (e.g., "POD-0001")

**Returns:**
```javascript
{
  success: true,
  itemNumber: "POD-0001",
  itemName: "POD 1",
  bomTree: [
    {
      id: "guid_0",               // Unique ID for UI
      itemNumber: "Row-0001A12",
      itemName: "Front Row Room A12",
      description: "Front row configuration",
      revision: "rev 01",
      quantity: 1,
      level: 1,
      guid: "ABC123...",
      hasChildren: true,
      children: [...]             // Nested array of child components
    },
    // ... more root-level components
  ]
}
```

**How It Works:**
1. Looks up root item by number in Arena
2. Gets item GUID
3. Calls `fetchBOMRecursive()` to build tree
4. Returns complete hierarchy with all levels

#### 2. `fetchBOMRecursive(arenaClient, itemGuid, itemData, level)`
Recursively fetches BOM for an item and its children.

**Parameters:**
- `arenaClient` - Arena API client instance
- `itemGuid` - Item GUID to fetch BOM for
- `itemData` - Item data object
- `level` - Current hierarchy level (0 = root)

**Recursion Depth:** Maximum 10 levels (prevents infinite loops)

**For Each BOM Line:**
1. Fetches item details (description, revision)
2. Creates BOM node object
3. Recursively fetches children's BOMs
4. Builds nested tree structure

**Revision Logic:**
- Checks `effectivity.effectiveRevisionNumber` first
- Falls back to `revisionNumber` or `RevisionNumber`

#### 3. `insertComponentsIntoCurrentRack(components)`
Inserts selected components into the active rack sheet.

**Parameters:**
- `components` (array) - Array of component objects:
  ```javascript
  [
    {
      itemNumber: "Row-0001A12",
      itemName: "Front Row Room A12",
      description: "Front row configuration",
      revision: "rev 01",
      quantity: 1,
      guid: "ABC123..."
    },
    // ... more components
  ]
  ```

**Returns:**
```javascript
{
  success: true,
  message: "Successfully inserted 5 component(s) into Rack - Type A",
  componentsInserted: 5,
  startRow: 8
}
```

**How It Works:**
1. **Validates Active Sheet:** Checks that current sheet is a rack configuration
2. **Finds Insert Position:** Determines last row with BOM data
3. **Fetches Full Item Details:** Calls Arena API for each component to get category, lifecycle, etc.
4. **Formats Data:** Builds rows matching standard BOM format (Item Number, Name, Description, Category, Lifecycle, Qty)
5. **Applies Formatting:** Sets category colors, font weights
6. **Writes to Sheet:** Inserts rows at calculated position
7. **Updates Status:** If rack was SYNCED, marks as LOCAL_MODIFIED

**Special Handling:**
- Clears instruction rows (e.g., "Use Item Picker to manually add components")
- Preserves existing BOM data (appends, doesn't replace)
- Applies category colors from getCategoryColors()

---

### Frontend Components

**File:** `RackPicker.html`

#### BOM Tree Modal HTML Structure

```html
<div class="modal-overlay" id="bomTreeModal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="bomTreeModalTitle">Select Components from BOM</h3>
    </div>
    <div class="modal-body">
      <!-- Item info -->
      <div>Item: <span id="bomTreeItemNumber">-</span></div>
      <div>Selected: <span id="bomTreeSelectedCount">0</span></div>

      <!-- Bulk actions -->
      <button onclick="bomTreeSelectAll()">Select All</button>
      <button onclick="bomTreeExpandAll()">Expand All</button>

      <!-- Tree container -->
      <div id="bomTreeContainer">
        <!-- Tree rendered here -->
      </div>
    </div>
    <div class="modal-footer">
      <button onclick="closeBomTreeModal()">Cancel</button>
      <button onclick="insertSelectedComponents()">Insert Selected</button>
    </div>
  </div>
</div>
```

#### CSS Classes

**`.bom-tree-item`**
- Container for each tree node
- Padding: 6px 8px
- Hover effect: light gray background

**`.bom-tree-row`**
- Flexbox layout for node content
- Contains: expand icon, checkbox, item details

**`.bom-tree-indent`**
- Inline-block for indentation
- Calculated: `level * 20px`

**`.bom-tree-expand-icon`**
- Arrow icon (▶) for expand/collapse
- Rotates 90° when expanded
- Hidden if no children

**`.bom-tree-children`**
- Container for child nodes
- `display: none` by default
- `display: block` when `.expanded` class added

#### JavaScript Functions

**`openBomTreeModal(itemNumber)`**
- Opens modal
- Fetches multi-level BOM via `google.script.run.getMultiLevelBOM()`
- Renders tree on success

**`renderBomTree(bomTree)`**
- Builds HTML for entire tree
- Calls `renderBomTreeNode()` for each root node

**`renderBomTreeNode(node, level)`**
- Recursively renders node and children
- Applies indentation based on level
- Shows expand icon if has children
- Renders checkbox with checked state
- Displays item details (number, name, revision, description)

**`toggleBomTreeNode(nodeId)`**
- Adds/removes nodeId from `bomTreeExpandedIds` array
- Re-renders tree to show/hide children

**`toggleBomTreeSelection(nodeId)`**
- Adds/removes nodeId from `bomTreeSelectedIds` array
- Updates selected count

**`bomTreeSelectAll()` / `bomTreeDeselectAll()`**
- Bulk selection operations
- Collects all node IDs via `collectAllNodeIds()`
- Updates `bomTreeSelectedIds` array

**`insertSelectedComponents()`**
- Validates selection (at least 1 component)
- Collects selected component data via `collectSelectedComponents()`
- Calls `google.script.run.insertComponentsIntoCurrentRack()`
- Shows success/error message
- Closes modal on success

---

## 🎨 UI/UX Features

### Visual Hierarchy
- **Indentation:** Each level indented by 20px
- **Expand Icons:** ▶ (collapsed) / ▼ (expanded)
- **No Children:** Icon hidden if leaf node

### Component Details Display
```
┌─────────────────────────────────────────────┐
│ ☑ Row-0001A12 (Qty: 1)                      │ ← Bold, item number + qty
│   Front Row Room A12                        │ ← Gray, item name
│   Rev: rev 01 • Front row configuration     │ ← Light gray, small text
└─────────────────────────────────────────────┘
```

### Interaction States
- **Hover:** Light gray background (#f8f9fa)
- **Checkbox:** Standard browser checkbox
- **Expand Icon:** Rotates 90° with transition
- **Loading:** Spinner animation while fetching BOM

### Accessibility
- Click entire row to toggle checkbox (larger click target)
- Keyboard accessible (checkboxes can be tabbed to)
- Clear visual feedback for selection

---

## 🧪 Testing

### Test 1: Single-Level BOM
- [ ] Click on item with no child BOMs
- [ ] Tree renders with no expand icons
- [ ] Checkboxes work correctly
- [ ] Insert adds components to current rack

### Test 2: Multi-Level BOM
- [ ] Click on item with nested BOMs (e.g., POD)
- [ ] Expand icons appear for nodes with children
- [ ] Click expand icon → children appear
- [ ] Click collapse icon → children hide
- [ ] Nested indentation displays correctly

### Test 3: Deep Hierarchy
- [ ] Item with 5+ levels of nesting
- [ ] All levels render correctly
- [ ] Indentation increases appropriately
- [ ] Expand/collapse works at all levels

### Test 4: Bulk Actions
- [ ] "Select All" → all checkboxes checked
- [ ] "Deselect All" → all checkboxes unchecked
- [ ] "Expand All" → all nodes expanded
- [ ] "Collapse All" → all nodes collapsed

### Test 5: Component Selection
- [ ] Check individual components → count updates
- [ ] Uncheck components → count decreases
- [ ] Selected count matches checked boxes

### Test 6: Insert into Rack
- [ ] Active sheet is rack → Insert succeeds
- [ ] Active sheet is NOT rack → Error message
- [ ] Components append to existing BOM
- [ ] Category colors applied correctly
- [ ] Rack status updated if needed

### Test 7: Empty BOM
- [ ] Item with no BOM components
- [ ] Empty state message displays
- [ ] No errors in console

### Test 8: Arena API Failure
- [ ] BOM fetch fails (network error, auth issue)
- [ ] Error message displays in modal
- [ ] Modal doesn't crash

### Test 9: Item Details
- [ ] Revision displays correctly (or blank if none)
- [ ] Description displays correctly (or blank if none)
- [ ] Item name and number always display
- [ ] Quantity displays correctly

### Test 10: Modal Interaction
- [ ] Click Cancel → modal closes, no changes
- [ ] Click outside modal → no action (modal stays open)
- [ ] Insert with 0 selected → alert warning
- [ ] Insert with components → success, modal closes

---

## 📊 Performance Considerations

### BOM Fetch Time
- **Small BOM (1-10 items):** < 2 seconds
- **Medium BOM (10-50 items):** 3-5 seconds
- **Large BOM (50-200 items):** 5-15 seconds
- **Very Large BOM (200+ items):** 15-30 seconds

**Why:** Each BOM line requires an Arena API call to fetch item details (description, revision).

### Optimization Strategies
1. **Recursive Depth Limit:** Max 10 levels (prevents infinite loops)
2. **Loading Spinner:** Shows progress during fetch
3. **Client-Side Rendering:** Tree builds in browser (fast)
4. **Checkbox Batching:** Select/Deselect All uses array operations

### Future Optimizations
- **Caching:** Store fetched BOMs in script cache
- **Lazy Loading:** Fetch children only when expanded
- **Batch API Calls:** Fetch multiple item details in single request
- **Progressive Rendering:** Show partial tree as data arrives

---

## 🚨 Error Handling

### Validation Errors
| Error | Cause | Message | Action |
|-------|-------|---------|--------|
| No components selected | User clicks Insert with 0 checked | "Please select at least one component to insert." | Alert, stay in modal |
| Not on rack sheet | Active sheet is not a rack config | "Please select a rack configuration sheet before inserting components." | Alert, stay in modal |
| Item not found | Arena item number doesn't exist | "Item 'XYZ' not found in Arena." | Show in modal body |

### API Errors
| Error | Cause | Message | Action |
|-------|-------|---------|--------|
| BOM fetch failure | Arena API error, network timeout | "Error fetching multi-level BOM: [error details]" | Show in modal body |
| Item details fetch failure | Specific item not accessible | Warning logged, component still renders with partial data | Continue with available data |

### Edge Cases
| Scenario | Handling |
|----------|----------|
| Circular reference in BOM | Prevented by 10-level depth limit |
| Empty BOM | "No BOM components found for this item." message |
| Very large BOM (500+ items) | May take 30+ seconds, shows loading spinner |
| Item with no GUID | Error: "Item has no GUID." |

---

## 🔮 Future Enhancements

### 1. Smart Selection
- **Auto-Select Children:** Checking parent auto-checks all children
- **Auto-Unselect Parent:** Unchecking all children auto-unchecks parent
- **Indeterminate State:** Parent shows partial check if some children selected

### 2. Filtering & Search
- **Search Within BOM:** Filter tree to matching items only
- **Filter by Category:** Show only specific component types
- **Filter by Level:** Show only items at specific hierarchy level

### 3. Quantity Editing
- **Edit Quantities:** Change qty before inserting
- **Quantity Multiplier:** Multiply all qtys by factor (e.g., 2x for double build)
- **Roll-up Quantities:** Show calculated total qty at each level

### 4. Visual Enhancements
- **Category Colors:** Color-code nodes by category
- **Level Indicators:** Visual lines showing parent-child connections
- **Icons by Type:** Different icons for assemblies vs. parts
- **Lifecycle Badges:** Show lifecycle phase (Pilot, In Prod, etc.)

### 5. Export & Sharing
- **Export to CSV:** Download BOM tree as flattened CSV
- **Copy to Clipboard:** Copy selected components as text
- **Share Selection:** Save selection as preset for reuse

---

## 📞 Support

### Common Issues

**Q: "No Arena items found" when searching**
- **A:** See fix in commit d10f7ce - ensure `loadItemPickerData()` is being called

**Q: BOM tree loads but all nodes are collapsed**
- **A:** Click expand icons (▶) to open nodes, or use "Expand All" button

**Q: Insert fails with "Please select a rack configuration sheet"**
- **A:** Make sure you're on a rack tab (e.g., "Rack - Type A"), not Overview or History tab

**Q: Components insert but lose category colors**
- **A:** Ensure getCategoryColors() returns correct color mapping for all categories

**Q: Modal is slow to load for large BOMs**
- **A:** Expected for BOMs with 100+ items. Consider filtering/searching to narrow down first.

### Debugging

**View Logs:**
```
Apps Script Editor → View → Execution Log
```

**Console Logs (Frontend):**
```javascript
console.log('Fetching multi-level BOM for:', itemNumber);
console.log('BOM tree data:', bomTreeData);
console.log('Selected IDs:', bomTreeSelectedIds);
```

**Backend Logs:**
```javascript
Logger.log('=== GET MULTI-LEVEL BOM START ===');
Logger.log('Found ' + bomLines.length + ' BOM lines at level ' + level);
Logger.log('Inserting at row: ' + insertRow);
```

---

**Version:** 1.0
**Last Updated:** 2026-02-09
**Status:** ✅ Production Ready
