# Arena Data Center - Documentation

Welcome to the Arena Data Center documentation! This folder contains comprehensive technical documentation for developers working on or maintaining this project.

## Documentation Structure

### For New Developers

Start here to get up and running:

1. **[TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)**
   - What the application does
   - High-level architecture
   - Core concepts (Racks, Layouts, POD structure)
   - Data flow diagrams
   - File organization

2. **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**
   - Development environment setup
   - How to install and configure Clasp
   - Development workflow
   - Common development tasks
   - Code style guidelines
   - Testing and debugging

3. **[ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md)**
   - Complete Arena API reference
   - Authentication and session management
   - All API endpoints used
   - Common patterns and examples
   - Lessons learned and gotchas
   - Performance optimization tips

### For Understanding the Code

4. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
   - Detailed system architecture
   - Module breakdown (every `.gs` file explained)
   - Data models and structures
   - Design patterns used
   - State management
   - Extension points
   - Performance considerations

5. **[LESSONS_LEARNED.md](./LESSONS_LEARNED.md)**
   - Real-world lessons from development
   - Common mistakes and how to avoid them
   - Best practices discovered
   - Quick reference patterns
   - Top 10 most important lessons

## Quick Start Guide

### I want to...

**...set up my development environment**
→ Start with [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) → "Initial Setup" section

**...understand how the system works**
→ Read [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) first, then [ARCHITECTURE.md](./ARCHITECTURE.md)

**...work with the Arena API**
→ Go to [ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md) → Find your endpoint/operation

**...add a new feature**
→ Check [ARCHITECTURE.md](./ARCHITECTURE.md) → "Extension Points" section

**...debug an issue**
→ Check [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) → Look for similar problems
→ Then [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) → "Debugging" section

**...understand why something is done a certain way**
→ Search [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) for context

## Documentation Standards

Each documentation file follows this structure:

- **Clear headings** - Easy to navigate
- **Code examples** - Real, working code
- **Context** - Why, not just what
- **Cross-references** - Links to related docs
- **TOC** - Table of contents for long docs

## Key Concepts Quick Reference

### POD Structure
```
POD (Point of Delivery)
 ├─ Row 1 (with Row Location attribute)
 │   ├─ Rack A (quantity: 2)
 │   └─ Rack B (quantity: 1)
 ├─ Row 2
 │   └─ Rack C (quantity: 3)
 └─ ...
```

### File Organization
```
Code.gs              - Main entry point, menu, events
ArenaAPI.gs          - Arena API client
BOMBuilder.gs        - BOM operations, POD structure
RackConfigManager.gs - Rack management
LayoutManager.gs     - Overview layouts
CategoryManager.gs   - Categories, colors, BOM levels
```

### Common Patterns
```javascript
// Arena API call
var client = new ArenaAPIClient();
var items = client.getItems();

// Handle response variations
var data = response.results || response.Results || [];

// Cache data
var cache = CacheService.getUserCache();
cache.put('key', JSON.stringify(data), 3600);
```

## Archive

Historical documentation from development sessions can be found in `/docs/archive/`:

- `SESSION_*.md` - Development session summaries
- `IMPLEMENTATION_STATUS.md` - Historical status tracking
- `APPLICATION_DOCUMENTATION.md` - Original application docs
- `DEPLOYMENT.md` - Deployment notes

These are kept for reference but superseded by the main documentation.

## Contributing to Documentation

When adding features or fixing bugs:

1. **Update relevant docs** - Don't let docs go stale!
2. **Add to LESSONS_LEARNED.md** - Share what you learned
3. **Update code examples** - Keep them accurate
4. **Add to Quick Reference** - If it's a common pattern

### Documentation Checklist

When making changes:

- [ ] Updated TECHNICAL_OVERVIEW.md (if architecture changed)
- [ ] Updated ARCHITECTURE.md (if modules/structure changed)
- [ ] Updated ARENA_API_GUIDE.md (if API usage changed)
- [ ] Added to LESSONS_LEARNED.md (if you learned something)
- [ ] Updated DEVELOPER_GUIDE.md (if setup/workflow changed)
- [ ] Updated code comments

## Getting Help

If documentation is unclear or missing something:

1. **Check other docs** - Might be covered elsewhere
2. **Search LESSONS_LEARNED.md** - Similar issues?
3. **Check code comments** - Inline documentation
4. **Ask the team** - Update docs with answer!

## External Resources

- **Apps Script Docs**: https://developers.google.com/apps-script
- **Apps Script Reference**: https://developers.google.com/apps-script/reference
- **Clasp**: https://github.com/google/clasp
- **Arena API**: (Check your Arena workspace for API documentation)

---

**Remember**: Good documentation is an investment in the project's future!
