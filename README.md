# PTC Arena PLM - Google Sheets Add-on

A powerful Google Sheets add-on for managing datacenter layouts and BOMs (Bill of Materials) integrated with PTC Arena PLM.

## Features

### Item Browser
- **Animated sidebar navigation** with category-based browsing
- **Lifecycle filtering** (Production, Prototype, Engineering, etc.)
- **Real-time search** by item number or description
- **Click-to-insert** items directly into your spreadsheet
- **Auto-populate attributes** like description, revision, power consumption, etc.
- **Category color coding** for visual organization

### BOM Management
- **Hierarchical BOM structure** (Hall → Pod → Rack → Server → Component)
- **Push BOM** to Arena PLM
- **Pull BOM** from Arena PLM
- **Automatic level calculation** based on categories
- **Quantity tracking** for repeated items

### Configuration Options
- **Login credentials** stored securely in script properties
- **Custom item columns** - select which attributes to display
- **Category colors** - customize colors for each item category
- **BOM hierarchy** - define your own category levels

## Installation

### 1. Create a New Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it (e.g., "Datacenter Planning")

### 2. Open Apps Script Editor

1. Click **Extensions** → **Apps Script**
2. Delete any existing code in the editor

### 3. Add the Script Files

Create the following files in the Apps Script editor:

#### Code.gs
Copy the contents from `Code.gs`

#### Config.gs
Copy the contents from `Config.gs`

#### ArenaAPI.gs
Copy the contents from `ArenaAPI.gs`

#### BOM.gs
Copy the contents from `BOM.gs`

#### HTML Files
Click the **+** button next to Files and select **HTML**. Create these files:
- `Sidebar.html`
- `LoginConfig.html`
- `ItemColumnsConfig.html`
- `CategoryColorsConfig.html`
- `BOMHierarchyConfig.html`

Copy the respective content into each file.

### 4. Save and Deploy

1. Click the **disk icon** or press `Ctrl+S` to save
2. Close the Apps Script editor
3. Refresh your Google Sheet
4. You should see a new menu: **Arena PLM**

## Initial Setup

### 1. Configure Login Credentials

1. Click **Arena PLM** → **Configuration** → **Configure Login**
2. Enter your Arena PLM credentials:
   - **Arena API URL**: `https://api.arenasolutions.com/v1` (or your custom URL)
   - **Username**: Your Arena email
   - **Password**: Your Arena password
3. Click **Save Credentials**

### 2. Configure Item Columns

1. Click **Arena PLM** → **Configuration** → **Configure Item Columns**
2. Check which attributes you want to display next to item numbers:
   - Description
   - Revision
   - Lifecycle
   - Category
   - Power Consumption
   - Weight
   - Rack Units
   - Manufacturer
   - Vendor
   - Cost
   - Lead Time
3. Click **Save Configuration**

### 3. Configure Category Colors

1. Click **Arena PLM** → **Configuration** → **Configure Category Colors**
2. Set background colors for each category:
   - Hall (default: light green)
   - Pod (default: light blue)
   - Rack (default: light orange)
   - Server (default: light purple)
   - Component (default: white)
3. Add custom categories if needed
4. Click **Save Configuration**

### 4. Configure BOM Hierarchy

1. Click **Arena PLM** → **Configuration** → **Configure BOM Hierarchy**
2. Define the hierarchy levels:
   - Level 0: Hall (top level)
   - Level 1: Pod
   - Level 2: Rack
   - Level 3: Server
   - Level 4: Component
3. Adjust as needed for your organization
4. Click **Save Configuration**

## Usage

### Adding Items to Your Sheet

1. Click **Arena PLM** → **Show Item Browser**
2. The sidebar will appear on the right
3. Select a **lifecycle filter** (default: Production)
4. Choose a **category** from the pills at the top
5. Browse the list of items or use the **search box**
6. Click an item to select it
7. Click a cell in your sheet where you want to insert the item
8. Click the **+ button** in the sidebar
9. The item number and attributes will be automatically inserted

### Building a Datacenter Layout

#### Vertical Configuration (Server Tower)
1. In column A, add items vertically representing a server tower
2. Items are automatically color-coded by category
3. Attributes populate in adjacent columns

#### Horizontal Configuration (Datacenter Rows)
1. Create a new tab for datacenter layout
2. Lay out server configurations horizontally (top-down view)
3. Replicate configurations across rows (e.g., server stack × 20 × 3 rows)

### Managing BOMs

#### Build BOM Levels
1. After adding items to your sheet
2. Click **Arena PLM** → **BOM Actions** → **Build BOM Levels**
3. The system calculates levels based on category hierarchy
4. Levels are added to column K

#### Push BOM to Arena
1. Click **Arena PLM** → **BOM Actions** → **Push BOM to Arena**
2. Enter the parent item number
3. Confirm the push
4. The BOM will update the working revision in Arena

#### Pull BOM from Arena
1. Click **Arena PLM** → **BOM Actions** → **Pull BOM from Arena**
2. Enter the parent item number
3. Confirm the pull
4. The sheet will populate with the BOM structure

### Quantity Tracking
- The system automatically tracks repeated items
- When you push a BOM, quantities are calculated
- Column J shows the quantity for each unique item

## Workflow Example

1. **Plan your datacenter:**
   - Open the item browser
   - Filter to Production lifecycle
   - Select "Hall" category and add your halls
   - Select "Pod" category and add pods
   - Continue with Racks, Servers, and Components

2. **Verify your design:**
   - Check that all items have proper lifecycle status
   - Review attributes (power consumption, rack units, etc.)
   - Ensure color coding is correct

3. **Build BOM structure:**
   - Run "Build BOM Levels" to calculate hierarchy
   - Review the levels in column K

4. **Push to Arena:**
   - Run "Push BOM to Arena"
   - Enter the parent assembly item number
   - The BOM is now in Arena PLM

5. **Make updates:**
   - Pull the BOM back anytime with "Pull BOM from Arena"
   - Edit in the sheet
   - Push updates back to Arena

## Column Reference

| Column | Content |
|--------|---------|
| A | Item Number |
| B-I | Configured Attributes (Description, Revision, etc.) |
| J | Quantity (calculated on BOM operations) |
| K | BOM Level (0 = top level) |

## Arena PLM API Integration

This add-on uses the Arena PLM REST API v1. Make sure you have:
- Valid Arena PLM credentials
- API access enabled on your Arena account
- Proper permissions to read/write items and BOMs

### API Endpoints Used
- `/categories` - Get item categories
- `/items` - Search and filter items
- `/items/{number}` - Get item details
- `/items/{number}/bom` - Get/Update BOM

## Troubleshooting

### "Arena credentials not configured" error
- Go to **Arena PLM** → **Configuration** → **Configure Login**
- Re-enter your credentials

### Items not loading
- Check your Arena credentials
- Verify you have API access enabled
- Check the Apps Script execution logs (View → Logs)

### BOM push/pull fails
- Ensure the parent item exists in Arena
- Verify you have edit permissions
- Check that all item numbers in the sheet are valid

### Colors not appearing
- Configure category colors in **Configuration** → **Configure Category Colors**
- Ensure items have the correct category assigned in Arena

## Support

For issues or questions:
1. Check the Apps Script logs: **Extensions** → **Apps Script** → **View** → **Logs**
2. Review the Arena PLM API documentation
3. Verify your Arena account permissions

## Credits

Built for datacenter planning and BOM management with PTC Arena PLM integration.

## License

This project is provided as-is for use with PTC Arena PLM.
