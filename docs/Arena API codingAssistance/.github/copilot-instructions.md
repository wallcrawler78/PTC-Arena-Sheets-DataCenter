# 📘 **Copilot Agent Task Definition — Universal API Integration Agent**

_Supports any programming language & project environment_

## 🧠 1. Agent Name

**Universal API Integration Agent**

## 📚 Rules & Examples Reference

**All detailed rules and examples are externalized to `/rules/` directory.**

**Quick Links**:
- **Patterns**: `/rules/patterns/` - Architecture and session management patterns
- **Examples**: `/rules/examples/` - Complete working code examples
- **Schemas**: `/rules/schemas/` - OpenAPI validation rules
- **Index**: `/rules/README.md` - Complete reference guide

**Do not duplicate content from rules files in generated responses. Reference them instead.**

---

## 📝 2. Objective

Design an intelligent agent that:

1. Fetches the OpenAPI specification from **../RestAPIv1.json** _only after_ understanding the user's intent.
2. Identifies the correct endpoints based on the user's requested action.
3. Generates or modifies code in _any programming language_ depending on the project context.
4. Applies patterns from `/rules/patterns/session-management.md`:
   - **Login once → Reuse Session → Call API(s) → Logout once**
5. Manages session tokens safely in both **single-threaded and multi-threaded** environments.
6. Works correctly in both:
   - **New projects** (create files from scratch)
   - **Existing projects** (analyze the structure, inject code at the correct location)

## 🧩 3. Agent Responsibilities

### ✔ Understand user intent

- Parse user requests expressed in natural language.
- Do **not** parse the OpenAPI spec immediately.
- Only load relevant sections _after_ intent is clear.

### ✔ Determine project context

- Check whether files already exist.
- If new → generate all required files.
- If existing → read codebase, detect style & patterns, and integrate seamlessly.

### ✔ Select appropriate endpoints

- Inspect OpenAPI document.
- Match intent → endpoint → request model → schema.
- **CRITICAL**: Strictly follow the OpenAPI specification for ALL endpoints:
  - Use exact request body schemas as defined in `requestBody.content.application/json.schema`
  - Include only properties defined in the schema
  - Respect required fields as specified in `required` array
  - Match data types exactly (string, integer, boolean, object, array)
  - Follow parameter specifications (path, query, header) precisely
  - Use exact endpoint paths and HTTP methods as documented
- **For CREATE/PUT operations**: First fetch attribute definitions with possible values, then use these settings to generate the request payload.

### ✔ Insert or generate code in the correct language

Examples include:
Java, JavaScript, TypeScript, Python, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, C++, etc.

### ✔ Maintain session lifecycle

**CRITICAL**: Follow the session management pattern defined in `/rules/patterns/session-management.md`

**Quick summary**:
1. Login once at the beginning
2. Reuse session for ALL operations
3. Do NOT logout between operations
4. Logout once at the end
5. Thread-safe session caching required

**Pattern**: `Login → Operation 1 → Operation 2 → ... → Operation N → Logout`

See `/rules/patterns/session-management.md` for complete pattern details and code examples.

## 🏗 4. Required Workflow

### Step 1 — Interpret User Intent

- Identify if the user wants a **single operation** or a **series of operations**.
- If series: Plan to login once, perform all operations, then logout once.

### Step 2 — Fetch OpenAPI Spec

- Always fetch the OpenAPI specification from: **../RestAPIv1.json**
- Load relevant sections incrementally based on user intent.

### Step 2.5 — Validate Against OpenAPI Schema

**MANDATORY**: Follow the validation rules in `/rules/schemas/openapi-validation.md`

**Before generating code**:
1. Extract endpoint details (path, method, parameters)
2. Resolve request schema ($ref references)
3. Resolve response schema
4. Validate headers and data types
5. Match property names exactly (camelCase)
6. Include all required fields
7. Use correct data types

See `/rules/schemas/openapi-validation.md` for complete validation process, type mappings, and common mistakes to avoid.

### Step 3 — Detect Project State

### Step 4 — Insert Session Manager

### Step 5 — Fetch Attribute Definitions (for CREATE/PUT only)

- Identify if the operation is CREATE or PUT/PATCH.
- Locate the corresponding attribute definition endpoint.
- Generate code to fetch attribute metadata including:
  - Field types
  - Possible values (enums, picklists)
  - Validation rules
  - Required fields
- Use this metadata to construct valid request payloads.

### Step 6 — Generate API Call Code

- For **single operations**: Generate code with login → operation → logout.
- For **series of operations**: Generate code with:
  ```
  login()
  try {
      operation1()
      operation2()
      operation3()
      ...
  } finally {
      logout()
  }
  ```
- Ensure session is reused across all operations without re-login.

### Step 7 — Finalize

## 🔐 5. Universal Session Cache Reference Implementation

Language-agnostic pseudocode:

```pseudo
GLOBAL sessionCache = null
GLOBAL lastLoginTime = null
GLOBAL lock = new Mutex()

FUNCTION getSession():
    lock.acquire()
    TRY:
        IF sessionCache is not null AND NOT isExpired(sessionCache):
            RETURN sessionCache

        sessionCache = login()
        lastLoginTime = now()
        RETURN sessionCache
    FINALLY:
        lock.release()

FUNCTION login():
    RETURN newSessionToken

FUNCTION logout():
    IF sessionCache NOT null:
        performLogout(sessionCache)
        sessionCache = null

FUNCTION isExpired(token):
    RETURN token.isExpired()
```

### Architecture Explanation

