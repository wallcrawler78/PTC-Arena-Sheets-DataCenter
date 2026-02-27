# Three-Layer Architecture Pattern

## 🤖 AI Agent Instructions

**WHEN**: Generating ANY Arena PLM integration code
**THEN**: MUST generate all three layers
**FAIL_IF**: Any layer is missing

---

## ⚠️ Mandatory Rule

```
IF generating_arena_integration:
    MUST generate_layer_1_SessionManager()
    MUST generate_layer_2_ApiClient()
    MUST generate_layer_3_DomainApi()
    
    IF any_layer_missing:
        FAIL with error("All three layers required")
    ELSE:
        PROCEED
```

---

## Overview

All Arena PLM integrations must follow the **three-layer architecture**:

```
Layer 3: DomainApi (Business Logic)
    ↓
Layer 2: ApiClient (HTTP Operations)
    ↓
Layer 1: SessionManager (Authentication)
```

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           User Code / Application            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Layer 3: DomainApi                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ ItemsApi │  │Suppliers │  │ChangesApi│  │
│  │          │  │   Api    │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  • searchItemByNumber()                      │
│  • createItem()                              │
│  • getAttributeMetadata()                    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Layer 2: ApiClient                          │
│  • get(path, params)                         │
│  • post(path, body)                          │
│  • put(path, body)                           │
│  • patch(path, body)                         │
│  • delete(path)                              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Layer 1: SessionManager                     │
│  • getSession()                              │
│  • login()                                   │
│  • logout()                                  │
│  • Thread-safe caching                       │
└─────────────────────────────────────────────┘
```

## Layer 1: SessionManager

**Purpose**: Authentication & session lifecycle

**Responsibilities**:
- Login to API
- Cache session token (thread-safe)
- Check session expiry
- Re-authenticate when needed
- Logout and cleanup

**Must implement**:
```pseudo
CLASS SessionManager:
    PRIVATE sessionCache
    PRIVATE lastLoginTime
    PRIVATE lock
    PRIVATE credentials
    
    FUNCTION getSession():
        // Thread-safe session retrieval
    
    FUNCTION login():
        // Perform authentication
    
    FUNCTION logout():
        // Clear session and logout
```

## Layer 2: ApiClient

**Purpose**: Generic HTTP operations with session management

**Responsibilities**:
- Execute HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Inject session token automatically
- Handle HTTP errors
- Serialize/deserialize JSON

**Must implement**:
```pseudo
CLASS ApiClient:
    PRIVATE sessionManager
    PRIVATE httpClient
    
    FUNCTION get(path, params):
        session = sessionManager.getSession()
        RETURN httpClient.get(path, headers={session_id: session})
    
    FUNCTION post(path, body):
        session = sessionManager.getSession()
        RETURN httpClient.post(path, body, headers={session_id: session})
    
    FUNCTION put(path, body):
        // Similar pattern
    
    FUNCTION patch(path, body):
        // Similar pattern
    
    FUNCTION delete(path):
        // Similar pattern
    
    FUNCTION logout():
        RETURN sessionManager.logout()
```

## Layer 3: DomainApi

**Purpose**: Domain-specific business logic

**Responsibilities**:
- Provide descriptive method names
- Encapsulate endpoint paths
- Implement helper methods
- Parse and validate responses
- Handle domain-specific logic

**Must implement domain-specific methods**:
```pseudo
CLASS ItemsApi:
    PRIVATE apiClient
    
    FUNCTION searchItemByNumber(number):
        RETURN apiClient.get("/items", "number=" + number)
    
    FUNCTION createItem(itemData):
        RETURN apiClient.post("/items", itemData)
    
    FUNCTION getAttributeMetadata(attributeName):
        response = apiClient.get("/settings/items/attributes")
        RETURN parseAndFindAttribute(response, attributeName)
    
    FUNCTION createSimpleItem(name, categoryGuid):
        data = constructItemJson(name, categoryGuid)
        RETURN createItem(data)
```

## Why Three Layers?

### Without Proper Layering (❌ Bad)

```java
// User must know API details and construct everything manually
String session = login(email, password);
String response = httpGet("/items?number=ITEM-001", session);
JsonObject data = new JsonObject();
data.addProperty("name", "Item");
httpPost("/items", data.toString(), session);
logout(session);
```

**Problems**:
- ❌ Verbose and error-prone
- ❌ No abstraction
- ❌ Hard to maintain
- ❌ Session management mixed with business logic

### With Three Layers (✅ Good)

```java
// Clean, self-documenting code
SessionManager sm = new SessionManager(email, password, workspaceId);
ApiClient client = new ApiClient(sm);
ItemsApi items = new ItemsApi(client);

