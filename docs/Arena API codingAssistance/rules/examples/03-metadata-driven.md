# Example 3: Metadata-Driven Operations - Update with Validation

## 🤖 AI Agent: Use This Pattern When

```
IF user_request contains:
  - CREATE operation (POST)
  - UPDATE operation (PUT/PATCH)
  - Setting attribute values
  - Need to validate field values
THEN:
  MUST fetch metadata FIRST
  USE this example pattern
  
CRITICAL: For CREATE/UPDATE, metadata fetch is MANDATORY
```

---

## User Request

"Update item's cost value using our API"

## 🎯 Intent Analysis (AI Agent Steps)

```
STEP 1: Parse user request
  RESULT: "Update item's cost value"

STEP 2: Identify operation type
  KEYWORDS: "update", "cost value"
  RESULT: UPDATE operation (PATCH)

STEP 3: Check if metadata required
  IF operation is CREATE or UPDATE:
    RESULT: YES - metadata required

STEP 4: Count total operations
  - Operation 1: Fetch attribute metadata
  - Operation 2: Update item with validated value
  RESULT: 2 operations

STEP 5: Select pattern
  RESULT: Metadata-Driven Pattern

STEP 6: Plan validation steps
  RESULT: Fetch → Validate type → Validate value → Update
```

**Extracted Requirements**:
- **Operation Type**: Series of operations (2 operations)
- **API Domain**: Items (Settings + Data)
- **Actions**:
  1. Fetch attribute metadata (MANDATORY)
  2. Validate cost field type and constraints
  3. Update item with validated cost value
- **Best Practice**: Always fetch metadata before CREATE/PUT/PATCH

---

## ⚠️ Why Metadata First? (Critical for AI Agents)

```
METADATA provides:
  ✅ Field type (string, number, picklist, boolean, etc.)
  ✅ Validation rules (min/max, patterns, length)
  ✅ Possible values (for picklists/enums)
  ✅ Required vs optional
  ✅ Field-level permissions

WITHOUT metadata:
  ❌ May send wrong data type → 400 error
  ❌ May send invalid picklist value → 400 error
  ❌ May miss required fields → 400 error
  ❌ Wasted API call + poor user experience

RULE: For CREATE/UPDATE, fetch metadata FIRST
```

## OpenAPI Validation

### Operation 1: Get Attribute Metadata
```
Path: /settings/items/attributes
Method: GET
Response: Array of attribute definitions
```

### Operation 2: Update Item
```
Path: /items/{guid}
Method: PATCH
Request Schema: Partial item update with additionalAttributes
```

## Generated Code

### Java Implementation

```java
package com.example.arena;

import com.google.gson.JsonObject;
import java.io.IOException;
import java.util.Map;

public class UpdateItemWithMetadataExample {
    public static void main(String[] args) {
        // Create session manager
        SessionManager sessionManager = new SessionManager(
            "user@example.com",
            "password",
            null
        );
        
        // Create API clients
        ArenaApiClient apiClient = new ArenaApiClient(sessionManager);
        ItemsApi itemsApi = new ItemsApi(apiClient);
        
        // Item to update
        String itemGuid = "YOUR-ITEM-GUID";
        String attributeName = "cost";
        double newCostValue = 199.99;
        
        try {
            // Operation 1: Fetch attribute metadata (BEST PRACTICE)
            System.out.println("Step 1: Fetching attribute metadata...");
            Map<String, Object> metadata = itemsApi.getAttributeMetadata(attributeName);
            
            if (metadata.isEmpty()) {
                System.err.println("ERROR: Attribute '" + attributeName + "' not found!");
                return;
            }
            
            // Display metadata for validation
            System.out.println("Attribute metadata:");
            System.out.println("  - Name: " + metadata.get("name"));
            System.out.println("  - API Name: " + metadata.get("apiName"));
            System.out.println("  - Field Type: " + metadata.get("fieldType"));
            System.out.println("  - Required: " + metadata.get("required"));
            
            // Validate field type
            String fieldType = (String) metadata.get("fieldType");
            if (!fieldType.equalsIgnoreCase("NUMBER") && 
                !fieldType.equalsIgnoreCase("DECIMAL")) {
                System.err.println("ERROR: Cost field is not a number type!");
                System.err.println("Expected: NUMBER or DECIMAL, Got: " + fieldType);
                return;
            }
            
            // Check for possible values (if it's a picklist)
            if (metadata.containsKey("possibleValues")) {
                System.out.println("  - Possible values: " + metadata.get("possibleValues"));
                // Validate against possible values if needed
            }
            
            // Operation 2: Update item with validated value
            System.out.println("\nStep 2: Updating item cost...");
            String updateResponse = itemsApi.updateItemAttribute(
                itemGuid, 
                attributeName, 
                newCostValue
            );
            
            System.out.println("✓ Cost updated successfully!");
            System.out.println("Response: " + updateResponse);
            
        } catch (IOException e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // Logout once at the end
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

### Enhanced ItemsApi with Metadata Parsing

```java
public class ItemsApi {
    private final ArenaApiClient client;
    
    public ItemsApi(ArenaApiClient client) {
        this.client = client;
    }
    
