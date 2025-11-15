# Arena API Integration Guide

## Overview

This application integrates with PTC Arena PLM via their REST API. This guide covers everything you need to know about working with the Arena API in this codebase.

## Authentication

### Session-Based Authentication

Arena uses session-based authentication (not token-based). Here's how it works:

```javascript
// 1. Login to get session ID
POST /api/v1/login
Headers: { "Content-Type": "application/json" }
Body: {
  "email": "user@example.com",
  "password": "password"
}

Response: {
  "arena_session_id": "abc123..."
}

// 2. Use session ID in all subsequent requests
GET /api/v1/items
Headers: {
  "arena_session_id": "abc123...",
  "Content-Type": "application/json"
}
```

### Implementation in ArenaAPI.gs

The `ArenaAPIClient` class handles authentication automatically:

```javascript
var ArenaAPIClient = function() {
  // Get stored credentials
  var credentials = getArenaCredentials();

  // Get or create session ID
  this.sessionId = getValidSessionId();
};

ArenaAPIClient.prototype.makeRequest = function(endpoint, options) {
  // Include session ID in headers
  var headers = {
    'arena_session_id': this.sessionId,
    'Content-Type': 'application/json'
  };

  // Handle 401 (session expired)
  if (responseCode === 401) {
    clearSession();
    this.sessionId = getValidSessionId(); // Re-login
    // Retry request
  }
};
```

### Session Management Best Practices

**✅ DO:**
- Cache session IDs (we use 6-hour TTL)
- Re-login automatically on 401 responses
- Clear session cache on manual logout
- Store credentials securely in `PropertiesService.getUserProperties()`

**❌ DON'T:**
- Store session IDs in code
- Login for every request (wasteful)
- Store passwords in sheet data
- Share session IDs between users

## API Endpoints

### Items

#### Get All Items (Paginated)
```javascript
GET /items?limit=400&offset=0

Response: {
  "results": [
    {
      "guid": "item-guid",
      "number": "ITEM-001",
      "name": "Item Name",
      "description": "Description",
      "category": {
        "guid": "cat-guid",
        "name": "Category Name"
      }
    }
  ]
}
```

**Lessons Learned:**
- Default limit is 20, max is 400 - always use 400 for better performance
- Use offset for pagination: 0, 400, 800, 1200...
- Response field names can be capitalized (`Results` or `results`) - handle both!

#### Search Items
```javascript
GET /items/searches?searchQuery=RACK-001&limit=400

Response: {
  "results": [...] // Same structure as Get All Items
}
```

**Common Mistakes:**
- ❌ Searching without exact match logic - search may return partial matches
- ❌ Not handling empty results - always check `items.length === 0`
- ✅ Use `getItemByNumber()` wrapper that finds exact matches

#### Get Single Item
```javascript
GET /items/{itemGuid}

Response: {
  "guid": "item-guid",
  "number": "ITEM-001",
  // ... full item details
}
```

**Important:** Use GUID, not item number!

#### Create Item
```javascript
POST /items
Body: {
  "number": "ITEM-001",  // Optional - Arena can auto-generate
  "name": "Item Name",    // Required
  "category": "Category Name or GUID",  // Required
  "description": "Description"
}

Response: {
  "guid": "new-item-guid",
  "number": "ITEM-001",
  // ... created item details
}
```

**Critical Lessons:**
- ❌ **MISTAKE**: Using category name that doesn't exist → HTTP 400 error
- ✅ **FIX**: Always validate category exists first or prompt user from list
- Category can be name OR GUID, but name must match exactly (case-sensitive)
- If `number` not provided, Arena auto-generates

#### Update Item
```javascript
PUT /items/{itemGuid}
Body: {
  "name": "New Name",
  "description": "New Description",
  // Only include fields to update
}
```

#### Set Custom Attributes
```javascript
PUT /items/{itemGuid}
Body: {
  "attributes": [
    {
      "guid": "attribute-guid",
      "value": "attribute value"
    }
  ]
}
```

