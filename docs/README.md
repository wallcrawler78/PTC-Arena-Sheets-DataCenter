# Arena PLM Integration - Documentation

Welcome to the Arena PLM Integration documentation! This folder contains comprehensive technical documentation for developers and end users working with this project.

## Documentation Structure

### For New Users

Start here to get up and running:

1. **[QUICK-SETUP-GUIDE.md](./QUICK-SETUP-GUIDE.md)**
   - Quick start for end users
   - Initial connection setup
   - Basic configuration
   - First layout creation

2. **In-App Help System**
   - Access via: Arena → Help → Show Help
   - Complete user guide with examples
   - Status tracking and history
   - Publishing workflows

### For Developers

3. **[TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md)**
   - What the application does
   - High-level architecture
   - Core concepts (Type System, Layouts, hierarchies)
   - Data flow diagrams
   - File organization

4. **[DEPLOYMENT.md](./DEPLOYMENT.md)**
   - Complete clasp deployment guide
   - First-time setup (step-by-step)
   - Daily development workflow
   - Multiple environment setup (dev/staging/prod)
   - Production deployment checklist
   - Troubleshooting clasp issues

5. **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**
   - Development environment setup
   - Common development tasks
   - Code style guidelines
   - Testing and debugging
   - Performance best practices

6. **[ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md)**
   - Complete Arena API reference
   - Authentication and session management
   - All API endpoints used
   - Common patterns and examples
   - Lessons learned and gotchas
   - Performance optimization tips

### For Understanding the Code

7. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
   - Detailed system architecture
   - Module breakdown (every `.gs` file explained)
   - Data models and structures
   - Design patterns used
   - State management
   - Extension points
   - Performance considerations

8. **[SECURITY-AUDIT.md](./SECURITY-AUDIT.md)**
   - Security review and best practices
   - Input validation
   - API security
   - Data protection

## Quick Start Guide

### I want to...

**...set up the tool for the first time**
→ Start with [QUICK-SETUP-GUIDE.md](./QUICK-SETUP-GUIDE.md) or run the in-app Setup Wizard

**...understand how the system works**
→ Read [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) first, then [ARCHITECTURE.md](./ARCHITECTURE.md)

**...work with the Arena API**
→ Go to [ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md) → Find your endpoint/operation

**...add a new feature**
→ Check [ARCHITECTURE.md](./ARCHITECTURE.md) → "Extension Points" section

**...debug an issue**
→ Check [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) → "Debugging" section

**...customize terminology and types**
→ Use Arena → Setup → Configuration → Configure Type System

## Documentation Standards

Each documentation file follows this structure:

- **Clear headings** - Easy to navigate
- **Code examples** - Real, working code
- **Context** - Why, not just what
- **Cross-references** - Links to related docs
- **TOC** - Table of contents for long docs

## Key Concepts Quick Reference

### Type System v2.0 (NEW)

The system is fully configurable and generic. Users can customize:
- **Primary Entity**: What you call your main items (e.g., "Rack", "Restaurant", "Assembly")
- **Type Definitions**: Classification system with keywords and colors
- **Category Classifications**: Optional secondary grouping
- **Layout Configuration**: Grid structure (rows × positions)
- **Hierarchy Levels**: Organizational structure names (Level 0, 1, 2)

Configure via: **Arena → Setup → Configuration → Configure Type System**

### Hierarchical Structure Example

```
Level 0 (e.g., POD, Restaurant, Production Line)
 ├─ Level 1 (e.g., Row, SubAssembly, Station)
 │   ├─ Level 2 Item A (quantity: 2) [with Position attribute if configured]
 │   └─ Level 2 Item B (quantity: 1) [with Position attribute if configured]
 ├─ Level 1 #2
 │   └─ Level 2 Item C (quantity: 3) [with Position attribute if configured]
 └─ ...
```

### File Organization

