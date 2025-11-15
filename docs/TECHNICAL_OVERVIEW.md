# Arena Data Center - Technical Overview

## What This Application Does

Arena Data Center is a Google Sheets-based tool that integrates with PTC Arena PLM to manage data center infrastructure configurations. It allows users to:

1. **Design rack configurations** with components from Arena
2. **Create visual data center layouts** with rack placements
3. **Generate consolidated BOMs** that aggregate materials across all racks
4. **Push complete POD/Row/Rack hierarchies to Arena** with proper BOM structures

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Sheets UI                          │
│  (Overview layouts, Rack configs, Item/Rack pickers)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Google Apps Script
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Layer (*.gs files)                  │
│  • Code.gs - Main entry, menu, events                       │
│  • BOMBuilder.gs - BOM operations, POD structure            │
│  • RackConfigManager.gs - Rack configuration logic          │
│  • LayoutManager.gs - Overview layout management            │
│  • CategoryManager.gs - Category/color configuration        │
│  • ArenaAPI.gs - API client                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  PTC Arena PLM API                           │
│  • Items (GET, POST, PUT)                                   │
│  • BOMs (GET, POST, DELETE)                                 │
│  • Categories, Attributes, Workspace                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Rack Configurations
- Each rack is represented by a separate sheet tab
- Metadata stored in row 1 (item number, name, description)
- BOM data starts at row 3 (item number, name, description, category, qty, attributes)
- Can be created from Arena items or built from scratch with Item Picker

### 2. Overview Layouts
- Grid-based visual representation of data center rows
- Rows numbered (1, 2, 3...), positions named (Pos 1, Pos 2, Pos 3...)
- Each cell can contain a rack (hyperlinked to rack config sheet)
- Rack colors configured by rack category

### 3. POD Structure (Point of Delivery)
The system creates a three-level hierarchy in Arena:
```
POD (Top Assembly)
 ├─ Row 1 (with Row Location attribute: "Pos 1, Pos 3, Pos 5")
 │   ├─ Rack A (qty: 2)
 │   └─ Rack B (qty: 1)
 ├─ Row 2 (with Row Location attribute: "Pos 2, Pos 4")
 │   ├─ Rack A (qty: 1)
 │   └─ Rack C (qty: 1)
 └─ Row 3...
```

### 4. Consolidated BOM
- Scans all racks in an overview layout
- Aggregates component quantities across all rack instances
- Organizes by BOM level hierarchy (user-configurable)
- Applies category colors for visual clarity

## Data Flow

### Creating a POD Structure in Arena

```
User initiates "Push POD Structure to Arena"
    ↓
Validate Row Location attribute exists in Arena
    ↓
Scan overview sheet row-by-row for rack placements
    ↓
Identify custom racks (check if local BOM exists)
    ↓
Create custom rack items in Arena (with user prompts)
    ↓
User selects category for Row items
    ↓
For each row:
  - Prompt for row name
  - Create Arena item with selected category
  - Set Row Location attribute (e.g., "Pos 1, Pos 3, Pos 5")
  - Add racks to BOM with aggregated quantities
    ↓
User selects category for POD item
    ↓
Prompt for POD name
    ↓
Create POD Arena item with all rows as BOM
    ↓
Update overview sheet with POD info and Arena links
    ↓
Success!
```

## Key Technologies

- **Google Apps Script** - Server-side JavaScript runtime
- **HTML Service** - For custom UI (sidebars, modals)
- **Spreadsheet Service** - Google Sheets API
- **URL Fetch Service** - HTTP client for Arena API
- **Properties Service** - Secure credential storage
- **Cache Service** - Performance optimization for API responses

## Performance Considerations

### Caching Strategy
- Category data cached for 6 hours (minimal changes)
- Favorite categories cached for 1 hour
- BOM hierarchy cached for 6 hours
- All items cached for 30 minutes (can be large)

### API Call Optimization
- Batch operations where possible
- Local checks before API calls (e.g., check local BOM before checking Arena)
- Pagination for large datasets (400 items per request)
- Rate limiting handled with 200ms delays between requests

### Sheet Performance
- Frozen rows for navigation
- Conditional formatting minimized
- Data validation used sparingly
- Formulas used for hyperlinks (not data)

## Security Model

### Credential Storage
- Arena credentials stored in `PropertiesService.getUserProperties()`
- Session IDs cached in `CacheService.getUserCache()` (max 6 hours)
- No credentials in code or sheet data
- Re-authentication on 401 responses

### Authorization Flow
```
User provides credentials
    ↓
Login via Arena API (/login endpoint)
    ↓
Receive session ID
    ↓
Cache session ID (6 hour TTL)
    ↓
Include session ID in all API requests (arena_session_id header)
    ↓
On 401 response → Clear cache → Re-login → Retry request
```

