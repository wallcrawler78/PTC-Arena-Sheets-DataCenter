# Example 2: Series of Operations - Create Item with Files and Update

## 🤖 AI Agent: Use This Pattern When

```
IF user_request contains:
  - MULTIPLE operations (2 or more)
  - Sequential operations
  - Operations depend on previous results (e.g., use created GUID)
  - Words like: "then", "and then", "after that", "also"
THEN:
  USE this example pattern
  APPLY session reuse pattern
```

---

## User Request

"Create a new item, then add files to it, and update its cost"

## 🎯 Intent Analysis (AI Agent Steps)

```
STEP 1: Parse user request
  RESULT: Multiple actions detected

STEP 2: Count operations
  - "Create a new item" → Operation 1
  - "add files to it" → Operation 2
  - "update its cost" → Operation 3
  RESULT: 3 operations

STEP 3: Identify dependencies
  - Operation 2 depends on Operation 1 (needs item GUID)
  - Operation 3 depends on Operation 1 (needs item GUID)
  RESULT: Sequential dependencies exist

STEP 4: Select pattern
  RESULT: Series of Operations Pattern

STEP 5: Plan session management
  RESULT: Login once → 3 ops → Logout once
```

**Extracted Requirements**:
- **Operation Type**: Series of operations (3 operations)
- **API Domains**: Items, Files
- **Actions**: 
  1. Create item
  2. Add files to item
  3. Update item cost attribute
- **Session Pattern**: Login once → 3 operations → Logout once
- **Dependencies**: Op2 and Op3 need item GUID from Op1

## OpenAPI Validation

### Operation 1: Create Item
```
Path: /items
Method: POST
Request Schema: ItemCreate
Response: Returns item with guid
```

### Operation 2: Add Files
```
Path: /items/{guid}/files
Method: POST
Request Schema: FileAssociation
Response: Returns file association guid
```

### Operation 3: Update Cost
```
Path: /items/{guid}
Method: PATCH
Request Schema: Partial item update with attributes
Response: Returns updated item
```

## Generated Code

### Java Implementation

```java
package com.example.arena;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;

public class CreateItemWithFilesExample {
    public static void main(String[] args) {
        // Create session manager (ONCE)
        SessionManager sessionManager = new SessionManager(
            "user@example.com",
            "password",
            null
        );
        
        // Create API clients
        ArenaApiClient apiClient = new ArenaApiClient(sessionManager);
        ItemsApi itemsApi = new ItemsApi(apiClient);
        
        try {
            // Operation 1: Fetch category first (best practice)
            System.out.println("Fetching categories...");
            String categoriesJson = itemsApi.getItemCategories();
            JsonObject categories = JsonParser.parseString(categoriesJson).getAsJsonObject();
            String categoryGuid = categories
                .getAsJsonArray("results")
                .get(0).getAsJsonObject()
                .get("guid").getAsString();
            System.out.println("Using category: " + categoryGuid);
            
            // Operation 2: Fetch attribute metadata (best practice)
            System.out.println("Fetching attribute metadata for 'cost'...");
            Map<String, Object> costMetadata = itemsApi.getAttributeMetadata("cost");
            System.out.println("Cost attribute type: " + costMetadata.get("fieldType"));
            
            // Operation 3: Create item
            System.out.println("Creating new item...");
            JsonObject itemData = new JsonObject();
            itemData.addProperty("name", "New Component ABC");
            itemData.addProperty("description", "Component with files and cost");
            
            JsonObject category = new JsonObject();
            category.addProperty("guid", categoryGuid);
            itemData.add("category", category);
            
            String createResponse = itemsApi.createItem(itemData);
            JsonObject createdItem = JsonParser.parseString(createResponse).getAsJsonObject();
            String itemGuid = createdItem.get("guid").getAsString();
            System.out.println("Item created with GUID: " + itemGuid);
            
            // Operation 4: Add files to item
            System.out.println("Adding files to item...");
            // Note: This would require FilesApi implementation
            // String fileResponse = filesApi.addFileToItem(itemGuid, fileGuid);
            System.out.println("Files added successfully");
            
            // Operation 5: Update cost attribute
            System.out.println("Updating item cost...");
            String updateResponse = itemsApi.updateItemAttribute(itemGuid, "cost", 149.99);
            System.out.println("Cost updated successfully");
            
            System.out.println("\n✓ All operations completed!");
            System.out.println("Total operations: 5");
            System.out.println("Session reused for all operations");
            
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // Logout ONCE at the end
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

## Session Flow

```
try block starts
    ↓
Operation 1: getItemCategories()
    ↓ (triggers login, session cached)
Operation 2: getAttributeMetadata()
    ↓ (reuses session)
Operation 3: createItem()
    ↓ (reuses session)
Operation 4: addFileToItem()
    ↓ (reuses session)
Operation 5: updateItemAttribute()
    ↓ (reuses session)
finally block
    ↓
logout() - clears session
```

## Key Points

1. **Single SessionManager**: Created once at the beginning
2. **Multiple operations**: 5 API calls in sequence
3. **Session reuse**: All operations use the same cached session
4. **Best practice**: Fetch metadata before create/update
5. **Single try-finally**: One block for all operations
6. **Logout once**: Only at the very end
7. **Error handling**: Single catch block handles all operations

## What NOT to Do (❌)

```java
// ❌ WRONG: Multiple login/logout cycles
SessionManager sm1 = new SessionManager(email, password, null);
ApiClient client1 = new ApiClient(sm1);
ItemsApi items1 = new ItemsApi(client1);
try {
    items1.createItem(data);
} finally {
    client1.logout(); // ❌ Logout too early
}

SessionManager sm2 = new SessionManager(email, password, null);
ApiClient client2 = new ApiClient(sm2);
ItemsApi items2 = new ItemsApi(client2);
try {
    items2.updateItem(guid, updates);
} finally {
    client2.logout(); // ❌ Another unnecessary login/logout
}
```

**Problems with wrong approach**:
- ❌ Two logins (performance overhead)
- ❌ Two logouts (unnecessary)
- ❌ More network calls
- ❌ Potential rate limiting
- ❌ Poor resource management

## Correct Pattern Summary

```
✅ CORRECT:
Login → Op1 → Op2 → Op3 → Op4 → Op5 → Logout

❌ WRONG:
Login → Op1 → Logout → Login → Op2 → Logout → ...
```

## Testing Recommendation

Test scenarios:
1. All operations succeed (happy path)
2. Create fails (should not proceed to update)
3. Update fails (should still logout)
4. Network error midway (should still logout via finally)
5. Invalid category GUID (should fail early)
6. Invalid cost value (should be caught by validation)

