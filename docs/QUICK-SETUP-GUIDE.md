# Arena Data Center - Quick Setup Guide

**Welcome!** This guide will help you get Arena Data Center up and running in minutes.

## Prerequisites

Before you begin:
- ✅ Active Arena PLM account
- ✅ Your Arena workspace ID
- ✅ Admin access to Arena (to create custom attributes)
- ✅ Google account with Sheets access

---

## Step 1: Connect to Arena (Required)

**Menu:** `Arena Data Center → Configuration → Configure Arena Connection`

1. Click the menu item
2. Enter your credentials:
   - **Arena URL**: Your workspace URL (e.g., `https://yourcompany.arenasolutions.com`)
   - **Email**: Your Arena login email
   - **Password**: Your Arena password
   - **Workspace ID**: Found in Arena under Settings → Workspace Info
3. Click **Save**
4. Test the connection: `Arena Data Center → Test Connection`

✅ **Success!** You should see a welcome message with your workspace details.

---

## Step 2: Configure Arena Attributes (Required for POD Push)

You need to create two custom attributes in Arena before using the "Push POD Structure" feature.

### 2a. Create "Row Location" Attribute (Item-Level)

**In Arena PLM:**

1. Go to **Settings → Item Attributes**
2. Click **New Attribute**
3. Configure:
   - **Name**: `Row Location`
   - **API Name**: `rowLocation`
   - **Type**: `SINGLE_LINE_TEXT`
   - **Description**: "Stores position information for Row items (e.g., Pos 1, Pos 3, Pos 5)"
4. **Apply to categories**: Select the category you'll use for Row items (e.g., "Assembly", "Data Center Row")
5. Click **Save**

### 2b. Create BOM Position Attribute (BOM-Level) - OPTIONAL

**In Arena PLM:**

1. Go to **Settings → BOM Attributes** (or Item Attributes depending on your Arena version)
2. Click **New Attribute**
3. Configure:
   - **Name**: `Rack Positions` (or any name you prefer)
   - **API Name**: `rackPositions`
   - **Type**: `SINGLE_LINE_TEXT`
   - **Description**: "Tracks which positions each rack occupies on a Row (e.g., Pos 1, Pos 3, Pos 8)"
4. **Apply to categories**: Select categories that will have BOMs (e.g., "Assembly", "Data Center Row")
5. Click **Save**

**In the Spreadsheet:**

1. Menu: `Arena Data Center → Configuration → Configure BOM Position Attribute`
2. Select your BOM attribute from the dropdown
3. Optionally adjust position format (default: `Pos {n}`)
4. Click **Save**

🎯 **What this does:** When you push a POD structure, each rack will be automatically tagged with its positions (like reference designators for electrical components).

---

## Step 3: Optional Customizations

### 3a. Configure Category Colors (Recommended)

**Menu:** `Arena Data Center → Configuration → Configure Category Colors`

Make your sheets more readable by color-coding Arena categories.

1. Browse your Arena categories
2. Mark frequently used categories as favorites (⭐)
3. Assign colors to different categories
4. Click **Save**

### 3b. Configure Rack Colors (Recommended)

**Menu:** `Arena Data Center → Configuration → Configure Rack Colors`

Assign colors to different rack types in your overview layouts for easy visual identification.

### 3c. Configure BOM Levels

**Menu:** `Arena Data Center → Configuration → Configure BOM Levels`

Define which Arena categories appear at which BOM hierarchy levels.

**Example:**
- Level 0: Hall
- Level 1: POD
- Level 2: Row
- Level 3: Rack
- Level 4: Component

### 3d. Configure Item Columns

**Menu:** `Arena Data Center → Configuration → Configure Item Columns`

Choose which Arena attributes to display as columns in your rack configurations.

---

## Step 4: Create Your First Rack Configuration

### Option A: Pull Existing Rack from Arena

1. Menu: `Arena Data Center → Show Rack Picker`
2. Browse or search for your rack
3. Click the rack card to select it
4. This creates a new sheet with the rack's BOM pulled from Arena

### Option B: Create Custom Rack

1. Menu: `Arena Data Center → Create Layout → New Rack Configuration`
2. Name your rack (e.g., "RACK-A-2024")
3. Add components using Item Picker:
   - Menu: `Arena Data Center → Show Item Picker`
   - Browse Arena categories
   - Use favorites for quick access
   - Click rows in your rack sheet to insert items

