# Example 1: Single Operation - Search Item

## 🤖 AI Agent: Use This Pattern When

```
IF user_request contains:
  - ONE operation only
  - Simple query/search/get
  - No follow-up operations
THEN:
  USE this example pattern
```

---

## User Request

"Search for an item by number"

## 🎯 Intent Analysis (AI Agent Steps)

```
STEP 1: Parse user request
  RESULT: "Search for an item"

STEP 2: Count operations
  RESULT: 1 operation

STEP 3: Identify domain
  RESULT: Items

STEP 4: Identify action
  RESULT: Search/Query

STEP 5: Extract parameters
  RESULT: Item number (string)

STEP 6: Select pattern
  RESULT: Single Operation Pattern
```

**Extracted Requirements**:
- **Operation Type**: Single operation
- **API Domain**: Items
- **Action**: Search/Query
- **Parameters**: Item number

## OpenAPI Validation

### Endpoint

```
Path: /items
Method: GET
Query Parameters:
  - number (string, optional): Item number to search for
```

### Response Schema

```json
{
  "$ref": "#/components/schemas/ItemsResponse",
  "properties": {
    "results": {
      "type": "array",
      "items": {"$ref": "#/components/schemas/Item"}
    }
  }
}
```

## Generated Code

### Java Implementation

```java
package com.example.arena;

import java.io.IOException;

public class SearchItemExample {
    public static void main(String[] args) {
        // Create session manager
        SessionManager sessionManager = new SessionManager(
            "user@example.com",
            "password",
            null  // Optional workspace ID
        );
        
        // Create API clients
        ArenaApiClient apiClient = new ArenaApiClient(sessionManager);
        ItemsApi itemsApi = new ItemsApi(apiClient);
        
        try {
            // Login happens automatically on first API call
            System.out.println("Searching for item ITEM-001...");
            String response = itemsApi.searchItemByNumber("ITEM-001");
            
            System.out.println("Search results:");
            System.out.println(response);
            
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // Always logout to cleanup
            try {
                apiClient.logout();
                System.out.println("Logged out successfully");
            } catch (IOException e) {
                System.err.println("Logout error: " + e.getMessage());
            }
        }
    }
}
```

### ItemsApi Method

```java
public class ItemsApi {
    private final ArenaApiClient client;
    
    public ItemsApi(ArenaApiClient client) {
        this.client = client;
    }
    
    /**
     * Search for items by number.
     *
     * @param itemNumber Item number to search for
     * @return JSON response with search results
     * @throws IOException If request fails
     */
    public String searchItemByNumber(String itemNumber) throws IOException {
        String queryParams = "number=" + itemNumber;
        return client.get("/items", queryParams);
    }
}
```

## Session Flow

```
User calls searchItemByNumber()
    ↓
ItemsApi.searchItemByNumber() called
    ↓
ApiClient.get() called
    ↓
SessionManager.getSession() called
    ↓
Login performed (first call)
    ↓
Session cached
    ↓
HTTP GET /items?number=ITEM-001 with session header
    ↓
Response returned
    ↓
finally block: logout() called
    ↓
Session cleared
```

## Key Points

1. **Single try-finally block**: One operation, one login, one logout
2. **Automatic login**: No manual login() call needed
3. **Error handling**: Catches IOException
4. **Guaranteed cleanup**: finally ensures logout
5. **Descriptive method**: `searchItemByNumber()` is clear and self-documenting

## Alternative: Python Implementation

```python
from arena_api import SessionManager, ArenaApiClient, ItemsApi

# Create session manager
session_manager = SessionManager(
    email="user@example.com",
    password="password",
    workspace_id=None
)

# Create API clients
api_client = ArenaApiClient(session_manager)
items_api = ItemsApi(api_client)

try:
    # Login happens automatically on first API call
    print("Searching for item ITEM-001...")
    response = items_api.search_item_by_number("ITEM-001")
    
    print("Search results:")
    print(response)
    
except Exception as e:
    print(f"Error: {e}")
    
finally:
    # Always logout to cleanup
    api_client.logout()
    print("Logged out successfully")
```

## Testing Recommendation

Test with:
- Valid item number (should return results)
- Invalid item number (should return empty results)
- Non-existent item (should return empty results)
- Network error (should handle IOException)