**Important:**
- Need attribute GUID (not name)
- Use `GET /settings/items/attributes` to get available attributes
- See `setItemAttribute()` in ArenaAPI.gs (line 219)

### BOMs (Bill of Materials)

#### Get BOM for Item
```javascript
GET /items/{itemGuid}/bom

Response: {
  "results": [
    {
      "guid": "bom-line-guid",
      "item": {
        "guid": "child-item-guid",
        "number": "CHILD-001"
      },
      "quantity": 5,
      "level": 0,
      "lineNumber": 1
    }
  ]
}
```

**Lessons Learned:**
- Empty BOM returns `{"results": []}`, not an error
- BOM lines have their own GUIDs (needed for deletion)
- Level 0 = top level, 1 = subassembly, etc.

#### Create BOM Line
```javascript
POST /items/{parentGuid}/bom
Body: {
  "item": {
    "guid": "child-item-guid"  // Must use GUID, not item number!
  },
  "quantity": 5,
  "level": 0,
  "lineNumber": 1
}
```

**Critical Mistakes to Avoid:**
- ❌ Using item number instead of GUID → API error
- ❌ Not looking up child item GUID first
- ✅ Always use `getItemByNumber()` first to get GUID

#### Delete BOM Line
```javascript
DELETE /items/{parentGuid}/bom/{bomLineGuid}
```

**Pattern for Syncing BOM:**
```javascript
// 1. Get existing BOM
var bomData = client.makeRequest('/items/' + parentGuid + '/bom', { method: 'GET' });
var existingBOM = bomData.results || [];

// 2. Delete all existing lines
existingBOM.forEach(function(line) {
  var lineGuid = line.guid;
  client.makeRequest('/items/' + parentGuid + '/bom/' + lineGuid, { method: 'DELETE' });
});

// 3. Create new lines
bomLines.forEach(function(line, index) {
  // Look up item GUID first!
  var childItem = client.getItemByNumber(line.itemNumber);
  var childGuid = childItem.guid;

  client.makeRequest('/items/' + parentGuid + '/bom', {
    method: 'POST',
    payload: {
      item: { guid: childGuid },
      quantity: line.quantity,
      level: line.level || 0,
      lineNumber: index + 1
    }
  });
});
```

### Categories

#### Get All Categories
```javascript
GET /settings/categories

Response: {
  "results": [
    {
      "guid": "cat-guid",
      "name": "Category Name",
      "path": "Parent > Category Name"
    }
  ]
}
```

**Tip:** Cache categories - they rarely change (6-hour cache in this app)

### Attributes

#### Get All Item Attributes
```javascript
GET /settings/items/attributes

Response: {
  "results": [
    {
      "guid": "attr-guid",
      "name": "Attribute Name",
      "apiName": "attribute_name",
      "type": "SINGLE_LINE_TEXT",
      "path": "Specifications.Attribute Name"
    }
  ]
}
```

**Attribute Types:**
- `SINGLE_LINE_TEXT`
- `MULTI_LINE_TEXT`
- `NUMBER`
- `DATE`
- `FIXED_DROP_DOWN`
- `MULTI_SELECT`

#### Get Item Attributes
```javascript
GET /items/{itemGuid}/attributes

Response: {
  "Attribute Name": "value",
  "Another Attribute": "another value"
}
```

## Response Field Name Variations

**Major Gotcha:** Arena API responses use inconsistent casing!

```javascript
// Sometimes lowercase
response.results
response.guid
response.number

// Sometimes capitalized
response.Results
response.Guid
response.Number
```

**Solution Pattern:**
```javascript
// Always handle both cases
var items = response.results || response.Results || [];
var guid = item.guid || item.Guid;
var number = item.number || item.Number;
```

See examples throughout `ArenaAPI.gs` and `BOMBuilder.gs`.

## Error Handling

### Common HTTP Error Codes

