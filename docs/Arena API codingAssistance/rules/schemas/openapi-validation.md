# OpenAPI Schema Validation Rules

## 🤖 AI Agent Instructions

**WHEN**: Before generating any code that calls an API endpoint
**THEN**: Follow this validation process completely
**FAIL_IF**: Any validation step fails

---

## ⚠️ Critical Rule

```
IF generating_code_for_api_endpoint:
    MUST validate_against_openapi_schema() FIRST
    IF validation_fails:
        STOP and report_error()
    ELSE:
        PROCEED to generate_code()
```

**NEVER generate code before validating against the OpenAPI schema.**

---

## 📋 Validation Process (Execute in Order)

### Step 1: Extract Endpoint Details

From `paths[endpoint][method]`:
- ✅ Exact path (e.g., `/login`, `/items/{guid}`)
- ✅ HTTP method (GET, POST, PUT, PATCH, DELETE)
- ✅ Path parameters with types and formats
- ✅ Query parameters with types and required flag
- ✅ Header requirements

### Step 2: Resolve Request Schema

From `paths[endpoint][method].requestBody.content['application/json'].schema`:

1. **Extract the $ref**: `$ref: '#/components/schemas/LoginDetail'`
2. **Resolve to actual schema**: Navigate to `components.schemas.LoginDetail`
3. **Document all properties**:
   - Property names (exact camelCase)
   - Data types (string, integer, boolean, object, array)
   - Required fields (from `required` array)
   - Enums (from `enum` array)
   - Validation rules (patterns, min/max)

### Step 3: Resolve Response Schema

From `paths[endpoint][method].responses[200].content['application/json'].schema`:

1. **Extract the $ref**: `$ref: '#/components/schemas/LoginSuccess'`
2. **Resolve to actual schema**
3. **Identify critical fields**:
   - Session token field name
   - GUID fields
   - Status fields
   - Nesting structure

### Step 4: Validate Code Generation

**Decision Point**: Can I generate code now?

```
RUN validation_checklist():
    CHECK property_names_match_exactly(schema, generated_code)
    CHECK data_types_match_exactly(schema, generated_code)
    CHECK all_required_fields_included(schema, generated_code)
    CHECK no_extra_fields_added(generated_code, schema)
    CHECK parameter_locations_correct(schema, generated_code)
    
    IF all_checks_pass:
        RETURN true
    ELSE:
        RETURN false with failed_check_details

IF validation_checklist() == true:
    PROCEED to generate_code()
ELSE:
    STOP and fix_validation_errors()
```

**Validation Checklist** (MUST pass all):
- [ ] Property names match exactly (camelCase from schema)
- [ ] Data types match exactly (string→String, int64→Long, etc.)
- [ ] All required fields included in code
- [ ] No extra fields added beyond schema
- [ ] Parameter locations correct (path/query/header match schema)

## Example: Login Endpoint Validation

### OpenAPI Spec Analysis

```json
{
  "paths": {
    "/login": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginDetail"
              }
            }
          }
        },
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LoginSuccess"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "LoginDetail": {
        "type": "object",
        "properties": {
          "email": {"type": "string"},
          "password": {"type": "string"},
          "loginType": {
            "type": "string",
            "enum": ["EMAIL", "WEBTOKEN", "ACCESSTOKEN"]
          },
          "workspaceId": {"type": "integer", "format": "int64"}
        }
      },
      "LoginSuccess": {
        "type": "object",
        "properties": {
          "arenaSessionId": {"type": "string"},
          "workspaceId": {"type": "integer"},
          "workspaceName": {"type": "string"}
        }
      }
    }
  }
}
```

### Validated Code Generation

```java
// ✅ CORRECT: Matches schema exactly
public class LoginDetail {
    private String email;           // ✅ Correct type
    private String password;        // ✅ Correct type
    private String loginType;       // ✅ Correct type (enum)
    private Long workspaceId;       // ✅ Correct type (int64 → Long)
    
    // Getters and setters
}

public class LoginSuccess {
    private String arenaSessionId;  // ✅ Correct name (camelCase)
    private Long workspaceId;       // ✅ Correct type
    private String workspaceName;   // ✅ Correct name
    
    // Getters and setters
}

// Login implementation
LoginDetail request = new LoginDetail();
request.setEmail(email);            // ✅ Uses exact property name
request.setPassword(password);      // ✅ Uses exact property name
request.setLoginType("EMAIL");      // ✅ Uses valid enum value

String jsonBody = gson.toJson(request);
// Result: {"email":"...","password":"...","loginType":"EMAIL"}
```