try {
    String response = items.searchItemByNumber("ITEM-001");
    String created = items.createSimpleItem("Item", categoryGuid);
} finally {
    client.logout();
}
```

**Benefits**:
- ✅ Clean separation of concerns
- ✅ Readable and maintainable
- ✅ Testable (each layer independently)
- ✅ Extensible (easy to add new domains)

## Extension Pattern

To add a new API domain:

```java
public class SuppliersApi {
    private final ApiClient client;
    
    public SuppliersApi(ApiClient client) {
        this.client = client;
    }
    
    public String searchSupplier(String name) throws IOException {
        return client.get("/suppliers", "name=" + name);
    }
    
    public String createSupplier(JsonObject supplierData) throws IOException {
        return client.post("/suppliers", supplierData.toString());
    }
}
```

## 📋 Mandatory Requirements Checklist

```
BEFORE generating code, verify:

[ ] Layer 1: SessionManager class exists
    [ ] Has getSession() method
    [ ] Has login() method
    [ ] Has logout() method
    [ ] Thread-safe with locks

[ ] Layer 2: ApiClient class exists
    [ ] Has get(path, params) method
    [ ] Has post(path, body) method
    [ ] Has put(path, body) method
    [ ] Has patch(path, body) method
    [ ] Has delete(path) method
    [ ] Auto-injects session header

[ ] Layer 3: DomainApi class(es) exist
    [ ] Domain-specific methods (e.g., searchItemByNumber)
    [ ] Descriptive method names
    [ ] Encapsulates endpoint paths
    [ ] Uses ApiClient for HTTP calls

[ ] User code uses DomainApi only (not ApiClient directly)
```

---

## 🎯 AI Agent Generation Steps

```
STEP 1: Generate Layer 1 (SessionManager)
  OUTPUT:
    - Class: SessionManager
    - Constructor: (email, password, workspaceId)
    - Method: getSession() → returns session token
    - Method: login() → authenticates and caches
    - Method: logout() → clears session
    - Thread-safe: Uses lock/mutex

STEP 2: Generate Layer 2 (ApiClient)
  OUTPUT:
    - Class: ApiClient
    - Constructor: (SessionManager)
    - Method: get(path, params)
    - Method: post(path, body)
    - Method: put(path, body)
    - Method: patch(path, body)
    - Method: delete(path)
    - Auto-inject: session header in all requests

STEP 3: Generate Layer 3 (DomainApi)
  OUTPUT:
    - Class: ItemsApi (or appropriate domain)
    - Constructor: (ApiClient)
    - Methods: Domain-specific operations
      Example: searchItemByNumber(number)
      Example: createItem(itemData)
      Example: updateItem(guid, updates)
    - Encapsulate: All endpoint paths

STEP 4: Generate User Code
  OUTPUT:
    - Create SessionManager instance
    - Create ApiClient instance
    - Create DomainApi instance
    - Use try-finally pattern
    - Call DomainApi methods (NOT ApiClient directly)
```

---

## ⚠️ Common Mistakes to Avoid

```
MISTAKE 1: Generating only 2 layers
  ❌ SessionManager + ApiClient only
  ✅ Must include DomainApi layer

MISTAKE 2: User code calls ApiClient directly
  ❌ apiClient.get("/items?number=ITEM-001")
  ✅ itemsApi.searchItemByNumber("ITEM-001")

MISTAKE 3: SessionManager not thread-safe
  ❌ Direct field access without locks
  ✅ Use locks around session cache access

MISTAKE 4: DomainApi with generic names
  ❌ doGet(), doPost()
  ✅ searchItem(), createItem(), updateItem()

MISTAKE 5: Missing try-finally in user code
  ❌ No cleanup guarantee
  ✅ Always use try-finally with logout()
```

---

## Design Principles

- **Single Responsibility**: Each layer has one job
- **Dependency Inversion**: Layers depend on abstractions
- **Open/Closed**: Open for extension, closed for modification
- **Separation of Concerns**: Authentication, HTTP, and business logic separated

