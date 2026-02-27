# Arena PLM Integration - Rules & Examples Index

## 🤖 Quick Start for AI Agents

**START HERE**: Follow this decision tree to find the right rule/example:

```
USER REQUEST RECEIVED
  ↓
STEP 1: What type of request?
  ├─ API operation? → Continue to STEP 2
  ├─ Architecture question? → Read /patterns/three-layer-architecture.md
  └─ Validation question? → Read /schemas/openapi-validation.md
  ↓
STEP 2: Is it CREATE or UPDATE?
  ├─ YES → Use Example 3 (/examples/03-metadata-driven.md)
  └─ NO → Continue to STEP 3
  ↓
STEP 3: How many operations?
  ├─ ONE operation → Use Example 1 (/examples/01-single-operation.md)
  └─ MULTIPLE operations → Use Example 2 (/examples/02-series-operations.md)
  ↓
STEP 4: Apply patterns
  - Session management: /patterns/session-management.md
  - Architecture: /patterns/three-layer-architecture.md
  - Validation: /schemas/openapi-validation.md
  ↓
GENERATE CODE
```

---

This directory contains best practice rules and examples for Arena PLM API integration.

## 📁 Directory Structure

```
/rules
├── patterns/          # Architectural patterns and rules
├── examples/          # Complete working examples
├── schemas/           # OpenAPI validation rules
└── README.md         # This file
```

---

## 📖 Patterns

### 1. Session Management Pattern
**File**: `patterns/session-management.md`

**Purpose**: Define the correct session lifecycle pattern

**Key Rules**:
- Login once at the beginning
- Reuse session for all operations
- Do NOT logout between operations
- Logout once at the end
- Thread-safe session caching required

**Applies to**: All API integrations regardless of language

---

### 2. Three-Layer Architecture Pattern
**File**: `patterns/three-layer-architecture.md`

**Purpose**: Define the mandatory three-layer architecture

**Key Rules**:
- Layer 1: SessionManager (authentication)
- Layer 2: ApiClient (HTTP operations)
- Layer 3: DomainApi (business logic)
- Always generate all three layers
- User code interacts with DomainApi only

**Applies to**: All API integrations regardless of language

---

## 🔍 Schema Validation

### OpenAPI Validation Rules
**File**: `schemas/openapi-validation.md`

**Purpose**: Ensure generated code matches OpenAPI spec exactly

**Key Rules**:
- Never generate code before reading OpenAPI spec
- Resolve all $ref references
- Match property names exactly (camelCase)
- Use correct data types
- Include all required fields
- No extra properties

**Applies to**: All code generation from OpenAPI specs

---

## 📝 Examples

### Example 1: Single Operation
**File**: `examples/01-single-operation.md`

**Scenario**: "Search for an item by number"

**Demonstrates**:
- Single operation pattern
- Automatic login on first call
- Simple try-finally block
- Proper error handling

**Use when**: User requests ONE operation

---

### Example 2: Series of Operations
**File**: `examples/02-series-operations.md`

**Scenario**: "Create a new item, then add files to it, and update its cost"

**Demonstrates**:
- Series operation pattern (3+ operations)
- Login once, reuse session
- Multiple API calls in sequence
- Single try-finally for all operations
- Logout once at end

**Use when**: User requests MULTIPLE operations

---

### Example 3: Metadata-Driven Operations
**File**: `examples/03-metadata-driven.md`

**Scenario**: "Update item's cost value using our API"

**Demonstrates**:
- Fetch metadata BEFORE update (best practice)
- Validate field type
- Check possible values (picklists)
- Fail early with clear error messages
- Type-safe updates

**Use when**: User requests CREATE or UPDATE operations

---

## 🎯 Usage Guide

### For AI Agents (GitHub Copilot)

When generating code for Arena PLM integration:

1. **Determine operation type**:
   - Single operation → Use Example 1 pattern
   - Multiple operations → Use Example 2 pattern
   - CREATE/UPDATE → Use Example 3 pattern (metadata first)

2. **Follow architecture**:
   - Read `patterns/three-layer-architecture.md`
   - Generate SessionManager, ApiClient, DomainApi

3. **Follow session pattern**:
   - Read `patterns/session-management.md`
   - Implement login once, reuse, logout once

4. **Validate against OpenAPI**:
   - Read `schemas/openapi-validation.md`
   - Match schemas exactly

### For Human Developers

When implementing Arena PLM integration:

1. **Read patterns first**: Understand the architecture and session management
2. **Choose appropriate example**: Based on your use case
3. **Follow validation rules**: Ensure OpenAPI compliance
4. **Test with examples**: Use provided test recommendations

---

## 🔄 Detailed Pattern Decision Tree