### Common Mistakes (❌)

```java
// ❌ WRONG: Property name doesn't match schema
public class LoginDetail {
    private String userName;  // ❌ Should be "email"
    private String pwd;       // ❌ Should be "password"
}

// ❌ WRONG: Wrong data type
public class LoginDetail {
    private String workspaceId;  // ❌ Should be Long/Integer
}

// ❌ WRONG: Extra fields not in schema
public class LoginDetail {
    private String email;
    private String password;
    private String sessionId;  // ❌ Not in LoginDetail schema
}

// ❌ WRONG: Wrong response field name
public class LoginSuccess {
    private String sessionId;  // ❌ Should be "arenaSessionId"
}
```

## Validation Checklist

Before generating code:

- [ ] Endpoint path is exact match
- [ ] HTTP method is correct
- [ ] Request schema $ref resolved
- [ ] All request properties match (name, type)
- [ ] Required fields identified
- [ ] Response schema $ref resolved
- [ ] Response parsing uses correct field names
- [ ] Enums use valid values
- [ ] Data type conversions are correct (int64 → Long, etc.)
- [ ] No extra properties added
- [ ] No properties omitted

## Type Mapping Guidelines

| OpenAPI Type | Format | Java | TypeScript | Python |
|--------------|--------|------|------------|--------|
| string | - | String | string | str |
| string | date-time | String/LocalDateTime | string/Date | str/datetime |
| integer | int32 | Integer | number | int |
| integer | int64 | Long | number | int |
| number | float | Float | number | float |
| number | double | Double | number | float |
| boolean | - | Boolean | boolean | bool |
| array | - | List<T> | T[] | list |
| object | - | Object/Class | object/interface | dict/class |

## 🔀 AI Agent Decision Tree

```
START: User requests API operation
  ↓
STEP 1: Locate endpoint in OpenAPI spec
  ↓
FOUND? 
  ├─ NO → STOP: Report endpoint not found
  └─ YES → Continue
  ↓
STEP 2: Extract endpoint method (GET/POST/PUT/PATCH/DELETE)
  ↓
STEP 3: Resolve request schema ($ref → actual schema)
  ↓
RESOLVED?
  ├─ NO → STOP: Report unresolved reference
  └─ YES → Continue
  ↓
STEP 4: Extract all properties with types and required flags
  ↓
STEP 5: Resolve response schema ($ref → actual schema)
  ↓
STEP 6: Run validation checklist
  ↓
ALL CHECKS PASS?
  ├─ NO → STOP: Report validation failures
  └─ YES → Continue
  ↓
STEP 7: Generate code with exact schema match
  ↓
END: Code generation complete
```

---

## ✅ Must Do (MANDATORY)

```
ALWAYS:
  - Read OpenAPI spec before generating code
  - Resolve all $ref references completely
  - Match property names exactly as in schema
  - Use correct data types from schema
  - Include all required fields
  - Validate enum values against schema
```

---

## ❌ Must Not Do (FORBIDDEN)

```
NEVER:
  - Guess property names
  - Add fields not in schema
  - Use wrong data types
  - Skip schema validation
  - Assume field names (always use exact camelCase from schema)
  - Generate code before reading spec
  - Ignore required fields
  - Use invalid enum values
```

---

## 🎯 Quick Reference for AI Agents

**Before generating ANY API code, execute:**

```python
def validate_before_generating_code(endpoint, method):
    # Step 1: Get schema
    schema = openapi_spec['paths'][endpoint][method]
    
    # Step 2: Resolve request schema
    request_schema = resolve_ref(schema['requestBody']['content']['application/json']['schema'])
    
    # Step 3: Resolve response schema
    response_schema = resolve_ref(schema['responses']['200']['content']['application/json']['schema'])
    
    # Step 4: Validate
    assert all_properties_match(request_schema)
    assert all_types_correct(request_schema)
    assert all_required_fields_present(request_schema)
    assert no_extra_fields(request_schema)
    
    # Step 5: Only if all pass
    return True  # Now safe to generate code
```