## Error Handling Patterns

### Arena API Errors
```javascript
try {
  var response = client.makeRequest(endpoint, options);
  // Handle success
} catch (error) {
  Logger.log('API Error: ' + error.message);
  // Fallback logic or user notification
  ui.alert('Error', 'Failed: ' + error.message, ui.ButtonSet.OK);
}
```

### Sheet Operation Errors
```javascript
var sheet = findRackConfigTab(itemNumber);
if (!sheet) {
  Logger.log('No rack config found for: ' + itemNumber);
  return; // Skip gracefully
}
```

### Validation Errors
```javascript
if (!rowName) {
  ui.alert('Error', 'Row name is required.', ui.ButtonSet.OK);
  return { success: false, message: 'Invalid input' };
}
```

## Extensibility Points

### Adding New Menu Items
See `Code.gs` lines 16-43:
```javascript
ui.createMenu('Arena Data Center')
  .addItem('Your Feature', 'yourFunction')
  .addToUi();
```

### Adding Custom Attributes to Rack Configs
See `Config.gs` `setItemColumns()` function - allows users to configure which Arena attributes appear as columns.

### Adding New BOM Operations
Create functions in `BOMBuilder.gs` and add to BOM Operations submenu.

### Custom Validation Rules
Add validation functions called from main workflows (e.g., `validateRowLocationAttribute()` pattern).

## Testing & Debugging

### Apps Script Logger
```javascript
Logger.log('Debug info: ' + JSON.stringify(data));
// View: Apps Script editor → Executions → View logs
```

### Execution Transcripts
- Every run logged in Apps Script editor
- Shows function calls, timing, errors
- Access: Apps Script editor → Executions

### User Alerts for Testing
```javascript
ui.alert('Debug', 'Value: ' + value, ui.ButtonSet.OK);
```

### Common Debug Points
1. Check session ID validity: `CacheService.getUserCache().get('arena_session_id')`
2. Verify credentials: `getArenaCredentials()` (but never log passwords!)
3. Test API connectivity: Menu → Test Connection
4. Check sheet structure: Verify metadata row format

## Deployment

### Using Clasp
```bash
# Push to Apps Script
clasp push

# Pull from Apps Script
clasp pull

# Open in browser
clasp open
```

### Version Control
- All `.gs` files tracked in Git
- HTML files tracked in Git
- `appsscript.json` tracked in Git
- `.clasp.json` contains script ID (gitignored)

### Release Process
1. Make changes locally
2. Test in development spreadsheet
3. `clasp push` to deploy
4. Commit to Git
5. Push to GitHub
6. Tag releases for major versions

## File Organization

```
PTC-Arena-Sheets-DataCenter/
├── Code.gs                    # Main entry point, menu, event handlers
├── ArenaAPI.gs               # Arena API client and HTTP handling
├── Authorization.gs          # Login, session management, credentials
├── BOMBuilder.gs            # BOM operations, POD structure creation
├── RackConfigManager.gs     # Rack configuration management
├── LayoutManager.gs         # Overview layout creation/management
├── CategoryManager.gs       # Category operations, colors
├── CategoryManager_Favorites.gs  # Favorites functionality
├── Config.gs                # Configuration storage/retrieval
├── DataMapper.gs            # Data transformation utilities
├── FormattingUtils.gs       # Formatting helpers
├── LegendManager.gs         # Category legend creation
├── RackColorManager.gs      # Rack color configuration
├── RackPopulator.gs         # Rack placement logic
├── SheetManager.gs          # Sheet utilities
├── ItemPicker.html          # Item picker sidebar UI
├── RackPicker.html          # Rack picker sidebar UI
├── HelpModal.html           # Help documentation modal
├── ConfigureColors.html     # Category color configuration UI
├── ConfigureRackColors.html # Rack color configuration UI
├── ConfigureColumns.html    # Item columns configuration UI
├── ConfigureBOMLevels.html  # BOM hierarchy configuration UI
├── LoginWizard.html         # Arena connection setup wizard
├── appsscript.json          # Apps Script project manifest
└── docs/                    # Documentation
    ├── TECHNICAL_OVERVIEW.md
    ├── ARENA_API_GUIDE.md
    ├── ARCHITECTURE.md
    ├── DEVELOPER_GUIDE.md
    └── LESSONS_LEARNED.md
```

## Next Steps

For more detailed information:
- **Arena API Integration**: See [ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md)
- **Code Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Developer Setup**: See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Lessons Learned**: See [LESSONS_LEARNED.md](./LESSONS_LEARNED.md)