```
Code.gs                    - Main entry point, menu, events
ArenaAPI.gs                - Arena API client
Authorization.gs           - Arena authentication and session management
TypeSystemConfig.gs        - Generic type system configuration (NEW v2.0)
BOMBuilder.gs              - BOM operations, hierarchical structures
BOMConfiguration.gs        - BOM attribute configuration (position tracking)
RackConfigManager.gs       - Configuration management
LayoutManager.gs           - Overview layouts
CategoryManager.gs         - Categories, colors, BOM levels
MigrationManager.gs        - Auto-migration for existing users
SetupWizard.html           - Initial configuration wizard
ConfigureTypeSystem.html   - Type System v2.0 configuration UI (NEW)
```

### Common Patterns

```javascript
// Get dynamic terminology
var entitySingular = getTerminology('entity_singular'); // e.g., "Rack", "Restaurant"
var level0 = getTerminology('hierarchy_level_0');       // e.g., "POD", "Restaurant"

// Arena API call
var client = new ArenaAPIClient();
var items = client.getItems();

// Handle response variations
var data = response.results || response.Results || [];

// Cache data
var cache = CacheService.getUserCache();
cache.put('key', JSON.stringify(data), 3600);

// Get BOM position configuration
var positionConfig = getBOMPositionAttributeConfig();
if (positionConfig) {
  // Position tracking is enabled
  var bomAttributes = {};
  bomAttributes[itemNumber] = {};
  bomAttributes[itemNumber][positionConfig.guid] = "Pos 1, Pos 3";
}

// Load type system configuration
var typeConfig = {
  primaryEntity: getPrimaryEntityType(),
  typeDefinitions: getTypeDefinitions(),
  layoutConfig: getLayoutConfig(),
  hierarchyLevels: getHierarchyLevels()
};
```

## New Features (v2.0)

### Fully Generic Type System
The application is no longer datacenter-specific! Users can configure it for:
- Data center infrastructure (Racks, PODs, Rows)
- Manufacturing (Assemblies, Production Lines, Stations)
- Warehouse management (Shelf Units, Warehouses, Aisles)
- Food service (Restaurants, SubAssemblies)
- Any vertical industry with hierarchical BOMs

### Setup Wizard
First-time users see a 4-step wizard with:
- Preset configurations (Datacenter, Manufacturing, Warehouse, Custom)
- Entity name customization
- Hierarchy level configuration
- Auto-detection of existing configurations

### Configuration UI
Complete UI for managing:
- Entity terminology (singular, plural, verb)
- Type classifications (add/edit/delete, keywords, colors)
- Category classifications (optional)
- Layout settings (rows, positions, labels)
- Hierarchy level names

Access via: **Arena → Setup → Configuration → Configure Type System**

## Contributing to Documentation

When adding features or fixing bugs:

1. **Update relevant docs** - Don't let docs go stale!
2. **Update code examples** - Keep them accurate
3. **Add to Quick Reference** - If it's a common pattern
4. **Update HelpModal.html** - For user-facing changes
5. **Use dynamic terminology** - Never hardcode "rack", "datacenter", etc.

### Documentation Checklist

When making changes:

- [ ] Updated TECHNICAL_OVERVIEW.md (if architecture changed)
- [ ] Updated ARCHITECTURE.md (if modules/structure changed)
- [ ] Updated ARENA_API_GUIDE.md (if API usage changed)
- [ ] Updated DEVELOPER_GUIDE.md (if setup/workflow changed)
- [ ] Updated code comments
- [ ] Updated HelpModal.html (for user-facing changes)
- [ ] Verified no hardcoded terminology (use getTerminology())

## Getting Help

If documentation is unclear or missing something:

1. **Check in-app help** - Arena → Help → Show Help
2. **Check other docs** - Might be covered elsewhere
3. **Search ARCHITECTURE.md** - Technical details
4. **Check code comments** - Inline documentation

## External Resources

- **Apps Script Docs**: https://developers.google.com/apps-script
- **Apps Script Reference**: https://developers.google.com/apps-script/reference
- **Clasp**: https://github.com/google/clasp
- **Arena API**: (Check your Arena workspace for API documentation)

---

**Remember**: Good documentation is an investment in the project's future! When in doubt, use dynamic terminology with `getTerminology()` to keep the system generic.