| Code | Meaning | Common Causes | Solution |
|------|---------|---------------|----------|
| 400 | Bad Request | Invalid category, missing required field | Validate input, check category exists |
| 401 | Unauthorized | Session expired | Re-login automatically (handled in `makeRequest`) |
| 404 | Not Found | Item doesn't exist, wrong GUID | Check item exists first |
| 500 | Server Error | Arena API issue | Retry with delay, show user-friendly error |

### Error Response Format
```javascript
{
  "code": 4073,
  "message": "The value for the attribute \"category\" is not valid."
}

// Or array of errors
[
  {
    "code": 4073,
    "message": "The value for the attribute \"category\" is not valid."
  }
]
```

### Handling in Code
```javascript
try {
  var response = UrlFetchApp.fetch(url, requestOptions);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (responseCode >= 200 && responseCode < 300) {
    return JSON.parse(responseText);
  } else {
    // Parse error message
    var errorMessage = 'HTTP ' + responseCode;
    try {
      var errorData = JSON.parse(responseText);
      if (errorData.message) {
        errorMessage += ': ' + errorData.message;
      } else if (errorData.errors) {
        errorMessage += ': ' + JSON.stringify(errorData.errors);
      }
    } catch (e) {
      errorMessage += ': ' + responseText;
    }
    throw new Error(errorMessage);
  }
} catch (error) {
  Logger.log('API Error: ' + error.message);
  throw error;
}
```

## Performance Optimization

### Caching Strategy

```javascript
// Category data (changes rarely)
var cache = CacheService.getUserCache();
var cached = cache.get('arena_categories');
if (cached) {
  return JSON.parse(cached);
}

var categories = client.getCategories();
cache.put('arena_categories', JSON.stringify(categories), 21600); // 6 hours
return categories;
```

### Batch Operations

**❌ Bad - Sequential API calls:**
```javascript
items.forEach(function(itemNumber) {
  var item = client.getItemByNumber(itemNumber); // N API calls!
});
```

**✅ Good - Fetch all once:**
```javascript
var allItems = client.getAllItems(); // 1-3 API calls with pagination
var itemMap = {};
allItems.forEach(function(item) {
  itemMap[item.number] = item;
});

items.forEach(function(itemNumber) {
  var item = itemMap[itemNumber]; // No API call!
});
```

### Rate Limiting

Add delays between requests to avoid overwhelming Arena API:

```javascript
items.forEach(function(item, index) {
  if (index > 0) {
    Utilities.sleep(200); // 200ms delay
  }
  // Make request
});
```

## Common Patterns

### Pattern 1: Create Item with BOM

```javascript
// 1. Create parent item
var parentItem = client.createItem({
  name: "Rack Assembly",
  category: "Racks",
  description: "Rack with components"
});

var parentGuid = parentItem.guid;

// 2. Create BOM lines
var bomLines = [
  { itemNumber: "COMP-001", quantity: 5 },
  { itemNumber: "COMP-002", quantity: 2 }
];

bomLines.forEach(function(line, index) {
  // Look up child item GUID
  var childItem = client.getItemByNumber(line.itemNumber);

  client.makeRequest('/items/' + parentGuid + '/bom', {
    method: 'POST',
    payload: {
      item: { guid: childItem.guid },
      quantity: line.quantity,
      level: 0,
      lineNumber: index + 1
    }
  });
});
```

### Pattern 2: Check if Item Exists Before Creating

```javascript
// Try to find existing item
var existingItem = client.getItemByNumber(itemNumber);

if (!existingItem) {
  // Create new item
  var newItem = client.createItem({
    number: itemNumber,
    name: "New Item",
    category: "Category"
  });
} else {
  // Update existing item
  client.updateItem(existingItem.guid, {
    description: "Updated description"
  });
}
```

### Pattern 3: Validate Category Exists

```javascript
var categories = getArenaCategories(); // Cached
var categoryExists = categories.some(function(cat) {
  return cat.name === categoryName || cat.name.toLowerCase() === categoryName.toLowerCase();
});

if (!categoryExists) {
  ui.alert('Error', 'Category "' + categoryName + '" not found in Arena', ui.ButtonSet.OK);
  return;
}
```