    /**
     * Get attribute definition and extract metadata.
     * This is a BEST PRACTICE method for validating before updates.
     *
     * @param attributeName Attribute API name (e.g., "cost", "weight")
     * @return Map containing attribute metadata
     * @throws IOException If request fails
     */
    public Map<String, Object> getAttributeMetadata(String attributeName) throws IOException {
        String attributesJson = getItemAttributes();
        JsonObject response = JsonParser.parseString(attributesJson).getAsJsonObject();
        JsonArray results = response.getAsJsonArray("results");
        
        Map<String, Object> metadata = new HashMap<>();
        
        // Search for the attribute by name
        for (int i = 0; i < results.size(); i++) {
            JsonObject attr = results.get(i).getAsJsonObject();
            String apiName = attr.has("apiName") ? attr.get("apiName").getAsString() : "";
            
            if (apiName.equalsIgnoreCase(attributeName)) {
                // Extract all relevant metadata
                metadata.put("guid", attr.get("guid").getAsString());
                metadata.put("name", attr.get("name").getAsString());
                metadata.put("apiName", apiName);
                
                if (attr.has("fieldType")) {
                    metadata.put("fieldType", attr.get("fieldType").getAsString());
                }
                
                if (attr.has("required")) {
                    metadata.put("required", attr.get("required").getAsBoolean());
                }
                
                // Extract possible values for picklists
                if (attr.has("possibleValues") && !attr.get("possibleValues").isJsonNull()) {
                    JsonArray possibleValues = attr.getAsJsonArray("possibleValues");
                    List<String> values = new ArrayList<>();
                    for (int j = 0; j < possibleValues.size(); j++) {
                        values.add(possibleValues.get(j).getAsString());
                    }
                    metadata.put("possibleValues", values);
                }
                
                break;
            }
        }
        
        return metadata;
    }
    
    /**
     * Update a specific attribute on an item.
     * RECOMMENDATION: Call getAttributeMetadata() first to validate.
     *
     * @param itemGuid Item GUID
     * @param attributeName Attribute API name
     * @param attributeValue New value
     * @return JSON response
     * @throws IOException If request fails
     */
    public String updateItemAttribute(String itemGuid, String attributeName, Object attributeValue) 
            throws IOException {
        JsonObject updates = new JsonObject();
        JsonObject additionalAttributes = new JsonObject();
        
        // Handle different value types
        if (attributeValue instanceof String) {
            additionalAttributes.addProperty(attributeName, (String) attributeValue);
        } else if (attributeValue instanceof Number) {
            additionalAttributes.addProperty(attributeName, (Number) attributeValue);
        } else if (attributeValue instanceof Boolean) {
            additionalAttributes.addProperty(attributeName, (Boolean) attributeValue);
        }
        
        updates.add("additionalAttributes", additionalAttributes);
        return patchItem(itemGuid, updates);
    }
}
```

## Session Flow

```
try block starts
    ↓
Operation 1: getAttributeMetadata("cost")
    ├─ getItemAttributes() → triggers login
    └─ Parse and extract metadata
    ↓
Validation: Check field type
    ↓
Operation 2: updateItemAttribute(guid, "cost", 199.99)
    ├─ Construct JSON with additionalAttributes
    └─ patchItem() → reuses session
    ↓
finally block → logout()
```

## Key Best Practices Demonstrated

1. **Metadata First**: Always fetch attribute definitions before updates
2. **Validation**: Check field type, required status, possible values
3. **Error Prevention**: Fail early if attribute not found or wrong type
4. **Session Reuse**: Both operations use same session
5. **Descriptive Logging**: Clear output of what's happening
6. **Type Safety**: Handle different value types (string, number, boolean)

## Benefits of Metadata-Driven Approach

### Without Metadata (❌ Bad)
```java
// ❌ Direct update without validation
itemsApi.updateItemAttribute(itemGuid, "cost", "invalid-value");
// Server returns 400 error - wasted API call
```

### With Metadata (✅ Good)
```java
// ✅ Validate before sending
Map<String, Object> meta = itemsApi.getAttributeMetadata("cost");
if (!meta.get("fieldType").equals("NUMBER")) {
    System.err.println("Wrong type!");
    return; // Fail early, no wasted API call
}
itemsApi.updateItemAttribute(itemGuid, "cost", 199.99);
```

## Advanced: Picklist Validation

For picklist fields, validate against possible values:

```java
Map<String, Object> metadata = itemsApi.getAttributeMetadata("status");
List<String> possibleValues = (List<String>) metadata.get("possibleValues");

String newStatus = "In Progress";
if (!possibleValues.contains(newStatus)) {
    System.err.println("Invalid status value!");
    System.err.println("Valid values: " + possibleValues);
    return; // Prevent invalid API call
}

itemsApi.updateItemAttribute(itemGuid, "status", newStatus);
```

## Testing Recommendation

Test scenarios:
1. Valid attribute name and value (should succeed)
2. Invalid attribute name (should fail with message)
3. Wrong value type (should fail validation)
4. Picklist with invalid value (should fail validation)
5. Required field with null (should fail validation)
6. Non-existent item GUID (should fail at update step)

## Pattern Summary

```
Metadata First Pattern:
1. Fetch metadata
2. Validate input
3. Perform update
4. Handle errors gracefully

Result: Fewer failed API calls, better UX, clearer error messages
```