```
ANALYZE user_request
  ↓
EXTRACT intent and requirements
  ↓
┌─────────────────────────────────────────┐
│ Decision Point 1: Operation Type        │
└─────────────────────────────────────────┘
  ↓
Is it CREATE or UPDATE operation?
  ├─ YES → MANDATORY: Use Example 3 (metadata-driven)
  │        REASON: Must fetch metadata before CREATE/UPDATE
  │        FILE: /examples/03-metadata-driven.md
  │
  └─ NO → Continue to Decision Point 2
  ↓
┌─────────────────────────────────────────┐
│ Decision Point 2: Operation Count       │
└─────────────────────────────────────────┘
  ↓
How many operations in user request?
  ├─ ONE operation → Use Example 1 (single operation)
  │                  FILE: /examples/01-single-operation.md
  │                  PATTERN: Login → Op → Logout
  │
  └─ MULTIPLE operations → Use Example 2 (series operations)
                           FILE: /examples/02-series-operations.md
                           PATTERN: Login → Op1 → Op2 → ... → Logout
  ↓
┌─────────────────────────────────────────┐
│ Apply Required Patterns                 │
└─────────────────────────────────────────┘
  ↓
APPLY session management pattern
  FILE: /patterns/session-management.md
  RULE: Login once, reuse session, logout once
  ↓
APPLY three-layer architecture
  FILE: /patterns/three-layer-architecture.md
  RULE: Must generate all 3 layers
  ↓
VALIDATE against OpenAPI schema
  FILE: /schemas/openapi-validation.md
  RULE: Validate before generating code
  ↓
┌─────────────────────────────────────────┐
│ Generate Code                           │
└─────────────────────────────────────────┘
  ↓
OUTPUT: Complete integration code
```

---

## ✅ AI Agent Compliance Checklist

**Execute this checklist BEFORE generating ANY code:**

```
CHECKLIST: Pre-Code-Generation Validation

[ ] STEP 1: Pattern Selection
    [ ] Identified operation type (single/multiple/create/update)
    [ ] Selected appropriate example file
    [ ] Read example file completely

[ ] STEP 2: Architecture Compliance
    [ ] Will generate Layer 1 (SessionManager)
    [ ] Will generate Layer 2 (ApiClient)
    [ ] Will generate Layer 3 (DomainApi)
    [ ] Read /patterns/three-layer-architecture.md

[ ] STEP 3: Session Management Compliance
    [ ] Login once at beginning
    [ ] Session reuse for all operations
    [ ] No logout between operations
    [ ] Logout once at end
    [ ] try-finally block for cleanup
    [ ] Read /patterns/session-management.md

[ ] STEP 4: OpenAPI Validation
    [ ] Read OpenAPI spec for endpoint
    [ ] Resolved all $ref references
    [ ] Extracted property names (exact camelCase)
    [ ] Extracted data types
    [ ] Identified required fields
    [ ] Read /schemas/openapi-validation.md

[ ] STEP 5: Code Quality
    [ ] Property names match schema exactly
    [ ] Data types match schema exactly
    [ ] All required fields included
    [ ] No extra fields added
    [ ] Error handling included
    [ ] Comments explain key steps

IF all_checks_pass:
    PROCEED to generate_code()
ELSE:
    STOP and fix_compliance_issues()
```

---

## 📚 Quick Reference

| Scenario | Pattern | Example | Key File |
|----------|---------|---------|----------|
| Search item | Single Op | Example 1 | `examples/01-single-operation.md` |
| Create item | Metadata | Example 3 | `examples/03-metadata-driven.md` |
| Update item | Metadata | Example 3 | `examples/03-metadata-driven.md` |
| Multiple ops | Series | Example 2 | `examples/02-series-operations.md` |
| Architecture | 3-Layer | N/A | `patterns/three-layer-architecture.md` |
| Session | Reuse | All | `patterns/session-management.md` |
| Validation | OpenAPI | All | `schemas/openapi-validation.md` |

---

## 🎓 Best Practices Summary

1. **Always use three-layer architecture**
2. **Login once, reuse session, logout once**
3. **Fetch metadata before CREATE/UPDATE**
4. **Validate against OpenAPI spec**
5. **Use try-finally for cleanup**
6. **Fail early with clear errors**
7. **Make DomainApi methods descriptive**
8. **Keep session management thread-safe**

---

## 🔗 Related Documentation

- Main project README: `/README.md`
- Quick start guide: `/QUICKSTART.md`
- Architecture explanation: `/ARCHITECTURE_EXPLAINED.md`
- Copilot instructions: `/.github/copilot-instructions.md`

---

## 📝 Contributing New Rules

When adding new rules or examples:

1. Create file in appropriate directory
2. Follow existing format
3. Include code examples
4. Update this README index
5. Reference from Copilot instructions if needed

