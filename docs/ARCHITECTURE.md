# Architecture Documentation

## System Architecture

### Overview

Arena Data Center is built on Google Apps Script, a JavaScript runtime that executes server-side within Google's infrastructure. The application follows a modular architecture with clear separation of concerns.

```
┌────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│  HTML Templates (sidebars, modals, configuration UIs)      │
└─────────────────────┬──────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
┌────────▼──────────┐    ┌────────▼─────────┐
│   UI Controllers  │    │  Event Handlers   │
│  (Code.gs)        │    │  (Code.gs)        │
└────────┬──────────┘    └────────┬─────────┘
         │                         │
         └────────────┬────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ BOM Builder  │  │ Rack Manager │  │ Layout Mgr   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Category Mgr │  │ Config Mgr   │  │ Legend Mgr   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     Data Access Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Arena API   │  │  Sheet Ops   │  │  Storage     │      │
│  │  Client      │  │              │  │  (Props/Cache)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### Presentation Layer

#### HTML Templates
- **Purpose:** Provide custom UI beyond standard spreadsheet interface
- **Technology:** HTML5, CSS3, JavaScript (client-side)
- **Communication:** `google.script.run` for calling server-side functions

**File List:**
- `ItemPicker.html` - Sidebar for browsing and selecting Arena items
- `RackPicker.html` - Sidebar for browsing and selecting racks
- `HelpModal.html` - Tabbed help documentation modal
- `ConfigureColors.html` - Category color configuration dialog
- `ConfigureRackColors.html` - Rack color configuration dialog
- `ConfigureColumns.html` - Item column configuration dialog
- `ConfigureBOMLevels.html` - BOM hierarchy configuration dialog
- `LoginWizard.html` - Arena connection setup wizard

**Communication Pattern:**
```javascript
// Client-side (HTML)
google.script.run
  .withSuccessHandler(function(result) {
    // Handle success
  })
  .withFailureHandler(function(error) {
    // Handle error
  })
  .serverSideFunction(param1, param2);

