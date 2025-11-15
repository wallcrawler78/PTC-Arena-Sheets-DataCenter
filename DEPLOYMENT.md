# Deployment Guide

## Deploying to Google Sheets

Follow these steps to deploy the PTC Arena Sheets Data Center add-on to your Google Sheets document.

### Step 1: Open Your Google Sheet

1. Open the Google Sheet where you want to use this add-on
2. The sheet should be the one with tabs: Legend-NET, Overhead, Full Rack Item A, etc.
3. Direct link to your sheet: https://docs.google.com/spreadsheets/d/13COnLtr9j-2ECqkITVLPh3Z0UKDwi7UArqcw1LDQV0s/edit

### Step 2: Open Apps Script Editor

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. This will open the Apps Script editor in a new tab

### Step 3: Delete Default Code

1. You'll see a default `Code.gs` file with some placeholder code
2. Delete all the content in this file

### Step 4: Add All Script Files

You need to add each `.gs` file from this project. For each file:

1. Click the **+** button next to "Files" in the left sidebar
2. Select **Script** to create a new script file
3. Name it exactly as shown below (without the `.gs` extension)
4. Copy the entire content from the corresponding file in this project
5. Paste it into the Apps Script editor

**Files to add (in this order):**

1. **Authorization.gs** - Copy content from `Authorization.gs`
2. **Config.gs** - Copy content from `Config.gs`
3. **FormattingUtils.gs** - Copy content from `FormattingUtils.gs`
4. **SheetManager.gs** - Copy content from `SheetManager.gs`
5. **DataMapper.gs** - Copy content from `DataMapper.gs`
6. **RackPopulator.gs** - Copy content from `RackPopulator.gs`
7. **OverheadManager.gs** - Copy content from `OverheadManager.gs`
8. **LegendManager.gs** - Copy content from `LegendManager.gs`
9. **ArenaAPI.gs** - Copy content from `ArenaAPI.gs`
10. **Code.gs** - Replace the existing Code.gs content with content from `Code.gs`

### Step 5: Add HTML File

1. Click the **+** button next to "Files"
2. Select **HTML** to create a new HTML file
3. Name it **LoginWizard**
4. Copy the entire content from `LoginWizard.html`
5. Paste it into the HTML file

### Step 6: Save the Project

1. Click the disk icon (💾) or press **Ctrl+S** (Cmd+S on Mac) to save
2. Give your project a name like "Arena Data Center Integration"

### Step 7: Set Up Permissions

1. Close the Apps Script editor tab
2. Refresh your Google Sheet
3. You should now see a new menu: **Arena Data Center**
4. The first time you click any menu item, Google will ask for permissions:
   - Click **Continue**
   - Select your Google account
   - Click **Advanced** → **Go to [Your Project Name] (unsafe)**
   - Click **Allow**

### Step 8: Configure Arena Connection

1. Click **Arena Data Center** → **Configure Arena Connection**
2. Fill in your Arena API details:
   - **API Endpoint**: Your Arena API URL (e.g., `https://api.arenasolutions.com`)
   - **Workspace ID**: Your Arena workspace identifier
   - **API Key**: Your Arena API key
3. Click **Save & Test Connection**
4. If successful, the dialog will close automatically

### Step 9: Import Data

1. Click **Arena Data Center** → **Import Data**
2. Confirm you want to proceed
3. The add-on will:
   - Fetch all items from Arena
   - Populate rack tabs
   - Generate the overhead layout
   - Create the Legend-NET summary
4. Wait for the completion message

## Troubleshooting

### "Script function not found" error

- Make sure all `.gs` files are added to the project
- Check that file names match exactly (case-sensitive)
- Save the project and reload the spreadsheet

### "Not Configured" message

- Make sure you've configured Arena credentials via the menu
- Click **Arena Data Center** → **Configure Arena Connection**

### API Connection Fails

- Verify your Arena API endpoint URL is correct
- Check that your API key is valid and not expired
- Ensure your workspace ID is correct
- Try clicking **Arena Data Center** → **Test Connection**

### Import Fails or No Data

- Check the Apps Script logs:
  1. Open **Extensions** → **Apps Script**
  2. Click **Execution log** at the bottom
  3. Look for error messages
- Verify that your Arena workspace contains items
- Check that items have the required fields (number, name, etc.)

### Customizing Categories

If items aren't being categorized correctly:

1. Open the Apps Script editor
2. Open **Config.gs**
3. Edit the `RACK_TYPE_KEYWORDS` and `CATEGORY_KEYWORDS` objects
4. Add keywords that match your Arena item names/categories
5. Save and re-import data

## Updating the Code

To update the add-on code later:

1. Open **Extensions** → **Apps Script**
2. Find the file you want to update
3. Replace its content with the new version
4. Save the project
5. Reload your Google Sheet

## Notes

- The add-on stores credentials in your user properties (encrypted by Google)
- Only you can access these credentials
- Data is populated directly in your sheet - nothing is stored externally
- You can re-import data at any time to refresh the sheets

## Support

For issues or questions:
- Check the README.md for feature documentation
- Review the code comments for technical details
- Verify Arena API documentation for endpoint details