---

## Step 5: Create Overview Layout

1. Menu: `Arena Data Center → Create Layout → New Overview Layout`
2. Specify dimensions:
   - **Rows**: Number of rows in your data center
   - **Positions**: Number of rack positions per row
3. Place racks using Rack Picker:
   - Menu: `Arena Data Center → Show Rack Picker`
   - Select a rack
   - Click a cell in the overview to place it

---

## Step 6: Generate Consolidated BOM (Optional)

See all materials aggregated across your entire layout:

**Menu:** `Arena Data Center → BOM Operations → Create Consolidated BOM`

This creates a new sheet showing:
- All unique components
- Total quantities
- BOM hierarchy levels
- Categories

---

## Step 7: Push POD Structure to Arena

Ready to publish your design to Arena?

**Menu:** `Arena Data Center → BOM Operations → Push POD Structure to Arena`

**The system will:**
1. ✅ Validate Arena configuration
2. ✅ Identify custom racks and prompt you to create them
3. ✅ Let you choose: Update existing or create new
4. ✅ Prompt for Row item names
5. ✅ Prompt for POD item name
6. ✅ Create everything in Arena with correct hierarchy
7. ✅ Update your overview sheet with Arena links

**What gets created in Arena:**
- **Custom Rack Items** (if any) - With full BOMs
- **Row Items** - One per row, with Row Location attribute and BOM of racks
- **Rack Position Tracking** (if configured) - Each rack tagged with its positions
- **POD Item** - Top-level assembly containing all rows

---

## Troubleshooting

### Connection Issues

**Problem:** "Not Configured" error
- **Solution:** Complete Step 1 (Configure Arena Connection)

**Problem:** "Authentication Failed"
- **Solution:** Verify your Arena credentials are correct

### Publishing Issues

**Problem:** "Row Location attribute not found"
- **Solution:** Complete Step 2a (Create Row Location attribute in Arena)

**Problem:** BOM positions not showing in Arena
- **Solution:**
  1. Verify BOM Position Attribute is configured (Step 2b)
  2. Check that the attribute is applied to the Row category in Arena
  3. Verify you selected the attribute in Configure BOM Position Attribute

**Problem:** Rack items not found
- **Solution:**
  1. Ensure rack configurations have been saved
  2. For existing racks, use Rack Picker to pull from Arena first
  3. For custom racks, the system will prompt you to create them

### General Tips

- **Check the logs:** View → Executions to see detailed error messages
- **Test Connection:** Regularly test your Arena connection
- **Save often:** Click outside cells to save changes
- **Arena links:** Click the Arena links in your sheets to jump directly to items in PLM

---

## Feature Summary

| Feature | Menu Path | Purpose |
|---------|-----------|---------|
| **Item Picker** | Show Item Picker | Browse and insert Arena items |
| **Rack Picker** | Show Rack Picker | Select and place racks |
| **Rack Config** | Create Layout → New Rack Configuration | Create new rack BOM |
| **Overview** | Create Layout → New Overview Layout | Design data center layout |
| **Consolidated BOM** | BOM Operations → Create Consolidated BOM | Aggregate all materials |
| **Push POD** | BOM Operations → Push POD Structure to Arena | Publish hierarchy to Arena |
| **Position Attribute** | Configuration → Configure BOM Position Attribute | Enable rack position tracking |

---

## Quick Reference: Keyboard & Mouse

- **Item Picker**: Select item → Click row in sheet to insert
- **Rack Picker**: Select rack → Click cell in overview to place
- **Cell Editing**: Double-click to edit, Enter to save
- **Category Colors**: Applied automatically based on configuration
- **Arena Links**: Click to open item in Arena PLM

---

## Next Steps

Once you're set up:

1. **Create rack configurations** for all your rack types
2. **Design your overview layout** showing rack placements
3. **Generate consolidated BOM** to review materials
4. **Push to Arena** to create the full POD structure
5. **Use Arena links** to navigate between Sheets and Arena PLM

---

## Getting Help

- **In-App Help**: Menu → Help & Documentation
- **Check Logs**: View → Executions (Apps Script logs)
- **Documentation**: See `/docs` folder for technical details
- **Feature Guides**: See `/docs/BOM-Position-Attribute-Feature.md` for position tracking details

---

**You're all set!** Start building your data center configurations and enjoy seamless Arena PLM integration.

