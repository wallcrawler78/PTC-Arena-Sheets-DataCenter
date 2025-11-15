# Quick Start Guide

Get your Arena PLM Google Sheets add-on running in 10 minutes!

## Step 1: Create Your Google Sheet (2 min)

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **Blank** to create a new spreadsheet
3. Name it "Datacenter Planning" or similar

## Step 2: Set Up Apps Script (5 min)

1. In your sheet, click **Extensions** → **Apps Script**
2. You'll see a code editor with a default `myFunction()`

### Add the Files

Click the **+** next to **Files** and create these files:

**Server-side files (Apps Script):**
1. Replace content in `Code.gs` with content from this repo's `Code.gs`
2. Add new file `Config.gs` (click + → Script file)
3. Add new file `ArenaAPI.gs` (click + → Script file)
4. Add new file `BOM.gs` (click + → Script file)

**Client-side files (HTML):**
1. Add `Sidebar.html` (click + → HTML file)
2. Add `LoginConfig.html` (click + → HTML file)
3. Add `ItemColumnsConfig.html` (click + → HTML file)
4. Add `CategoryColorsConfig.html` (click + → HTML file)
5. Add `BOMHierarchyConfig.html` (click + → HTML file)

Copy the content from each file in this repository into the corresponding file in Apps Script.

### Save Your Project

1. Click the **disk icon** or press `Ctrl+S`
2. Name your project "Arena PLM Add-on"
3. Close the Apps Script tab

## Step 3: First Run (3 min)

1. **Refresh** your Google Sheet
2. You'll see a new menu **Arena PLM** appear (may take 10-20 seconds)
3. Click **Arena PLM** → **Configuration** → **Configure Login**
4. Enter your Arena credentials:
   ```
   Arena API URL: https://api.arenasolutions.com/v1
   Username: your.email@company.com
   Password: your-password
   ```
5. Click **Save Credentials**

## Step 4: Try It Out!

1. Click **Arena PLM** → **Show Item Browser**
2. A sidebar appears on the right
3. Browse categories or search for items
4. Click an item to select it
5. Click any cell in your sheet
6. Click the **+** button to insert the item

**That's it!** You're ready to start planning your datacenter.

## Next Steps

- Configure which attributes appear next to items: **Arena PLM** → **Configuration** → **Configure Item Columns**
- Set up category colors: **Arena PLM** → **Configuration** → **Configure Category Colors**
- Define your BOM hierarchy: **Arena PLM** → **Configuration** → **Configure BOM Hierarchy**

## Common First-Time Issues

### Authorization Required
When you first run the add-on, Google will ask for permissions:
1. Click **Review Permissions**
2. Choose your Google account
3. Click **Advanced** → **Go to Arena PLM Add-on (unsafe)**
4. Click **Allow**

This is normal - Google shows this for all custom scripts.

### Menu Doesn't Appear
- Wait 10-20 seconds and refresh the sheet
- Close and reopen the sheet
- Make sure you saved all files in Apps Script
- Check Apps Script for any syntax errors (red underlines)

### "Arena credentials not configured"
- You need to configure your login first
- Go to **Arena PLM** → **Configuration** → **Configure Login**

## Video Tutorial

(Coming soon)

## Need Help?

Check the full [README.md](README.md) for detailed documentation.
