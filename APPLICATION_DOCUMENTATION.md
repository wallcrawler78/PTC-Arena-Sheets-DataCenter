# PTC Arena Datacenter Planning Tool - Complete Documentation

## Executive Summary

This application is a Google Sheets Add-on designed for datacenter infrastructure planning and bill of materials (BOM) management. It integrates with PTC Arena PLM as the master item repository, enabling teams to design datacenter layouts, configure server racks, manage equipment BOMs, and generate procurement lists—all within the familiar Google Sheets interface.

**Key Value Proposition**: Bridge the gap between PLM systems (Arena) and spreadsheet-based planning tools, eliminating manual data entry and ensuring single-source-of-truth for item data.

**Current Status**: ~85% complete, production-ready for core workflows

---

## Table of Contents

1. [User Personas and Use Cases](#user-personas-and-use-cases)
2. [Core Features and Workflows](#core-features-and-workflows)
3. [Architecture Overview](#architecture-overview)
4. [Module Descriptions](#module-descriptions)
5. [Data Flow and Integration](#data-flow-and-integration)
6. [User Interface Components](#user-interface-components)
7. [Configuration and Customization](#configuration-and-customization)
8. [Limitations and Constraints](#limitations-and-constraints)
9. [Future Enhancements](#future-enhancements)

---

## User Personas and Use Cases

### Primary Persona: Datacenter Infrastructure Engineer

**Profile**:
- Plans and designs datacenter deployments
- Manages server rack configurations
- Creates equipment procurement lists
- Needs to track hundreds of components across multiple racks and halls
- Works in Arena PLM for item master data
- Prefers spreadsheets for layout visualization and quantity aggregation

**Pain Points Addressed**:
- **Manual data entry**: Copying item numbers from Arena to spreadsheets is error-prone
- **Version control**: Hard to know if spreadsheet data matches current Arena item data
- **Visualization**: Arena doesn't provide spatial/visual rack layout planning
- **Aggregation**: Calculating total quantities across multiple racks is tedious
- **Collaboration**: Multiple team members need to work on different racks simultaneously

**Key Workflows**:
1. Pull existing rack BOM from Arena → customize in spreadsheet → push changes back
2. Build new rack configuration from scratch using Arena items → push as new BOM
3. Create datacenter floor plan with clickable rack locations
4. Generate consolidated procurement list from multiple rack configurations

### Secondary Persona: Supply Chain Manager

**Profile**:
- Responsible for equipment procurement
- Needs accurate part numbers and quantities
- Works with multiple vendors and lead times
- Requires consolidated views across projects

**Pain Points Addressed**:
- **Fragmented data**: Parts lists scattered across multiple documents
- **Accuracy**: Needs guaranteed-correct part numbers from PLM
- **Aggregation**: Must consolidate quantities from multiple racks/halls
- **Traceability**: Needs to know which racks contain which items

**Key Workflows**:
1. Generate consolidated BOM from all racks in a hall
2. Export to procurement system with accurate Arena item numbers
3. Track quantity allocations by rack/location

---

## Core Features and Workflows

### 1. Arena Integration and Authentication

**Purpose**: Secure, session-based connection to PTC Arena PLM workspace

**How It Works**:
- User provides Arena credentials (email, password, workspace ID) once via configuration dialog
- Credentials stored securely in Google Apps Script User Properties
- Session established on first API call, automatically refreshed every 80 minutes
- Session ID stored and reused across API calls to minimize authentication overhead

**User Experience**:
1. First-time setup: `Arena Data Center → Configuration → Configure Arena Connection`
2. Enter email, password, workspace ID
3. System validates credentials by fetching workspace info
4. Credentials persist for this user across all future sessions
5. Auto-refresh ensures seamless operation during long planning sessions

**Technical Implementation**:
- Session-based auth (not API key) to support Arena's authentication model
- Auto-retry mechanism: if 401 error received, automatically re-authenticates and retries request
- Workspace-scoped: all API calls scoped to configured workspace ID
- Secure storage: credentials in User Properties (user-specific, not shared across users)

---

### 2. Item Picker - Interactive Item Selection

**Purpose**: Browse and select items from Arena inventory to insert into spreadsheet

**Design Philosophy**:
Users shouldn't have to memorize item numbers or leave the spreadsheet. The Item Picker provides a searchable, filterable sidebar that stays open while working.

**Key Features**:

#### Visual Discovery
- **Category filtering**: Dropdown populated with actual Arena categories (e.g., Server, Networking, Storage)
- **Category search**: Type to filter long category lists (real-time filtering)
- **Lifecycle filtering**: Show only Production items, or include Prototype/In Development
- **Favorites system**: Star frequently-used categories for one-click access
- **Color coding**: Each item card color-coded by category (user-configurable colors)

#### Search and Filter
- **Full-text search**: Search across item number, name, and description
- **Live filtering**: Results update as you type
- **Multi-criteria**: Combine category + lifecycle + search
- **Result count**: Always shows "X items found" for feedback

#### Quantity Tracking
- **Real-time counts**: Shows how many times each item appears in current sheet
- **Visual badges**: Red badge on item cards shows "2x" if item used twice
- **Quantity tracker panel**: Scrollable list at bottom showing all items in use
- **Auto-refresh**: Updates every 5 seconds while sidebar open

#### Insertion Workflow
1. User opens Item Picker (sidebar appears on right)
2. Filters/searches to find desired item
3. Clicks item card (highlights in blue)
4. Clicks destination cell in spreadsheet
5. Item number auto-inserted with category color
6. Attributes auto-populated in adjacent columns (configurable)

**User Experience Design**:
- **Persistent sidebar**: Stays open while working, no need to re-open for each item
- **Visual hierarchy**: Most important controls at top (favorites), details at bottom (quantity)
- **Immediate feedback**: Selection highlighted, insertion instant
- **Forgiving search**: Case-insensitive, searches multiple fields simultaneously

---

### 3. BOM Operations - Bidirectional Sync with Arena

**Purpose**: Enable users to work in spreadsheets while maintaining Arena as single source of truth

**Philosophy**:
Spreadsheets are better for layout planning and quick edits. Arena is better for item master data and change control. This feature bridges the two.

#### Pull BOM from Arena

**Use Case**: Existing rack already configured in Arena, want to visualize or modify in spreadsheet

**Workflow**:
1. User has sheet prepared (or creates blank rack config sheet)
2. `Arena Data Center → BOM Operations → Pull BOM from Arena`
3. Enters Arena item number (the "parent" item representing the rack)
4. System fetches BOM hierarchy from Arena
5. Sheet populated with:
   - Level column (0=top, 1=subassembly, 2=component, etc.)
   - Quantity column
   - Item number (indented based on level for visual hierarchy)
   - Item name, category, lifecycle
   - User-configured attribute columns

**Visual Hierarchy**:
```
Rack Assembly                    (Level 0)
  Server Model A                 (Level 1)
    Power Supply PSU-100         (Level 2)
    CPU Intel Xeon E5            (Level 2)
    RAM 32GB DDR4                (Level 2)
  Network Switch SW-24           (Level 1)
    Power Cable 10ft             (Level 2)
```

**Formatting Applied**:
- Category color coding (each row colored by item category)
- Indentation for hierarchy visualization
- Frozen headers for scrolling large BOMs
- Auto-sized columns for readability

#### Push BOM to Arena

**Use Case**: Built new rack config in spreadsheet, want to save to Arena

**Workflow**:
1. User builds BOM in sheet (using Item Picker or manual entry)
2. Sheet must have Level, Qty, and Item Number columns
3. `Arena Data Center → BOM Operations → Push BOM to Arena`
4. User prompted for parent item number
   - If provided: updates existing Arena BOM
   - If blank: creates new Arena item, then adds BOM to it
5. System validates item numbers against Arena
6. Deletes existing BOM lines from Arena item (clean slate)
7. Creates new BOM lines with proper quantities and hierarchy levels
8. Success message confirms upload

**Validation and Error Handling**:
- Warns if items not found in Arena
- Continues processing even if some items fail (reports warnings)
- Rate limiting delays to avoid Arena API throttling
- Detailed logging for troubleshooting

#### Consolidate BOMs

**Use Case**: Need procurement list for entire hall (10 racks × 42U each = 420 line items)

**Workflow**:
1. Multiple rack configuration sheets in workbook (e.g., Rack A, Rack B, Rack C)
2. `Arena Data Center → BOM Operations → Create Consolidated BOM`
3. System auto-detects all sheets with "rack" in name
4. Scans each sheet for item numbers
5. Aggregates quantities across all sheets
6. Fetches latest item details from Arena
7. Creates new "Consolidated BOM" sheet with:
   - Unique items only
   - Total quantities summed
   - Source sheets listed (traceability)
   - Sorted by category and item number

**Output**:
```
Item Number | Item Name        | Category    | Total Qty | Source Sheets
SRV-001     | Dell R740        | Server      | 48        | Rack A, B, C, D...
NET-042     | Cisco 9300-24    | Networking  | 12        | Rack A, C, E...
PWR-100     | APC UPS 3000VA   | Power       | 12        | Rack A-L
```

**Business Value**:
- Single procurement list for entire deployment
- Guaranteed accurate part numbers (pulled from Arena)
- Traceability back to rack locations
- Ready to import into ERP/procurement system

---

### 4. Layout Templates - Standardized Sheet Structures

**Purpose**: Provide pre-formatted sheet templates matching common datacenter planning scenarios

**Philosophy**:
Don't make users build tables from scratch. Provide opinionated templates that match industry-standard rack sizes and layouts.

#### Tower Layout (42U Vertical Rack)

**Use Case**: Planning equipment placement in standard 42U server rack

**What It Creates**:
- Sheet with 42 rows (U1 through U42)
- Columns: Position | Qty | Item Number | Item Name | Category | Notes | [user-configured attributes]
- U-position pre-populated (U1, U2, U3... U42)
- Professional formatting (blue headers, frozen panes)
- Alternating row colors for readability

**How It's Used**:
1. `Arena Data Center → Create Layout → New Tower Layout`
2. Enter name (e.g., "Rack A Tower")
3. Use Item Picker to add servers/equipment to specific U positions
4. Visual representation of physical rack layout

**Physical Mapping**:
- U1 = bottom of rack
- U42 = top of rack
- Multi-U devices: user adds item at starting position, notes span in Notes column

#### Overview Layout (Datacenter Grid)

**Use Case**: Bird's-eye view of datacenter floor with racks arranged in rows

**What It Creates**:
- Grid layout (user specifies size, e.g., 10×10)
- Column headers: A, B, C, D... (like Excel)
- Row headers: 1, 2, 3, 4...
- Title row: "Datacenter Overview"
- Optimized cell sizes (120px wide × 80px tall)
- Legend showing category colors
- Frozen headers for navigation

**How It's Used**:
1. `Arena Data Center → Create Layout → New Overview Layout`
2. Enter name (e.g., "Hall 1 Overview")
3. Enter grid size (e.g., 10 for 10×10)
4. Populate cells manually or use auto-linking
5. Each cell represents a rack location
6. Click cell to jump to detailed rack sheet (hyperlinked)

**Visual Example**:
```
     A       B       C       D       E
1  [A-1]   [A-2]   [A-3]   [A-4]   [A-5]
2  [B-1]   [B-2]   [B-3]   [B-4]   [B-5]
3  [C-1]   [C-2]   [C-3]   [C-4]   [C-5]
```

Each cell color-coded by rack type (Server, Network, Storage)

#### Rack Configuration Layout

**Use Case**: Detailed BOM for a single rack

**What It Creates**:
- BOM-style columns: Level | Qty | Item Number | Item Name | Category | Lifecycle | Notes
- User-configured attribute columns appended
- Rack header row ("Rack Configuration: [Name]")
- Professional formatting (blue headers, frozen panes)
- Ready for Item Picker workflow
- Ready for Push BOM to Arena

**How It's Used**:
1. `Arena Data Center → Create Layout → New Rack Configuration`
2. Enter name (e.g., "Rack D-12")
3. Use Item Picker to build equipment list
4. Set hierarchy levels (0, 1, 2...) for nested BOMs
5. Push to Arena when complete

#### Auto-Linking Feature

**Purpose**: Connect overview grid to detailed rack sheets automatically

**Problem It Solves**:
In a 100-rack datacenter, manually creating hyperlinks is tedious and error-prone.

**How It Works**:
1. User has overview sheet + multiple rack sheets (e.g., Rack A, Rack B, Rack C...)
2. `Arena Data Center → Create Layout → Auto-Link Racks to Overview`
3. System scans for all sheets with "rack" in name
4. Arranges them in grid pattern (5 per row by default)
5. Creates hyperlinks in overview sheet cells
6. Links use sheet GIDs (reliable across sheet renames)
7. Success message: "Linked 12 rack sheets to overview"

**Result**:
Click any rack name in overview → instantly jump to that rack's detail sheet

---

### 5. Category Management and Visual Customization

**Purpose**: Organize items by category and provide visual differentiation via color coding

**Category System**:

#### Default Categories (Datacenter-Focused)
- **Hall**: Top-level container (entire building section)
- **Pod**: Group of racks (e.g., 4 racks)
- **Rack**: Individual 42U rack enclosure
- **Server**: Compute equipment
- **Networking**: Switches, routers
- **Storage**: SAN, NAS equipment
- **Power**: UPS, PDUs
- **Cable**: Network cables, power cables
- **Component**: CPU, RAM, disks, etc.

#### Dynamic Categories (Loaded from Arena)
- System fetches actual categories from Arena workspace
- User sees their organization's category structure
- Full category paths displayed (e.g., "Item\Part\Mechanical\Enclosure")

#### Color Configuration

**Purpose**: Visual differentiation in spreadsheets and Item Picker

**User Experience**:
1. `Arena Data Center → Configuration → Configure Category Colors`
2. Modal dialog shows all Arena categories
3. Color picker next to each category name
4. Star icon (⭐) to mark favorites
5. "Save Colors" persists to configuration
6. "Reset to Defaults" restores datacenter defaults

**Where Colors Applied**:
- Sheet cells containing items (background color)
- Item Picker cards (border and badge colors)
- Overview grid cells (rack categories)
- Legend on overview layouts

**Favorites System**:
- Click star next to category to toggle favorite
- Favorites appear as quick-filter buttons at top of Item Picker
- One-click to filter to frequently-used categories
- Especially useful when working with 50+ categories

---

### 6. Attribute and Column Configuration

**Purpose**: Control which Arena item attributes appear as columns in sheets

**Problem It Solves**:
Arena items have dozens of attributes. Users don't need all of them. Allow customization of which attributes to show.

**Configuration Interface**:
1. `Arena Data Center → Configuration → Configure Item Columns`
2. Modal dialog shows all available attributes from Arena
3. Checkboxes to select which to include
4. Custom header name input (e.g., rename "revisionNumber" to "Rev")
5. Attribute groups: save common column sets for reuse
6. Search box to filter long attribute lists

**Attribute Groups**:
- Save current selection as named group (e.g., "Server Attributes")
- Load group later to quickly configure another sheet
- Groups stored in Script Properties
- Useful for teams with standard column sets

**Default Columns**:
- Description
- Category
- Lifecycle Phase

**Common Additional Columns**:
- Manufacturer
- Part Number (vendor)
- Lead Time
- Weight
- Power Consumption
- Dimensions

**Auto-Population**:
When user inserts item via Item Picker:
1. Item number inserted in selected cell
2. System looks up configured columns
3. Fetches attribute values from Arena item data
4. Populates adjacent cells automatically
5. Saves time, reduces errors

---

### 7. BOM Hierarchy Configuration

**Purpose**: Define how categories map to BOM levels for proper nesting

**BOM Level Concept**:
- Level 0 = Top assembly (e.g., entire rack)
- Level 1 = Major subassemblies (e.g., server)
- Level 2 = Components (e.g., CPU, RAM)
- Level 3+ = Sub-components (e.g., heat sink on CPU)

**Configuration Interface**:
1. `Arena Data Center → Configuration → Configure BOM Levels`
2. Modal dialog shows hierarchy list
3. Drag to reorder levels
4. Assign category to each level
5. Add/remove levels as needed
6. Visual level numbers (0, 1, 2...) displayed

**Default Hierarchy**:
```
Level 0: Hall
Level 1: Pod
Level 2: Rack
Level 3: Server
Level 4: Component
```

**Usage in BOM Operations**:
- When pulling BOM from Arena, levels preserved
- When pushing BOM to Arena, levels determine parent/child relationships
- Indentation in sheets visualizes hierarchy
- Consolidated BOMs respect hierarchy for proper rollup

---

## Architecture Overview

### System Architecture Pattern: Three-Tier Web Application

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│  (Google Sheets UI + HTML Dialogs/Sidebars)        │
│  - Native Sheets grid for data entry/viewing        │
│  - Custom menu (Apps Script UI Service)             │
│  - HTML modals for configuration                    │
│  - HTML sidebar for Item Picker                     │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│                Application Logic Layer               │
│        (Google Apps Script Server-Side)             │
│  - Code.gs (menu handlers, orchestration)           │
│  - BOMBuilder.gs (BOM operations)                   │
│  - LayoutManager.gs (template generation)           │
│  - CategoryManager.gs (config management)           │
│  - FormattingUtils.gs (cell styling)                │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│                Data/Integration Layer                │
│  - ArenaAPI.gs (REST client for Arena PLM)          │
│  - Authorization.gs (session management)            │
│  - PropertiesService (configuration storage)        │
│  - SpreadsheetService (Google Sheets API)           │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│                External Systems                      │
│  - PTC Arena PLM (REST API)                         │
│  - Google Sheets Storage                            │
└─────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- Google Sheets native UI (spreadsheet grid)
- HTML5/CSS3/JavaScript (for modals and sidebar)
- No external frameworks (vanilla JS for performance)
- Google Apps Script HTML Service

**Backend**:
- Google Apps Script (JavaScript ES5-compatible)
- Runs on Google's infrastructure (no server management)
- Server-side execution model (protects credentials)

**Data Storage**:
- **User Properties**: User-specific credentials (email, password, workspace ID)
- **Script Properties**: Shared configuration (category colors, hierarchies, column configs)
- **Sheets**: Primary data storage (BOMs, layouts)
- **Arena PLM**: Master item data (single source of truth)

**APIs**:
- **Arena REST API**: Items, BOMs, categories, attributes
- **Google Sheets API**: Cell manipulation, formatting
- **Google Apps Script Services**: UI, Properties, Utilities

### Deployment Model

**Installation**:
- Google Workspace Add-on (installed per spreadsheet)
- Alternative: Standalone script project (bound to specific sheet)

**Updates**:
- Developer pushes via `clasp push`
- Users automatically receive updates on next reload
- No user action required for updates

**Permissions**:
- Google account authentication (OAuth)
- Permissions requested:
  - Read/write spreadsheet data
  - Display custom UI (modals, sidebar)
  - Make external requests (to Arena API)
  - Store user settings

---

## Module Descriptions

### Core Modules (14 Files)

#### 1. Code.gs - Main Entry Point and Orchestration

**Responsibility**: Central coordinator for all user actions

**Key Functions**:
- `onOpen()`: Builds custom menu on spreadsheet open
- `onInstall()`: Runs on add-on installation
- Menu action handlers (20+ functions)
- Orchestrates calls to other modules

**Menu Structure**:
```
Arena Data Center
├── Configuration
│   ├── Configure Arena Connection
│   ├── Configure Item Columns
│   ├── Configure Category Colors
│   └── Configure BOM Levels
├── Show Item Picker
├── Create Layout
│   ├── New Tower Layout
│   ├── New Overview Layout
│   ├── New Rack Configuration
│   └── Auto-Link Racks to Overview
├── BOM Operations
│   ├── Pull BOM from Arena
│   ├── Push BOM to Arena
│   └── Create Consolidated BOM
├── Test Connection
└── Clear Credentials
```

**Design Pattern**: Facade pattern - provides simple interface to complex subsystems

---

#### 2. ArenaAPI.gs - REST Client for PTC Arena PLM

**Responsibility**: All communication with Arena API

**Key Features**:
- Session-based authentication (not API key)
- Automatic session refresh on 401 errors
- Pagination for large result sets (max 400 items per request)
- Rate limiting (200ms delay between requests)
- Comprehensive error handling

**Public Methods**:
- `testConnection()`: Validate credentials
- `getItems(options)`: Fetch items with filters
- `getAllItems(batchSize)`: Paginated fetch of all items
- `searchItems(query)`: Full-text search
- `getItem(itemId)`: Single item details
- `createItem(itemData)`: Create new Arena item
- `updateItem(itemId, data)`: Update existing item
- `getItemsByCategory(category)`: Category-filtered items
- `getBulkItems(itemIds)`: Multiple items by ID

**Arena API Quirks Handled**:
- Property names can be lowercase or capitalized (`results` vs `Results`)
- BOM operations require item GUIDs, not numbers (lookup required)
- Session timeout after 90 minutes (auto-refresh at 80 min)
- Rate limiting (handled with delays)

**Design Pattern**: Repository pattern - abstracts data source

---

#### 3. Authorization.gs - Session Management

**Responsibility**: Handle Arena authentication and session lifecycle

**Key Functions**:
- `login(email, password, workspaceId)`: Establish session
- `getValidSessionId()`: Get current session or login if expired
- `clearSession()`: Force re-authentication
- `isAuthorized()`: Check if credentials configured
- `getArenaCredentials()`: Retrieve stored credentials
- `saveArenaCredentials(creds)`: Persist credentials

**Session Lifecycle**:
1. User provides credentials (stored in User Properties)
2. First API call triggers login request to Arena
3. Arena returns session ID (typically 90-min validity)
4. Session ID stored in User Properties
5. All subsequent requests use session ID
6. On 401 error, automatically re-login and retry

**Security Considerations**:
- Credentials in User Properties (encrypted by Google, user-specific)
- Session ID not exposed to client-side JavaScript
- Password never logged or displayed after initial entry

---

#### 4. CategoryManager.gs - Configuration and Metadata

**Responsibility**: Manage categories, colors, hierarchies, and column configurations

**Key Functions**:

**Category Colors**:
- `getCategoryColors()`: Retrieve color map
- `saveCategoryColors(colors)`: Persist color configuration
- `getCategoryColor(categoryName)`: Get color for specific category
- `getDefaultCategoryColors()`: Factory defaults

**BOM Hierarchy**:
- `getBOMHierarchy()`: Retrieve level definitions
- `saveBOMHierarchy(hierarchy)`: Persist hierarchy
- `getBOMLevel(categoryName)`: Get level for category
- `validateBOMHierarchy(hierarchy)`: Check for errors

**Item Columns**:
- `getItemColumns()`: Retrieve column configuration
- `saveItemColumns(columns)`: Persist column config
- `getDefaultItemColumns()`: Factory defaults

**Arena Metadata**:
- `getArenaCategories()`: Fetch from Arena API
- `getArenaAttributes()`: Fetch all attributes
- `getLifecyclePhases()`: Fetch lifecycle values

**Utility Functions**:
- `getAttributeValue(item, attributeGuid)`: Extract attribute from item
- `getParentCategory(categoryName)`: Navigate hierarchy

**Design Pattern**: Singleton pattern - central configuration repository

---

#### 5. CategoryManager_Favorites.gs - Favorites System

**Responsibility**: Manage user's favorite categories for quick access

**Key Functions**:
- `getFavoriteCategories()`: Retrieve favorite GUIDs
- `saveFavoriteCategories(favorites)`: Persist favorites
- `addFavoriteCategory(guid)`: Add to favorites
- `removeFavoriteCategory(guid)`: Remove from favorites
- `toggleFavoriteCategory(guid)`: Toggle status
- `isFavoriteCategory(guid)`: Check if favorited
- `getCategoriesWithFavorites()`: All categories + favorite flag
- `getOnlyFavoriteCategories()`: Filter to favorites only

**Storage**: Script Properties (shared across users)

**Use Case**: User works primarily with Server, Networking, and Storage categories. Star these in configuration. Item Picker shows buttons for instant filtering.

---

#### 6. BOMBuilder.gs - BOM Synchronization Engine

**Responsibility**: Bidirectional BOM sync between Sheets and Arena

**Core Functions**:

**Pull Operations**:
- `pullBOM(itemNumber)`: Main pull function
  1. Search Arena for item by number
  2. Fetch BOM lines via API
  3. Parse hierarchy and quantities
  4. Clear existing sheet data
  5. Populate sheet with formatted BOM
  6. Apply category colors
  7. Auto-resize columns

**Push Operations**:
- `pushBOM()`: Main push function
  1. Prompt for parent item number
  2. Build BOM structure from sheet
  3. Validate items exist in Arena
  4. Delete existing BOM lines (clean slate)
  5. Create new BOM lines with proper levels
  6. Handle errors gracefully (continue on failures)

**Helper Functions**:
- `buildBOMStructure(sheet)`: Parse sheet into structured BOM
- `syncBOMToArena(client, parentGuid, bomLines)`: Upload BOM to Arena
- `aggregateQuantities(sheetNames)`: Sum quantities across sheets
- `consolidateBOM(rackSheetNames)`: Generate consolidated view
- `createConsolidatedBOMSheet()`: Menu-driven consolidation

**BOM Line Format** (Sheet):
```
Level | Qty | Item Number | Item Name | Category | Lifecycle | Notes
0     | 1   | RACK-A-001  | Rack A    | Rack     | Production | 42U
1     | 2   | SRV-100     | Server    | Server   | Production | Top 2U
2     | 2   | CPU-X5      | CPU       | Component| Production |
2     | 4   | RAM-32G     | RAM 32GB  | Component| Production |
```

**Indentation Logic**:
- Level 0: No indent
- Level 1: 2 spaces
- Level 2: 4 spaces
- Level 3: 6 spaces (and so on)

**Design Pattern**: ETL (Extract, Transform, Load) pattern

---

#### 7. LayoutManager.gs - Template Generation

**Responsibility**: Create pre-formatted sheet layouts for common scenarios

**Template Functions**:

**Tower Layout**:
- `createTowerLayout(sheetName)`: Generate 42U rack layout
  - 42 rows (U1-U42 pre-populated)
  - Columns: Position, Qty, Item Number, Name, Category, Notes + attributes
  - Professional formatting (blue headers, frozen panes)
  - Alternating row colors

**Overview Layout**:
- `createOverviewLayout(sheetName, rows, cols)`: Generate datacenter grid
  - Customizable size (1-20 rows/cols)
  - Column headers (A, B, C...)
  - Row headers (1, 2, 3...)
  - Title row
  - Legend with category colors
  - Optimized cell sizes (120px × 80px)

**Rack Configuration**:
- `createRackConfigSheet(rackName)`: Generate BOM-ready sheet
  - BOM columns (Level, Qty, Item Number, Name, Category, Lifecycle, Notes)
  - User-configured attribute columns
  - Header row with rack name
  - Professional formatting

**Linking and Navigation**:
- `linkOverviewToRack(overview, row, col, rackSheet)`: Create hyperlink
  - Uses sheet GID for reliability
  - Formula: `=HYPERLINK("#gid=12345", "Rack A")`
  - Blue, bold text styling

- `autoLinkRacksToOverview(overviewSheet)`: Batch linking
  - Auto-detects sheets with "rack" in name
  - Arranges in grid (5 per row)
  - Creates hyperlinks for all

**Menu Action Wrappers**:
- `createNewTowerLayout()`: Prompts for name, creates tower
- `createNewOverviewLayout()`: Prompts for name and size, creates overview
- `createNewRackConfig()`: Prompts for name, creates rack config
- `autoLinkRacksToOverviewAction()`: Prompts for overview, auto-links

**Design Pattern**: Factory pattern - creates configured objects

---

#### 8. FormattingUtils.gs - Cell and Sheet Styling

**Responsibility**: Consistent visual styling across all sheets

**Capabilities**:
- Header row formatting (blue background, white text, bold)
- Category-based cell coloring
- Frozen panes (headers, row labels)
- Column auto-sizing
- Alternating row colors
- Border styling for grids

**Not** directly called by users - used by other modules (BOMBuilder, LayoutManager)

---

#### 9. Config.gs - Global Configuration Constants

**Responsibility**: Define system-wide constants

**Typical Contents**:
- API endpoints
- Default values
- Magic numbers (e.g., max grid size = 20)
- Error messages
- Timeout values

---

#### 10-14. Legacy/Placeholder Modules

The following modules exist but are less actively used in current workflows:

- **DataMapper.gs**: Item data transformation utilities
- **LegendManager.gs**: Legend generation for overview sheets
- **OverheadManager.gs**: Legacy overhead view generation
- **RackPopulator.gs**: Legacy rack population logic
- **SheetManager.gs**: Sheet manipulation utilities

These may be refactored or deprecated in future versions as functionality consolidated into core modules.

---

### User Interface Modules (5 HTML Files)

#### 1. LoginWizard.html - Initial Authentication Dialog

**Purpose**: First-time credential configuration

**User Flow**:
1. User selects `Configure Arena Connection`
2. Modal dialog appears (400px × 500px)
3. Input fields: Email, Password, Workspace ID
4. "Test Connection" button validates credentials
5. Success → credentials saved, dialog closes
6. Failure → error message, allow retry

**Design**:
- Clean, professional styling (Google blue #1a73e8)
- Clear field labels and help text
- Input validation (required fields)
- Success/error messaging
- Password field (masked input)

**Technical Details**:
- Communicates with server via `google.script.run`
- Calls `saveArenaCredentials()` on server
- Async pattern with success/failure handlers

---

#### 2. ItemPicker.html - Interactive Item Selection Sidebar

**Purpose**: Browse, search, and select Arena items

**Layout**:
```
┌──────────────────────────────┐
│ Arena Item Picker            │ ← Header
├──────────────────────────────┤
│ How to use: [instructions]   │ ← Help text
├──────────────────────────────┤
│ ⭐ Favorite Categories        │ ← Favorites
│ [Server] [Network] [Storage] │    (buttons)
├──────────────────────────────┤
│ Category:                    │
│ [Search categories...]       │ ← Category search
│ [▼ Dropdown (5 visible)]     │    (filterable)
│                              │
│ Lifecycle: [Production ▼]    │ ← Lifecycle filter
│                              │
│ Search Items:                │
│ [🔍 Search...]               │ ← Item search
├──────────────────────────────┤
│ 47 items found               │ ← Result count
├──────────────────────────────┤
│ ┌──────────────────────┐     │
│ │ [Production] SRV-100 │ 2x  │ ← Item card
│ │ Server 2U Dual Xeon  │     │    (quantity badge)
│ │ Category: Server     │     │
│ └──────────────────────┘     │
│ ┌──────────────────────┐     │
│ │ [Production] NET-24  │     │
│ │ 24-port Switch       │     │
│ │ Category: Network    │     │
│ └──────────────────────┘     │
│ [... more items ...]         │
└──────────────────────────────┘
│ Quantity Tracker             │ ← Bottom panel
│ SRV-100:  2                  │    (items in sheet)
│ NET-24:   1                  │
└──────────────────────────────┘
```

**Interactive Elements**:

**Favorite Buttons**:
- Generated from user's starred categories
- Click → filter to that category instantly
- Active button highlighted in blue
- Empty state: "No favorites yet"

**Category Search**:
- Type → dropdown filters in real-time
- Shows count: "5 of 47 categories"
- Case-insensitive matching
- Searches full category path

**Category Dropdown**:
- Size=5 (shows 5 options at once)
- Scrollable if more categories
- Shows filtered list from search

**Lifecycle Filter**:
- Defaults to "Production"
- Options: All, Production, Prototype, In Development, Obsolete
- Most users work only with Production items

**Item Search**:
- Searches: item number, name, description
- Real-time filtering (updates as you type)
- Case-insensitive
- Combined with category and lifecycle filters

**Item Cards**:
- Color-coded border (by category)
- Lifecycle badge (top-left, color-coded)
- Item number (bold, blue)
- Revision (gray badge)
- Name/description
- Category tag (color-coded background)
- Quantity badge (if item in sheet, red badge with count)
- Click card → highlights, ready to insert

**Quantity Tracker**:
- Auto-refreshes every 5 seconds
- Shows items currently in active sheet
- Item number (blue, clickable)
- Count (red badge)
- Scrollable if many items

**Technical Implementation**:
- Pure JavaScript (no frameworks)
- Loads data via `google.script.run.loadItemPickerData()`
- Client-side filtering (fast, no round-trips)
- Event-driven updates
- CSS transitions for smooth UX

---

#### 3. ConfigureColors.html - Category Color Configuration

**Purpose**: Assign colors to categories for visual differentiation

**Layout**:
```
┌────────────────────────────────────┐
│ Configure Category Colors          │
├────────────────────────────────────┤
│ Assign colors to categories.       │
│ These colors will be used in cells │
│ and the Item Picker.               │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ Item\Part\Server         ⭐ 🎨 │ │ ← Category row
│ ├────────────────────────────────┤ │    (name, star, color)
│ │ Item\Part\Network        ⭐ 🎨 │ │
│ ├────────────────────────────────┤ │
│ │ Item\Part\Storage          🎨 │ │ ← Not favorited
│ ├────────────────────────────────┤ │
│ │ Item\Document\Policy       🎨 │ │
│ └────────────────────────────────┘ │
│                                    │
│ [Reset to Defaults] [Cancel] [Save]│
└────────────────────────────────────┘
```

**Interactive Elements**:

**Star Icon** (⭐):
- Click to toggle favorite
- Dim (opacity 0.3) when not favorited
- Bright (opacity 1.0) when favorited
- Tooltip: "Toggle favorite"

**Color Picker** (🎨):
- Native browser color picker
- Click → color palette appears
- Select color → updates immediately (in memory)
- Must click "Save" to persist

**Category List**:
- Scrollable (max-height 400px)
- All Arena categories shown
- Full category paths displayed
- Gray background for each row

**Buttons**:
- **Reset to Defaults**: Restores datacenter-focused defaults
- **Cancel**: Close without saving
- **Save Colors**: Persists both colors AND favorites

**Save Behavior**:
- Saves category colors to Script Properties
- Saves favorite category GUIDs to Script Properties
- Success message: "Category colors and favorites saved successfully!"
- Auto-closes after 1.5 seconds

---

#### 4. ConfigureColumns.html - Attribute Column Selection

**Purpose**: Choose which Arena attributes appear as columns in sheets

**Layout**:
```
┌─────────────────────────────────────┐
│ Configure Item Columns              │
├─────────────────────────────────────┤
│ Select attributes to show as        │
│ columns when inserting items.       │
├─────────────────────────────────────┤
│ Search: [🔍 Filter attributes...]   │ ← Attribute search
│                                     │
│ ☑ Description                       │ ← Checkbox + name
│ ☐ Manufacturer                      │
│ ☑ Part Number (Vendor)              │
│ ☐ Lead Time                         │
│ ☑ Category                          │
│ ☐ Weight                            │
│ ... (scrollable list)               │
│                                     │
│ Selected: 3 attributes              │ ← Selection count
│                                     │
│ ─────────────────────────────────── │
│ Attribute Groups:                   │ ← Groups section
│ [Server Attributes ▼]               │
│ [Load Group] [Save Current As...]   │
├─────────────────────────────────────┤
│ [Cancel] [Save Configuration]       │
└─────────────────────────────────────┘
```

**Features**:

**Attribute Search**:
- Filters attribute list in real-time
- Case-insensitive
- Searches attribute names only

**Checkboxes**:
- Check → attribute included in columns
- Uncheck → excluded
- Pre-checked for currently selected attributes

**Custom Headers**:
- Input field next to each checkbox (not shown in diagram)
- User can rename column header
- Example: "revisionNumber" → "Rev"

**Selection Count**:
- Shows "Selected: X attributes"
- Updates dynamically as user checks/unchecks

**Attribute Groups**:
- **Save Current As**: Prompts for name, saves current selection
- **Load Group**: Dropdown of saved groups, click to load
- Groups stored in Script Properties
- Shared across all sheets (user can reuse configurations)

**Use Case Example**:
User configures servers frequently. Creates group "Server Attributes" with: Description, Manufacturer, Part Number, Power Consumption, Weight. Later, when configuring network sheet, loads "Network Attributes" group with different attributes.

---

#### 5. ConfigureBOMLevels.html - Hierarchy Configuration

**Purpose**: Define BOM level structure and category assignments

**Layout**:
```
┌──────────────────────────────────────┐
│ Configure BOM Hierarchy              │
├──────────────────────────────────────┤
│ Drag to reorder hierarchy levels.    │
│ Assign categories to each level.     │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ☰ Level 0: Hall                  │ │ ← Drag handle
│ │    Category: [Hall ▼]            │ │    + level
│ ├──────────────────────────────────┤ │    + category dropdown
│ │ ☰ Level 1: Pod                   │ │
│ │    Category: [Pod ▼]             │ │
│ ├──────────────────────────────────┤ │
│ │ ☰ Level 2: Rack                  │ │
│ │    Category: [Rack ▼]            │ │
│ ├──────────────────────────────────┤ │
│ │ ☰ Level 3: Server                │ │
│ │    Category: [Server ▼]          │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Add Level] [Remove Last Level]      │
│                                      │
│ [Reset to Defaults] [Cancel] [Save]  │
└──────────────────────────────────────┘
```

**Interactive Elements**:

**Drag Handles** (☰):
- Click and drag to reorder levels
- Visual feedback during drag
- Drop to set new position
- Levels renumber automatically

**Category Dropdowns**:
- Populated from Arena categories
- Assign category to each level
- Determines which items go at which level

**Add/Remove Buttons**:
- Add Level → appends new level at bottom
- Remove Last Level → deletes bottom level
- Validation prevents removing all levels

**Reset to Defaults**:
- Restores datacenter-focused hierarchy:
  - Level 0: Hall
  - Level 1: Pod
  - Level 2: Rack
  - Level 3: Server
  - Level 4: Component

**Validation**:
- Cannot have gaps (e.g., 0, 1, 3 - missing 2)
- Cannot have duplicate levels
- Must have at least one level
- Shows error if validation fails

---

## Data Flow and Integration

### Authentication Flow

```
User Action: Configure Arena Connection
    ↓
User provides: email, password, workspace ID
    ↓
Frontend (LoginWizard.html)
    ↓
google.script.run.saveArenaCredentials()
    ↓
Backend (Authorization.gs)
    ↓
Store in User Properties (encrypted)
    ↓
Call Arena /api/login endpoint
    ↓
Arena returns session ID (90-min validity)
    ↓
Store session ID in User Properties
    ↓
Success → Close dialog
```

**Subsequent API Calls**:
```
User Action: Show Item Picker
    ↓
Backend retrieves session ID from User Properties
    ↓
Include in request header: arena_session_id: {sessionId}
    ↓
Arena validates session
    ↓
If valid → return data
If expired (401) → Auto re-login → retry request
```

---

### Item Picker Data Flow

```
User: Arena Data Center → Show Item Picker
    ↓
Frontend: Display loading spinner
    ↓
google.script.run.loadItemPickerData()
    ↓
Backend (Code.gs):
    ├─ ArenaAPIClient.getAllItems(400)
    │   ├─ Paginated requests (400 items each)
    │   ├─ Handle "Results" vs "results" naming
    │   └─ Concatenate all pages
    ├─ Map Arena properties to standardized format
    │   ├─ Handle item.Number vs item.number
    │   ├─ Handle item.Category vs item.category
    │   └─ Extract nested properties (category.name)
    ├─ CategoryManager.getCategoriesWithFavorites()
    │   ├─ Fetch categories from Arena
    │   ├─ Load favorites from Script Properties
    │   └─ Merge (add isFavorite flag)
    └─ CategoryManager.getCategoryColors()
        └─ Load from Script Properties
    ↓
Return to Frontend: { items: [], categories: [], colors: {} }
    ↓
Frontend (ItemPicker.html):
    ├─ Populate favorite buttons (starred categories)
    ├─ Populate category dropdown (all categories)
    ├─ Store allItems array in memory
    └─ Apply initial filters (lifecycle = Production)
    ↓
Display: Item cards rendered, quantity tracker populated
```

**User Interaction - Category Search**:
```
User: Types "server" in category search box
    ↓
JavaScript: input event listener fires
    ↓
Filter allCategories array (client-side)
    ↓
Update category dropdown (show only matches)
    ↓
Show count: "5 of 47 categories"
    ↓
User selects category from filtered list
    ↓
applyFilters() runs
    ↓
Filter allItems by selected category
    ↓
Re-render item cards
```

**User Interaction - Item Insertion**:
```
User: Clicks item card in Item Picker
    ↓
JavaScript: Item highlighted (blue background)
    ↓
google.script.run.setSelectedItem(item)
    ↓
Backend: Store item in User Properties
    ↓
User: Clicks cell in spreadsheet
    ↓
Backend: getSelectedItem() from User Properties
    ↓
Insert item.number into cell
    ↓
Get category color from categoryColors map
    ↓
Apply background color to cell
    ↓
populateItemAttributes(row, item):
    ├─ Get configured columns from Script Properties
    ├─ For each column:
    │   ├─ Extract attribute value from item data
    │   └─ Insert into adjacent cell
    └─ Apply category color to all cells
    ↓
clearSelectedItem() from User Properties
```

---

### BOM Pull Flow

```
User: BOM Operations → Pull BOM from Arena
    ↓
Prompt: Enter item number (parent item)
    ↓
Backend (BOMBuilder.gs):
    ├─ ArenaAPIClient.searchItems(itemNumber)
    ├─ Get item GUID
    ├─ GET /items/{guid}/bom (Arena endpoint)
    ├─ Parse BOM response:
    │   ├─ Extract item GUIDs from BOM lines
    │   ├─ Fetch item details for each (item number, name, category)
    │   └─ Build hierarchy structure (levels, quantities)
    └─ Format for spreadsheet:
        ├─ Calculate indentation (level * 2 spaces)
        ├─ Get category colors
        └─ Build rows array
    ↓
Sheet Operations:
    ├─ Clear existing data (keep headers)
    ├─ Insert rows:
    │   ├─ Level column
    │   ├─ Qty column
    │   ├─ Item Number (indented by level)
    │   ├─ Item Name
    │   ├─ Category
    │   └─ User-configured attribute columns
    ├─ Apply category colors (row backgrounds)
    ├─ Freeze header row
    └─ Auto-resize columns
    ↓
Success message: "Pulled BOM with 42 lines"
```

---

### BOM Push Flow

```
User: BOM Operations → Push BOM to Arena
    ↓
Prompt: Enter parent item number (or blank for new)
    ↓
Backend (BOMBuilder.gs):
    ├─ buildBOMStructure(activeSheet):
    │   ├─ Detect columns: Level, Qty, Item Number
    │   ├─ Read all rows (skip header)
    │   ├─ Parse hierarchy:
    │   │   ├─ Remove indentation from item numbers
    │   │   ├─ Validate quantities (numeric)
    │   │   └─ Build array: [{ level, qty, itemNumber }, ...]
    │   └─ Validation: warn if missing columns
    ├─ Get parent item GUID:
    │   ├─ If item number provided: search Arena, get GUID
    │   └─ If blank: createItem(), get new GUID
    └─ syncBOMToArena(client, parentGuid, bomLines):
        ├─ DELETE /items/{parentGuid}/bom (clear existing)
        ├─ For each BOM line:
        │   ├─ Search Arena for child item by number
        │   ├─ Get child item GUID
        │   ├─ POST /items/{parentGuid}/bom
        │   │   Body: { item: {guid}, quantity, level }
        │   ├─ Wait 200ms (rate limiting)
        │   └─ Log success/failure
        └─ Error handling: continue on individual failures
    ↓
Success message: "Pushed BOM with 42 lines"
```

---

### Consolidated BOM Flow

```
User: BOM Operations → Create Consolidated BOM
    ↓
Backend (BOMBuilder.gs):
    ├─ Auto-detect rack sheets:
    │   ├─ Get all sheet names in workbook
    │   ├─ Filter: sheets with "rack" or "full" in name
    │   └─ Result: ["Rack A", "Rack B", "Rack C", ...]
    ├─ aggregateQuantities(sheetNames):
    │   ├─ For each sheet:
    │   │   ├─ Read all cells
    │   │   ├─ Identify cells with Arena item numbers
    │   │   └─ Sum quantities by item number
    │   └─ Result: { "SRV-100": 12, "NET-24": 3, ... }
    ├─ Fetch item details:
    │   ├─ For each unique item number:
    │   │   ├─ ArenaAPIClient.searchItems(itemNumber)
    │   │   └─ Get: name, category, lifecycle
    │   └─ Build enriched data
    ├─ Sort:
    │   ├─ Primary: category
    │   └─ Secondary: item number
    └─ Create "Consolidated BOM" sheet:
        ├─ Headers: Item Number, Name, Category, Total Qty, Source Sheets
        ├─ Populate rows
        ├─ Apply category colors
        ├─ Format as table
        └─ Auto-resize columns
    ↓
Success message: "Consolidated 47 unique items from 12 racks"
```

---

## Configuration and Customization

### Configuration Storage Architecture

**User Properties** (user-specific, private):
- Arena credentials (email, password, workspace ID)
- Arena session ID (auto-refreshed)
- Selected item (temporary, during insertion workflow)

**Script Properties** (shared across all users):
- Category colors (color map)
- BOM hierarchy (level definitions)
- Item columns (attribute selections)
- Attribute groups (named column sets)
- Favorite categories (GUIDs)

**Why This Split**:
- Credentials must be private (User Properties)
- Configuration should be shared (Script Properties)
- Team members see same categories, colors, hierarchies
- Each team member has own Arena login

### Customization Points

**1. Category Colors**:
- Default: Datacenter-focused (Server = pink, Network = amber, etc.)
- User can assign any hex color to any category
- Colors applied: sheet cells, Item Picker cards, legends

**2. BOM Hierarchy**:
- Default: Hall → Pod → Rack → Server → Component
- User can reorder levels (drag and drop)
- User can add/remove levels (min 1, no max)
- User can assign different categories to levels

**3. Item Columns**:
- Default: Description, Category, Lifecycle
- User can select from all Arena attributes
- User can rename column headers
- User can save as named groups for reuse

**4. Favorite Categories**:
- Default: None
- User stars categories in Configure Colors
- Favorites appear as buttons in Item Picker
- Speeds up filtering for frequently-used categories

**5. Layout Templates**:
- Tower: Fixed 42U (industry standard)
- Overview: Customizable grid size (1-20)
- Rack Config: Standard BOM columns + user-configured attributes

### Multi-User Considerations

**Scenario**: 5 engineers sharing workbook

**Shared Configuration** (Script Properties):
- All see same category colors
- All see same BOM hierarchy
- All see same favorite categories (team favorites)
- Consistency across team

**Private Configuration** (User Properties):
- Each has own Arena credentials
- Each has own session ID
- Credentials never shared
- Activity logged to own account

**Collaboration Workflow**:
- Engineer A configures category colors → All engineers see new colors
- Engineer B creates attribute group "Server Attrs" → All can load group
- Engineer C marks Server as favorite → All see Server button in Item Picker
- No conflicts, no overwrites

---

## Limitations and Constraints

### Technical Limitations

**Google Apps Script**:
- **Execution time**: 6-minute max per function call
  - Impact: Very large BOMs (1000+ lines) may timeout
  - Mitigation: Batch operations, progress tracking
- **Trigger quotas**: 90 triggers per user per day
  - Impact: Auto-refresh limited
  - Mitigation: Manual refresh on demand
- **External request quota**: 20,000 per day per user
  - Impact: Intensive API usage may hit limit
  - Mitigation: Caching, batch requests
- **Memory limit**: ~100MB per execution
  - Impact: Cannot load extremely large datasets in memory
  - Mitigation: Streaming, pagination

**Arena API**:
- **Rate limiting**: Unspecified, but exists
  - Impact: Rapid requests may fail
  - Mitigation: 200ms delays between requests
- **Session timeout**: 90 minutes
  - Impact: Long idle periods require re-auth
  - Mitigation: Auto-refresh at 80 minutes
- **Pagination limit**: 400 items per request
  - Impact: Must paginate for workspaces with 1000+ items
  - Mitigation: getAllItems() handles pagination automatically
- **BOM depth**: Unknown limit on hierarchy levels
  - Impact: Very deep BOMs may not sync correctly
  - Mitigation: Document best practices (max 5 levels)

**Google Sheets**:
- **Cell limit**: 10 million cells per spreadsheet
  - Impact: Very large deployments may hit limit
  - Mitigation: Use multiple workbooks
- **Formula limit**: 50,000 per spreadsheet
  - Impact: Heavy use of hyperlinks may hit limit
  - Mitigation: Static links instead of formulas

### Functional Limitations

**No Offline Mode**:
- Requires internet connection for Arena API
- Sheets work offline, but Arena integration requires connectivity

**No Real-Time Collaboration**:
- Multiple users can edit sheets (Google Sheets handles this)
- But Arena sync is manual (pull/push)
- No live updates when Arena data changes
- Users must manually refresh

**No Change Tracking**:
- Cannot see who changed what in Arena
- No diff view between sheet and Arena
- No merge conflict resolution
- Last write wins

**No Partial BOM Sync**:
- Push BOM deletes all existing lines, recreates from scratch
- Cannot update just one line
- Cannot append to existing BOM
- Full replacement only

**Category Search Performance**:
- Client-side filtering (fast for <100 categories)
- May slow down with 500+ categories
- No server-side search

**Quantity Tracker Performance**:
- Fetches all items from Arena to validate (takes 1-2 seconds)
- Scans entire sheet every 5 seconds
- May be slow for sheets with 10,000+ cells
- No background processing

### Workflow Constraints

**Must Use Arena Item Numbers**:
- Cannot create items on the fly
- All items must pre-exist in Arena
- Item numbers must be exact match (case-sensitive)

**Linear Workflow for BOM Push**:
1. Build sheet
2. Validate items exist
3. Delete Arena BOM
4. Recreate Arena BOM
- Cannot skip steps
- Cannot partial update

**Sheet Structure Requirements**:
- Pull BOM: Expects specific columns (Level, Qty, Item Number)
- Push BOM: Requires these columns present
- Auto-detection helps but not foolproof

**Single Workspace**:
- Credentials tied to one workspace
- Cannot work across multiple Arena workspaces simultaneously
- Must reconfigure to switch workspaces

---

## Future Enhancements

### Performance Optimizations

**Caching Strategy**:
- Cache Arena items in Script Properties (refresh hourly)
- Cache categories (refresh daily)
- Cache attributes (refresh on demand)
- Reduces API calls by 90%

**Background Processing**:
- Async quantity tracking (web worker pattern)
- Progress indicators for long operations
- Batch BOM sync (parallel requests)

**Lazy Loading**:
- Load Item Picker data on demand (not all upfront)
- Virtual scrolling for long item lists
- Paginate category list

### User Experience Improvements

**Drag-and-Drop**:
- Drag items from Item Picker to cells
- Drag rows to reorder BOM
- Drag to resize columns

**Inline Editing**:
- Edit item quantities directly in Item Picker
- Edit attribute values in sheets with validation
- Auto-save changes

**Keyboard Shortcuts**:
- Ctrl+K: Open Item Picker
- Ctrl+Shift+P: Pull BOM
- Ctrl+Shift+U: Push BOM
- Esc: Close Item Picker

**Undo/Redo**:
- Track BOM changes
- Revert to previous version
- Compare versions side-by-side

### Collaboration Features

**Comments and Notes**:
- Add notes to items (stored in sheet)
- Team comments on BOM lines
- @mentions for team members

**Change Notifications**:
- Email alerts when BOM pushed to Arena
- Slack integration for team updates
- Changelog view

**Version Control**:
- Named BOM versions (v1, v2, v3)
- Compare versions
- Rollback to previous version

### Advanced BOM Features

**BOM Comparison**:
- Compare sheet BOM vs Arena BOM
- Highlight differences
- Merge changes

**Reference Designators**:
- Support Arena ref des custom fields
- Auto-populate based on rack position
- Validation for duplicates

**Alternates and Substitutes**:
- Define alternate items
- Specify substitution rules
- Fallback options for procurement

**Multi-Level Quantity Rollup**:
- Calculate effective quantities at each level
- Show "total needed" for components
- Account for hierarchy multipliers

### Integration Enhancements

**Export Formats**:
- Export to CSV (for ERP import)
- Export to PDF (for approvals)
- Export to Excel (for offline work)

**Import Capabilities**:
- Import BOM from CSV
- Import from other PLM systems
- Bulk item creation in Arena

**ERP Integration**:
- Push consolidated BOM to SAP, Oracle, etc.
- Sync inventory levels
- Track procurement status

### Visualization Enhancements

**3D Rack View**:
- Visual 3D representation of rack
- Click U-position to see item details
- Export to CAD formats

**Heatmaps**:
- Power consumption heatmap (by rack)
- Weight distribution heatmap
- Cost heatmap

**Gantt Charts**:
- Deployment timeline
- Item lead times
- Critical path analysis

**Network Diagrams**:
- Auto-generate from network items
- Show connections between switches/servers
- Export to Visio

### Data Validation and Quality

**Pre-Push Validation**:
- Check for missing items
- Validate quantities (no negatives, no blanks)
- Check hierarchy consistency
- Warn about duplicate ref des

**Arena Data Quality**:
- Identify items missing categories
- Flag items without lifecycle
- Report incomplete attributes

**Automated Testing**:
- Test BOM push/pull with sample data
- Validate formatting on template generation
- Check color configuration consistency

### Reporting and Analytics

**Usage Reports**:
- Most-used items
- Category distribution
- Lifecycle breakdown
- Cost analysis

**Deployment Reports**:
- Total rack count
- Total power consumption
- Total weight
- Floor space required

**Procurement Reports**:
- Items by vendor
- Lead time analysis
- Cost by category
- Reorder point recommendations

---

## Conclusion

This application represents a sophisticated integration between Google Sheets and PTC Arena PLM, purpose-built for datacenter infrastructure planning. By combining Arena's robust item master data with Sheets' flexibility and familiarity, it enables infrastructure engineers to work efficiently while maintaining data integrity.

**Key Strengths**:
- Seamless Arena integration (bidirectional sync)
- User-friendly Item Picker (visual, searchable, filterable)
- Flexible configuration (colors, hierarchies, columns, favorites)
- Pre-built templates (tower, overview, rack)
- Quantity aggregation (consolidated BOMs)

**Production Readiness**: ~85% complete, core workflows fully functional

**Ideal Use Case**: Teams planning datacenter deployments with 10-500 racks, using Arena for item master, requiring visual layout planning and procurement aggregation.

**Not Ideal For**: Real-time collaboration, offline-first workflows, non-Arena PLM systems, deployments with 10,000+ unique items (performance concerns).

---

**Document Version**: 1.0
**Last Updated**: Session 6
**Status**: Comprehensive documentation complete