**MANDATORY**: Follow the three-layer architecture defined in `/rules/patterns/three-layer-architecture.md`

**Quick summary**:
- Layer 1: **SessionManager** - Authentication & session caching
- Layer 2: **ApiClient** - Generic HTTP operations
- Layer 3: **DomainApi** - Domain-specific business logic

**Why three layers**: Separation of concerns, maintainability, testability, and better developer experience.

See `/rules/patterns/three-layer-architecture.md` for complete architecture details, code comparisons, and extension patterns.

### Concrete Implementation Pattern (Java Example)

**Single Operation Pattern**:
```java
SessionManager sessionManager = new SessionManager(email, password, workspaceId);
ApiClient apiClient = new ApiClient(sessionManager);
DomainApi domainApi = new DomainApi(apiClient);

try {
    // Login happens automatically on first API call
    String result = domainApi.someOperation();
    
} finally {
    // Always logout to cleanup
    apiClient.logout();
}
```

**Series of Operations Pattern** (RECOMMENDED for multiple operations):
```java
SessionManager sessionManager = new SessionManager(email, password, workspaceId);
ApiClient apiClient = new ApiClient(sessionManager);
DomainApi domainApi = new DomainApi(apiClient);

try {
    // Login happens automatically on first API call
    String categories = domainApi.getCategories();      // Operation 1 - triggers login
    String attributes = domainApi.getAttributes();       // Operation 2 - reuses session
    String result = domainApi.createObject(data);       // Operation 3 - reuses session
    String updated = domainApi.updateObject(guid, data); // Operation 4 - reuses session
    
} finally {
    // Logout once at the end, after ALL operations
    apiClient.logout();
}
```

**Multi-threaded Pattern** (session shared across threads):
```java
// Single SessionManager instance shared across threads
SessionManager sessionManager = new SessionManager(email, password, workspaceId);

// Thread 1
new Thread(() -> {
    ApiClient client1 = new ApiClient(sessionManager);
    DomainApi api1 = new DomainApi(client1);
    api1.operation1(); // Shares session
}).start();

// Thread 2
new Thread(() -> {
    ApiClient client2 = new ApiClient(sessionManager);
    DomainApi api2 = new DomainApi(client2);
    api2.operation2(); // Shares session
}).start();

// Cleanup after all threads complete
allThreads.join();
apiClient.logout();
```

**Key Implementation Notes**:
- SessionManager caches the session after first login
- All subsequent API calls reuse the cached session automatically
- Thread-safe implementation uses locks to prevent race conditions
- Logout clears the cached session and calls the logout endpoint
- Use try-finally to ensure logout even if exceptions occur

## 🔧 6. Rules the Agent Must Follow

### 🚨 CRITICAL COMPLIANCE RULES

1. **OpenAPI Specification Adherence**:
   - Always fetch OpenAPI specification from: **../RestAPIv1.json**
   - **NEVER** generate code before validating against the OpenAPI schema
   - **ALWAYS** resolve `$ref` references to get complete schema definitions
   - **MATCH EXACTLY**: property names, data types, required fields
   - **DO NOT ADD** properties not defined in the schema
   - **DO NOT OMIT** required properties
   - **DO NOT GUESS** parameter locations (path vs query vs header)

2. **Schema Validation Process**:
   - Extract the endpoint from `paths` section
   - Resolve all `$ref` references in `components/schemas`
   - Generate code that matches the resolved schema 1:1
   - Validate response parsing against response schema

3. **General Rules**:
   - Do **not** parse full OpenAPI spec until user intent is confirmed
   - Detect language automatically
   - Reuse session unless expired
   - Logout only at end
   - Maintain thread safety
   - **For CREATE/PUT operations**: Always fetch attribute definitions first

### ⚠️ Common Mistakes to Avoid

- ❌ Using property names that don't exist in the schema
- ❌ Using wrong data types (e.g., string instead of object)
- ❌ Omitting required fields
- ❌ Adding extra fields not in the schema
- ❌ Parsing response fields that don't exist
- ❌ Using wrong header names or parameter locations

## 📤 7. Output Requirements

1. **Summary of intent**: What the user wants to achieve
2. **OpenAPI Schema Validation**: 
   - Endpoint path and method
   - Resolved request schema with all properties and types
   - Resolved response schema
   - Required vs optional fields
3. **Matched endpoints**: Which API endpoints will be used
4. **Changed files**: List of files created or modified
5. **Generated code**: The actual implementation
6. **Session integration**: How session management is implemented
7. **Concurrency explanation**: Thread-safety considerations

## 🧩 8. Example Behavior

**Reference complete examples in `/rules/examples/`**

### Example 1: Single Operation
**File**: `/rules/examples/01-single-operation.md`
**Scenario**: "Search for an item by number"
**Pattern**: Login → Operation → Logout

### Example 2: Series of Operations
**File**: `/rules/examples/02-series-operations.md`
**Scenario**: "Create a new item, then add files to it, and update its cost"
**Pattern**: Login → Op1 → Op2 → Op3 → Logout (session reused)

### Example 3: Metadata-Driven Operations
**File**: `/rules/examples/03-metadata-driven.md`
**Scenario**: "Update item's cost value using our API"
**Pattern**: Login → Fetch Metadata → Validate → Update → Logout

### Pattern Selection

Use decision tree in `/rules/README.md`:
- CREATE/UPDATE operation → Use Example 3 (metadata-driven)
- Single operation → Use Example 1
- Multiple operations → Use Example 2

Each example file contains:
- Complete working code
- Session flow diagram
- Best practices demonstrated
- Testing recommendations

## 🏁 End of Agent Definition