### Pattern 4: Local Check Before API Call

**Huge Performance Win!**

```javascript
// BAD - Always hits API
var arenaItem = client.getItemByNumber(itemNumber);
if (!arenaItem) {
  // Handle missing item
}

// GOOD - Check local first
var children = getRackConfigChildren(sheet); // Local check
if (children && children.length > 0) {
  // Has local BOM data, skip Arena check
  return;
}

// Only check Arena if local data is empty
var arenaItem = client.getItemByNumber(itemNumber);
```

This pattern saved the POD creation from false positives when identifying custom racks!

## Debugging Tips

### Enable Detailed Logging

```javascript
Logger.log('Making request to: ' + url);
Logger.log('Payload: ' + JSON.stringify(payload));
Logger.log('Response code: ' + responseCode);
Logger.log('Response: ' + responseText);
```

View logs: Apps Script Editor → Executions → Select execution → View logs

### Test API Calls Independently

Create a test function:

```javascript
function testArenaAPI() {
  var client = new ArenaAPIClient();

  // Test getting items
  var items = client.getItems({ limit: 10 });
  Logger.log('Got items: ' + items.results.length);

  // Test search
  var searchResults = client.searchItems('RACK-001');
  Logger.log('Search results: ' + JSON.stringify(searchResults));
}
```

### Use Arena API Explorer

Arena provides an API explorer in their web interface:
- Settings → API → API Explorer
- Test endpoints directly in browser
- See exact request/response formats

## Migration Notes

### If Arena API Changes

1. **Check Response Format Changes:**
   - Run test requests and log full responses
   - Update field name handling if needed

2. **Check Authentication Changes:**
   - Test login flow
   - Verify session handling

3. **Check Endpoint Changes:**
   - Verify all endpoints still work
   - Update paths if needed

### Backward Compatibility

The code handles multiple response formats:
```javascript
// Handles both old and new formats
var items = response.results || response.Results || response.items || response.data || [];
```

## Security Best Practices

1. **Never Log Passwords:**
   ```javascript
   // BAD
   Logger.log('Credentials: ' + JSON.stringify(credentials));

   // GOOD
   Logger.log('Email: ' + credentials.email); // OK to log email
   // Never log password
   ```

2. **Clear Sensitive Data:**
   ```javascript
   function clearCredentials() {
     PropertiesService.getUserProperties().deleteAllProperties();
     CacheService.getUserCache().removeAll(['arena_session_id']);
   }
   ```

3. **Validate User Input:**
   ```javascript
   var itemNumber = userInput.trim();
   if (!itemNumber || itemNumber.length > 100) {
     ui.alert('Error', 'Invalid item number', ui.ButtonSet.OK);
     return;
   }
   ```

## Lessons Learned Summary

### Top 5 Gotchas

1. **Response Field Casing** - Always handle `results` and `Results`, `guid` and `Guid`
2. **Category Validation** - Never assume category exists, always validate first
3. **GUID vs Item Number** - BOM operations require GUIDs, not item numbers
4. **Local Checks First** - Check local data before hitting API (huge performance gain)
5. **Session Expiration** - Always handle 401 and re-login automatically

### Best Practices Checklist

- ✅ Cache API responses when data changes rarely
- ✅ Use pagination with max limit (400)
- ✅ Handle both response format variations
- ✅ Add delays between bulk operations (200ms)
- ✅ Check local data before API calls
- ✅ Validate categories before creating items
- ✅ Look up GUIDs before BOM operations
- ✅ Log errors with context
- ✅ Show user-friendly error messages
- ✅ Test with Arena API Explorer

## Reference Implementation

See these files for working examples:
- **ArenaAPI.gs** - HTTP client, session management, all API wrappers
- **BOMBuilder.gs** - Complex BOM operations, POD structure creation
- **CategoryManager.gs** - Category caching, validation
- **Authorization.gs** - Login flow, credential management

Each function has detailed comments explaining the Arena API interaction!
