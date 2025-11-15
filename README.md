# Arena Data Center

A Google Sheets-based application for managing data center infrastructure configurations with PTC Arena PLM integration.

## What It Does

Arena Data Center helps you:
- **Design rack configurations** with components from Arena
- **Create visual data center layouts** with rack placements in an overview grid
- **Generate consolidated BOMs** that aggregate materials across all racks
- **Push complete POD/Row/Rack hierarchies to Arena** with proper BOM structures and Row Location tracking

## Quick Start

### For Users

1. Open your Google Sheet
2. **Arena Data Center** menu → **Configure Arena Connection**
3. Enter your Arena credentials
4. Start creating rack configurations and layouts!
5. Need help? **Arena Data Center** menu → **Help & Documentation**

### For Developers

1. Clone this repository
2. Install Clasp: `npm install -g @google/clasp`
3. Push to Apps Script: `clasp push`
4. Read the [Developer Guide](./docs/DEVELOPER_GUIDE.md)

## Key Features

### Rack Configuration Management
- Create racks from existing Arena items or build from scratch
- Use **Item Picker** to browse and add components
- Automatically populate rack BOMs from Arena
- Configure custom attributes to display

### Visual Layout Design
- Create overview grids representing data center rows and positions
- Drag and drop (via **Rack Picker**) racks into positions
- Color-coded racks by category
- Automatic hyperlinking between overview and rack sheets

### BOM Operations
- **Consolidated BOM**: Aggregates all components across rack instances
- Hierarchical organization by BOM levels
- Category-based color coding
- Export to Arena

### POD Structure Publishing
- Creates hierarchical structure in Arena:
  - **POD** (top-level assembly)
  - **Rows** (with Row Location attribute: "Pos 1, Pos 3, Pos 5")
  - **Racks** (with full component BOMs)
- Automatically handles custom rack creation
- Updates overview sheet with Arena links

### Configuration
- **Category Colors**: Visual coding for component categories
- **Rack Colors**: Color-code racks by type
- **BOM Levels**: Configure hierarchical levels
- **Item Columns**: Choose which Arena attributes to display
- **Favorites**: Mark favorite categories for quick access

## Documentation

### For Developers

Comprehensive technical documentation is available in the [`/docs`](./docs) folder:

- **[Technical Overview](./docs/TECHNICAL_OVERVIEW.md)** - System architecture and core concepts
- **[Arena API Guide](./docs/ARENA_API_GUIDE.md)** - Complete API integration reference with lessons learned
- **[Architecture](./docs/ARCHITECTURE.md)** - Detailed code structure and module breakdown
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Setup, workflow, and development tasks
- **[Lessons Learned](./docs/LESSONS_LEARNED.md)** - Common pitfalls and best practices

**Start with**: [docs/README.md](./docs/README.md)

## Technology Stack

- **Google Apps Script** - Server-side JavaScript runtime
- **Google Sheets** - Data storage and UI
- **HTML Service** - Custom UI components (sidebars, modals)
- **PTC Arena PLM API** - REST API integration
- **Clasp** - Local development and deployment

## Project Structure

```
├── Code.gs                    # Main entry point, menu, events
├── ArenaAPI.gs               # Arena API client
├── Authorization.gs          # Auth & session management
├── BOMBuilder.gs            # BOM operations, POD structure
├── RackConfigManager.gs     # Rack management
├── LayoutManager.gs         # Overview layouts
├── CategoryManager.gs       # Category, color, BOM levels
├── Config.gs                # Configuration storage
├── *.html                   # UI components
├── docs/                    # Comprehensive documentation
│   ├── README.md
│   ├── TECHNICAL_OVERVIEW.md
│   ├── ARENA_API_GUIDE.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPER_GUIDE.md
│   └── LESSONS_LEARNED.md
└── README.md               # This file
```

## Development

### Requirements

- Node.js (v14+)
- Google Account
- PTC Arena Account
- Clasp CLI

### Setup

```bash
# Clone repository
git clone https://github.com/wallcrawler78/PTC-Arena-Sheets-DataCenter.git
cd PTC-Arena-Sheets-DataCenter

# Install Clasp
npm install -g @google/clasp

# Login to Google
clasp login

# Push code to Apps Script
clasp push

# Open in browser
clasp open
```

See [Developer Guide](./docs/DEVELOPER_GUIDE.md) for detailed setup instructions.

### Deployment

```bash
# Push changes to Apps Script
clasp push

# Commit to Git
git add .
git commit -m "Description"
git push
```

## Security

- Credentials stored securely in `PropertiesService` (encrypted by Google)
- Session-based authentication with automatic re-login
- No credentials in code or sheet data
- User-specific storage (credentials not shared between users)

## Arena Setup Requirements

Before using POD structure features, create a custom attribute in Arena:

1. In Arena: Settings → Item Attributes
2. Create attribute:
   - **Name**: `Row Location`
   - **Type**: `SINGLE_LINE_TEXT`
3. This stores position information (e.g., "Pos 1, Pos 3, Pos 5")

## Use Cases

### Data Center Designers
- Design rack configurations with real Arena components
- Visualize data center layouts
- Generate accurate material requirements
- Push designs to Arena for procurement

### Procurement Teams
- Get consolidated BOMs for entire data center sections
- Track quantities across multiple rack instances
- Export to Arena for ordering

### Engineering Teams
- Manage rack standards and configurations
- Maintain BOM hierarchy
- Collaborate on designs using Google Sheets

## Support

- **User Help**: Menu → Help & Documentation (in-app)
- **Developer Docs**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/wallcrawler78/PTC-Arena-Sheets-DataCenter/issues)

## License

[Add license information]

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

See [Developer Guide](./docs/DEVELOPER_GUIDE.md) for details.

## Acknowledgments

Built with Google Apps Script and PTC Arena PLM API.

---

**For detailed technical information, see the [documentation](./docs/README.md).**
