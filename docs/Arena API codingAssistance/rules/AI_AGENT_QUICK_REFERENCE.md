# AI Agent Quick Reference Card

## 🚀 Start Here

```
WHEN: User requests Arena PLM integration
THEN: Follow this flow
```

---

## 📍 Step-by-Step Guide

### Step 1: Read Decision Tree
**File**: `/rules/README.md`
**Look for**: 🤖 Quick Start for AI Agents

### Step 2: Match Pattern
```
IF CREATE or UPDATE:
    → /rules/examples/03-metadata-driven.md
ELSE IF MULTIPLE operations:
    → /rules/examples/02-series-operations.md
ELSE:
    → /rules/examples/01-single-operation.md
```

### Step 3: Apply Patterns
```
ALWAYS apply:
  - /rules/patterns/session-management.md
  - /rules/patterns/three-layer-architecture.md
  - /rules/schemas/openapi-validation.md
```

### Step 4: Validate
```
RUN checklist from /rules/README.md
IF all_pass:
    PROCEED
ELSE:
    STOP
```

### Step 5: Generate Code
```
FOLLOW example structure
MATCH schema exactly
USE three layers
APPLY session pattern
```

---

## 🎯 Quick Pattern Matcher

### Keywords Detection

```python
# Series Operations Pattern
keywords = ["then", "and then", "after that", "also", "followed by"]
if any(kw in user_request.lower() for kw in keywords):
    pattern = "Series Operations"

# Metadata-Driven Pattern
keywords = ["create", "update", "set", "change", "modify"]
if any(kw in user_request.lower() for kw in keywords):
    must_fetch_metadata = True
    pattern = "Metadata-Driven"

# Single Operation Pattern
operation_count = count_operations(user_request)
if operation_count == 1:
    pattern = "Single Operation"
```

---

## ✅ Mandatory Checks

### Before Generating Code

```
[ ] Read OpenAPI spec
[ ] Resolve $ref references
[ ] Extract properties and types
[ ] Validate against schema
[ ] Select correct pattern
[ ] Plan session management
[ ] Design three layers
```

### During Code Generation

```
[ ] Property names match exactly
[ ] Data types match exactly
[ ] All required fields present
[ ] No extra fields added
[ ] Session reuse implemented
[ ] All three layers generated
[ ] try-finally for cleanup
```

### After Code Generation

```
[ ] Code compiles
[ ] Matches example structure
[ ] Follows session pattern
[ ] Has all three layers
[ ] Error handling present
```

---

## 🔀 Decision Flow

```
USER REQUEST
    ↓
┌───────────────────┐
│ Is it CREATE/     │
│ UPDATE?           │
└────┬──────────┬───┘
     │YES       │NO
     ↓          ↓
[Example 3] ┌───────────────────┐
            │ Multiple ops?      │
            └────┬──────────┬───┘
                 │YES       │NO
                 ↓          ↓
            [Example 2] [Example 1]
    ↓
APPLY:
  - Session pattern
  - Three-layer architecture
  - OpenAPI validation
    ↓
VALIDATE
    ↓
GENERATE
```

---

## 📋 Rule Files Map

| File | Purpose | When to Read |
|------|---------|--------------|
| `/rules/README.md` | Navigation | Always first |
| `/rules/patterns/session-management.md` | Session lifecycle | Always |
| `/rules/patterns/three-layer-architecture.md` | Architecture | Always |
| `/rules/schemas/openapi-validation.md` | Validation | Before code gen |
| `/rules/examples/01-single-operation.md` | Single op | 1 operation |
| `/rules/examples/02-series-operations.md` | Multiple ops | 2+ operations |
| `/rules/examples/03-metadata-driven.md` | CREATE/UPDATE | Metadata needed |

---

## 🚨 Critical Rules

```
RULE 1: Fetch metadata BEFORE CREATE/UPDATE
RULE 2: Login once, logout once
RULE 3: Generate all three layers
RULE 4: Match schema exactly
RULE 5: Use try-finally for cleanup
```

---

## ⚠️ Common Mistakes

```
❌ Logout between operations
❌ Missing DomainApi layer
❌ Wrong property names
❌ Guess schema instead of reading
❌ Skip metadata for CREATE/UPDATE
❌ Multiple SessionManager instances
❌ No try-finally cleanup
```

---

## 🎯 Success Criteria

```
✅ Code matches selected example
✅ All three layers present
✅ Session reused correctly
✅ Schema validation passed
✅ Metadata fetched if needed
✅ Error handling included
✅ Comments explain flow
```

---

## 💡 Pro Tips

1. **Always read README first** - Has decision tree
2. **Match keywords** - Detect pattern from user words
3. **Validate early** - Check schema before generating
4. **Follow examples exactly** - They're tested and working
5. **Use checklists** - Don't skip validation steps

---

## 🔗 Quick Links

- **Start**: `/rules/README.md` → 🤖 Quick Start
- **Session**: `/rules/patterns/session-management.md` → Decision Tree
- **Architecture**: `/rules/patterns/three-layer-architecture.md` → Generation Steps
- **Validation**: `/rules/schemas/openapi-validation.md` → Checklist
- **Examples**: `/rules/examples/*.md` → Use This Pattern When

---

## 📞 Emergency Checklist

If stuck, verify:
1. [ ] Read correct example for operation type?
2. [ ] Applied session management pattern?
3. [ ] Generated all three layers?
4. [ ] Validated against OpenAPI schema?
5. [ ] Followed example structure exactly?

If all yes → Generate code
If any no → Go back and fix

---

## 🎓 Learning Path

```
New to Arena PLM integration?

1. Read /rules/README.md (10 min)
2. Read /rules/examples/01-single-operation.md (5 min)
3. Read /rules/patterns/session-management.md (5 min)
4. Read /rules/patterns/three-layer-architecture.md (5 min)
5. Try generating simple search operation (10 min)

Total: 35 minutes to proficiency
```

---

## ✅ This Card Is Your Friend

**Bookmark this file**
**Reference it before every code generation**
**Follow the flow**
**Check the rules**
**Generate with confidence**

🤖 Happy coding! 🚀