// Server-side (Code.gs)
function serverSideFunction(param1, param2) {
  // Process and return data
  return { success: true, data: result };
}
```

### UI Controllers (Code.gs)

**Responsibilities:**
- Menu creation and management
- Event handling (cell selection, edits)
- Showing/hiding UI components
- Bridging user actions to business logic

**Key Functions:**
- `onOpen(e)` - Creates custom menu (lines 16-43)
- `onSelectionChange(e)` - Handles cell selection for item/rack insertion
- `showItemPicker()` - Displays item picker sidebar
- `showRackPicker()` - Displays rack picker sidebar
- `showHelp()` - Displays help modal
- `loadItemPickerData()` - Loads data for item picker
- `insertSelectedItem()` - Inserts selected item into sheet

**Pattern:**
```javascript
function menuAction() {
  var ui = SpreadsheetApp.getUi();

  // Validate prerequisites
  if (!isAuthorized()) {
    ui.alert('Not configured...');
    return;
  }

  try {
    // Call business logic
    var result = businessLogicFunction();

    // Show result to user
    if (result.success) {
      ui.alert('Success', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('Error', result.message, ui.ButtonSet.OK);
    }
  } catch (error) {
    Logger.log('Error: ' + error.message);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}
```

### Business Logic Layer

#### BOMBuilder.gs

**Responsibilities:**
- BOM operations (build, push, pull, sync)
- POD/Row/Rack structure creation
- Arena integration for BOM data
- BOM hierarchy management

**Key Components:**

1. **BOM Pulling** (lines 11-55)
   - `pullBOM(itemNumber)` - Main entry point
   - `populateBOMToSheet(sheet, bomLines, parentItem)` - Populates sheet with BOM data

2. **BOM Pushing** (lines 1578-1820)
   - `pushPODStructureToArena()` - Main orchestration function
   - `validateRowLocationAttribute()` - Validates Arena setup
   - `identifyCustomRacks()` - Finds racks needing creation
   - `createCustomRackItems()` - Creates custom racks with prompts
   - `createRowItems()` - Creates Row items with Row Location attribute
   - `createPODItem()` - Creates top-level POD assembly
   - `updateOverviewWithPODInfo()` - Updates sheet with links

3. **BOM Building** (lines 506-767)
   - `createConsolidatedBOMSheet()` - Creates consolidated BOM sheet
   - `buildConsolidatedBOMFromOverview()` - Scans overview and aggregates
   - `scanOverviewForRacks()` - Finds all rack placements
   - `scanOverviewByRow()` - Row-by-row scanning for POD structure

4. **BOM Syncing** (lines 317-381)
   - `syncBOMToArena(client, parentGuid, bomLines)` - Syncs BOM to Arena
   - Deletes existing lines, creates new ones

**Data Flow:**
```
User initiates → Validation → Data gathering → Arena operations → Sheet updates → Success
```

#### RackConfigManager.gs

**Responsibilities:**
- Rack configuration sheet management
- Rack metadata handling
- Rack creation/deletion/validation

**Key Functions:**
- `createNewRackConfiguration()` - Creates new rack config sheet (line 20)
- `getRackConfigMetadata(sheet)` - Extracts metadata from row 1 (line 195)
- `isRackConfigSheet(sheet)` - Validates rack config format (line 223)
- `getAllRackConfigTabs()` - Lists all rack configs (line 231)
- `findRackConfigTab(itemNumber)` - Finds rack by item number (line 256)
- `getRackConfigChildren(sheet)` - Extracts child items from rack (line 299)
- `deleteRackConfiguration(sheetName)` - Deletes rack config (line 322)

**Rack Config Sheet Structure:**
```
Row 1 (Metadata):
  A1: "PARENT_ITEM"
  B1: Item Number
  C1: Item Name
  D1: Description

Row 2 (Headers):
  A2: "Item Number"
  B2: "Name"
  C2: "Description"
  D2: "Category"
  E2: "Qty"
  F2+: Custom attributes

Row 3+: BOM Data
```

#### LayoutManager.gs

**Responsibilities:**
- Overview layout creation and management
- Grid sizing and formatting
- Rack placement validation
- Legend creation

**Key Functions:**
- `createNewOverviewLayout()` - Creates overview sheet with grid (line 15)
- `createOverviewLayout(sheetName, rows, positions)` - Core creation logic (line 91)
- `linkOverviewToRack(overviewSheetName, row, col, rackSheetName)` - Creates hyperlinks (line 272)
- `autoLinkRacksToOverview()` - Auto-links racks to overview (line 298)

**Overview Sheet Structure:**
```
Row 1: Merged title cell
Row 2: Empty
Row 3: Headers (row numbers in col 1, "Pos 1", "Pos 2"... in cols 2+)
Row 4+: Grid data
  Col 1: Row numbers (1, 2, 3...)
  Col 2+: Rack placements (item numbers with hyperlinks and colors)
```

#### CategoryManager.gs

**Responsibilities:**
- Arena category management
- Category color configuration
- Category caching
- BOM level configuration

**Key Functions:**
- `getArenaCategories()` - Gets all categories from Arena (line 142)
- `getCategoryColors()` - Gets category color mappings (line 252)
- `setCategoryColor(category, color)` - Sets category color (line 271)
- `getCategoryColor(categoryName)` - Gets color for category (line 301)
- `getBOMHierarchy()` - Gets BOM level configuration (line 329)
- `getBOMLevelForCategory(categoryName)` - Gets level for category (line 348)
- `getArenaAttributes()` - Gets all Arena attributes (line 167)
- `getAttributeValue(item, attributeGuid)` - Extracts attribute value (line 376)

**Caching Strategy:**
```javascript
// 6-hour cache for categories (rarely change)
var cache = CacheService.getUserCache();
var cached = cache.get('arena_categories');
if (cached) {
  return JSON.parse(cached);
}

var categories = client.getCategories();
cache.put('arena_categories', JSON.stringify(categories), 21600);
return categories;
```

#### CategoryManager_Favorites.gs

**Responsibilities:**
- Category favorites management
- BOM level favorites
- User preference storage

**Key Functions:**
- `getFavoriteCategories()` - Gets favorite categories (line 7)
- `setFavoriteCategories(categories)` - Sets favorites (line 25)
- `isFavoriteCategory(category)` - Checks if favorite (line 35)
- `toggleFavoriteCategory(category)` - Toggles favorite status (line 47)

### Data Access Layer

#### ArenaAPI.gs

**Responsibilities:**
- HTTP client for Arena API
- Session management
- Request/response handling
- Error handling and retries

**Class Structure:**
```javascript
var ArenaAPIClient = function() {
  this.apiBase = credentials.apiBase;
  this.workspaceId = credentials.workspaceId;
  this.sessionId = getValidSessionId();
};

// Core request method
ArenaAPIClient.prototype.makeRequest = function(endpoint, options) {
  // Build headers with session ID
  // Handle 401 (re-login)
  // Parse response
  // Handle errors
};

// API wrappers
ArenaAPIClient.prototype.getItems = function(options) { ... };
ArenaAPIClient.prototype.createItem = function(itemData) { ... };
ArenaAPIClient.prototype.getItemByNumber = function(itemNumber) { ... };
// ... more wrappers
```

**Key Functions:**
- `makeRequest(endpoint, options)` - Core HTTP client (line 29)
- `testConnection()` - Tests API connectivity (line 126)
- `getItems(options)` - Gets items with filters (line 151)
- `createItem(itemData)` - Creates new item (line 190)
- `updateItem(itemId, itemData)` - Updates item (line 204)
- `setItemAttribute(itemId, attributeGuid, value)` - Sets custom attribute (line 219)
- `searchItems(query, options)` - Searches items (line 236)
- `getItemByNumber(itemNumber)` - Gets item by number (line 261)
- `getAllItems(batchSize)` - Gets all items with pagination (line 361)

#### Authorization.gs

**Responsibilities:**
- Credential management
- Login/logout
- Session storage
- Authorization state

**Key Functions:**
- `getArenaCredentials()` - Gets stored credentials (line 7)
- `setArenaCredentials(apiBase, email, password, workspaceId)` - Stores credentials (line 22)
- `clearCredentials()` - Clears credentials and session (line 41)
- `isAuthorized()` - Checks if credentials exist (line 53)
- `loginToArena(email, password, apiBase)` - Performs login (line 65)
- `getValidSessionId()` - Gets or creates session ID (line 101)
- `clearSession()` - Clears cached session (line 127)

**Storage:**
```javascript
// Credentials - persistent, user-specific
PropertiesService.getUserProperties()
  .setProperty('arena_api_base', apiBase)
  .setProperty('arena_email', email)
  .setProperty('arena_password', password)
  .setProperty('arena_workspace_id', workspaceId);

// Session ID - cached, 6-hour TTL
CacheService.getUserCache()
  .put('arena_session_id', sessionId, 21600);
```

#### Config.gs

**Responsibilities:**
- Configuration storage/retrieval
- Item columns configuration
- User preferences

**Key Functions:**
- `getItemColumns()` - Gets configured item columns (line 7)
- `setItemColumns(columns)` - Sets item columns (line 24)
- `getDefaultItemColumns()` - Gets default columns (line 44)

#### SheetManager.gs

**Responsibilities:**
- Sheet utilities
- Sheet finding/creation
- Cell operations

**Key Functions:**
- `findSheetByName(name)` - Finds sheet by name (line 7)
- `createSheet(name)` - Creates new sheet (line 23)
- `deleteSheet(name)` - Deletes sheet (line 37)
- `clearSheet(sheet, keepHeaders)` - Clears sheet data (line 51)

### Utility Modules

#### FormattingUtils.gs

**Responsibilities:**
- Formatting helpers
- Color utilities
- Style application

**Key Functions:**
- `applyHeaderFormatting(range)` - Formats headers (line 7)
- `applyCategoryColor(range, category)` - Applies category color (line 21)
- `hexToRgb(hex)` - Converts hex to RGB (line 35)

#### DataMapper.gs

**Responsibilities:**
- Data transformation
- Field mapping
- Normalization

**Key Functions:**
- `mapArenaItemToRow(item)` - Maps Arena item to sheet row (line 7)
- `normalizeArenaResponse(response)` - Normalizes response format (line 29)

## Data Models

### Rack Config Metadata
```javascript
{
  itemNumber: "RACK-001",
  itemName: "Hyperscale Compute Rack",
  description: "Rack description",
  sheetName: "Rack - RACK-001 (Hyperscale...)",
  sheet: SheetObject
}
```

### Rack BOM Child
```javascript
{
  itemNumber: "COMP-001",
  name: "Component Name",
  description: "Component description",
  category: "Category Name",
  quantity: 5,
  attributes: { ... } // Custom attributes
}
```

### Overview Row Data
```javascript
{
  rowNumber: 1,
  sheetRow: 4, // Actual sheet row (1-indexed)
  positions: [
    {
      col: 2,
      positionName: "Pos 1",
      itemNumber: "RACK-001"
    },
    { ... }
  ]
}
```

### BOM Line
```javascript
{
  level: 0,
  itemNumber: "ITEM-001",
  quantity: 5
}
```

### Arena Item (from API)
```javascript
{
  guid: "item-guid",
  number: "ITEM-001",
  name: "Item Name",
  description: "Description",
  category: {
    guid: "cat-guid",
    name: "Category Name"
  },
  attributes: { ... }
}
```

## State Management

### Session State
- Stored in `CacheService.getUserCache()`
- TTL: 6 hours
- Keys: `arena_session_id`

### User Preferences
- Stored in `PropertiesService.getUserProperties()`
- Persistent across sessions
- Keys:
  - `arena_api_base`
  - `arena_email`
  - `arena_password`
  - `arena_workspace_id`
  - `item_columns`
  - `category_colors`
  - `favorite_categories`
  - `bom_hierarchy`
  - `rack_colors`

### Document State
- Stored in spreadsheet sheets and cells
- Rack configurations in separate sheets
- Overview layouts in overview sheets
- Configuration data in hidden sheets (if needed)

## Design Patterns

### Module Pattern
Each `.gs` file is a module with related functions grouped together.

### Singleton Pattern
API client and managers created once per execution:
```javascript
var client = new ArenaAPIClient(); // Created per request context
```

### Repository Pattern
Arena API client abstracts data access:
```javascript
// Business logic doesn't know about HTTP
var items = client.getAllItems();

// API client handles HTTP details
ArenaAPIClient.prototype.getAllItems = function() {
  // HTTP, pagination, error handling
};
```

### Command Pattern
Menu actions are commands:
```javascript
.addItem('Action Name', 'commandFunction')

function commandFunction() {
  // Execute command
}
```

### Builder Pattern
BOM building and layout creation use builders:
```javascript
var bomBuilder = buildConsolidatedBOMFromOverview(overviewSheet);
var layout = createOverviewLayout(name, rows, positions);
```

## Extension Points

### Adding New Menu Items
```javascript
// Code.gs
ui.createMenu('Arena Data Center')
  .addItem('New Feature', 'newFeatureFunction')
  .addToUi();

function newFeatureFunction() {
  // Implementation
}
```

### Adding New Arena API Methods
```javascript
// ArenaAPI.gs
ArenaAPIClient.prototype.newMethod = function(params) {
  var endpoint = '/new/endpoint';
  return this.makeRequest(endpoint, {
    method: 'GET',
    // options
  });
};
```

### Adding New Configuration Options
```javascript
// Config.gs
function getNewConfig() {
  var props = PropertiesService.getUserProperties();
  var config = props.getProperty('new_config');
  return config ? JSON.parse(config) : getDefaultNewConfig();
}

function setNewConfig(config) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('new_config', JSON.stringify(config));
}
```

### Adding New UI Components
1. Create HTML file (e.g., `NewDialog.html`)
2. Add show function in `Code.gs`:
```javascript
function showNewDialog() {
  var html = HtmlService.createHtmlOutputFromFile('NewDialog')
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dialog Title');
}
```
3. Add server-side functions for dialog to call
4. Add menu item to trigger dialog

## Testing Strategy

### Manual Testing
- Test in development spreadsheet
- Use Apps Script editor for debugging
- Check execution logs for errors

### Automated Testing
Currently no automated tests. Future enhancement would be to add:
- Unit tests for business logic
- Integration tests for Arena API
- UI tests for dialogs

### Debugging
```javascript
// Enable detailed logging
Logger.log('Debug: ' + JSON.stringify(data));

// View logs in Apps Script editor
// Executions → Select execution → View logs

// Use try-catch for error details
try {
  // Code
} catch (error) {
  Logger.log('Error: ' + error.message);
  Logger.log('Stack: ' + error.stack);
  throw error;
}
```

## Performance Considerations

### Spreadsheet Operations
- Batch reads/writes when possible
- Use `getDataRange()` instead of individual cell reads
- Minimize formatting operations
- Use frozen rows for large sheets

### API Calls
- Cache responses (6 hours for categories, 30 minutes for items)
- Paginate large requests (400 items per page)
- Add delays between bulk operations (200ms)
- Local checks before API calls

### Memory Management
- Clear large arrays after use
- Don't store entire datasets in memory
- Use pagination for processing

## Security Considerations

### Credential Storage
- Never in code or sheet data
- PropertiesService (encrypted by Google)
- Session IDs in cache (auto-expire)

### Input Validation
- Sanitize user inputs
- Validate before API calls
- Check data types and ranges

### Error Messages
- Don't expose sensitive data in errors
- Log detailed errors, show generic messages to users
- Never log passwords

## Deployment Architecture

```
Local Development
     │
     ├─ Edit .gs and .html files
     ├─ Test locally
     │
     ▼
   clasp push
     │
     ▼
Google Apps Script
     │
     ├─ Runs in Google's infrastructure
     ├─ Executes on spreadsheet events
     │
     ▼
Arena PLM API
     │
     └─ External HTTP calls
```

## Future Architecture Enhancements

### Potential Improvements
1. **Automated Testing Framework**
   - Unit tests for business logic
   - Mock Arena API for testing
   - CI/CD pipeline

2. **Event-Driven Architecture**
   - Trigger-based BOM updates
   - Real-time sync with Arena
   - Webhook support

3. **Modular Plugin System**
   - Allow custom extensions
   - Plugin registry
   - Version management

4. **Enhanced Caching**
   - Smarter cache invalidation
   - Distributed cache for team use
   - Background refresh

5. **Error Recovery**
   - Automatic retry logic
   - Transaction rollback
   - Partial success handling

## Conclusion

This architecture provides:
- **Modularity** - Clear separation of concerns
- **Maintainability** - Well-organized code
- **Extensibility** - Easy to add features
- **Reliability** - Error handling and validation
- **Performance** - Caching and optimization

For implementation details, see the individual `.gs` files and their inline comments.
