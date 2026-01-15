# Developer Setup Guide

## Quick Reference - Common Clasp Commands

For developers who are already set up:

```bash
# Push local code to Apps Script
clasp push

# Push and watch for changes (auto-push on save)
clasp push --watch

# Pull code from Apps Script to local
clasp pull

# Open Apps Script editor in browser
clasp open

# Check what files will be pushed
clasp status

# Check login status
clasp login --status

# View project info
clasp setting

# Create new version
clasp version "Description of changes"

# List all versions
clasp versions
```

**Full setup instructions below** ⬇️

---

## Prerequisites

### Required Software
- **Node.js** (v14 or higher) - For Clasp CLI
- **npm** (comes with Node.js)
- **Git** - For version control
- **Text Editor** - VS Code recommended (has Apps Script extension)

### Required Accounts
- **Google Account** - For Google Sheets and Apps Script
- **PTC Arena Account** - For testing API integration
- **GitHub Account** - For code repository access (optional)

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/wallcrawler78/PTC-Arena-Sheets-DataCenter.git
cd PTC-Arena-Sheets-DataCenter
```

### 2. Install Clasp (Google Apps Script CLI)

Clasp is the command-line tool for managing Apps Script projects locally.

```bash
npm install -g @google/clasp
```

**Verify installation:**
```bash
clasp --version
```

### 3. Enable Apps Script API

Before using clasp, you must enable the Apps Script API:

1. Go to https://script.google.com/home/usersettings
2. Toggle "Google Apps Script API" to **ON**
3. You should see "Google Apps Script API is enabled"

### 4. Login to Clasp

Authenticate clasp with your Google account:

```bash
clasp login
```

**What happens:**
- Opens browser window for Google OAuth
- Grants clasp permission to manage your Apps Script projects
- Stores credentials in `~/.clasprc.json`

**Verify login:**
```bash
clasp login --status
```

Should show: "You are logged in."

### 5. Clone the Project from Existing Spreadsheet

If you already have a Google Sheet with the Arena PLM Integration installed, you can clone it to work locally.

**Step 5.1: Find the Script ID**

1. Open your Google Sheet
2. Click **Extensions → Apps Script**
3. In Apps Script editor, click **Project Settings** (gear icon)
4. Copy the **Script ID** (looks like: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0`)

**Step 5.2: Clone the Project**

```bash
cd /path/to/your/projects
git clone https://github.com/wallcrawler78/PTC-Arena-Sheets-DataCenter.git
cd PTC-Arena-Sheets-DataCenter

# Clone the Apps Script project
clasp clone YOUR_SCRIPT_ID_HERE
```

**What this does:**
- Downloads all `.gs` and `.html` files from Apps Script
- Creates `.clasp.json` file with project configuration
- Links your local folder to the Apps Script project

**Important:** The `.clasp.json` file is in `.gitignore` because it contains your specific Script ID.

### 6. Link to a Different Spreadsheet (Alternative Setup)

If you want to deploy this code to a **new** or **different** spreadsheet:

**Step 6.1: Create New Google Sheet**

1. Go to https://sheets.google.com
2. Create a new blank spreadsheet
3. Name it (e.g., "Arena PLM Integration - Dev")

**Step 6.2: Get the Script ID**

1. In the new sheet, click **Extensions → Apps Script**
2. Apps Script editor opens (empty project)
3. Click **Project Settings** (gear icon)
4. Copy the **Script ID**

**Step 6.3: Update .clasp.json**

Create or edit `.clasp.json` in your project root:

```json
{
  "scriptId": "YOUR_NEW_SCRIPT_ID_HERE",
  "rootDir": "."
}
```

**Or use clasp command:**
```bash
# This overwrites .clasp.json
echo '{"scriptId":"YOUR_SCRIPT_ID_HERE","rootDir":"."}' > .clasp.json
```

### 7. Push Code to Apps Script

Upload your local code to the Apps Script project:

```bash
clasp push
```

**What happens:**
- Uploads all `.gs` files (server-side JavaScript)
- Uploads all `.html` files (dialogs and sidebars)
- Uploads `appsscript.json` (project manifest)
- Overwrites existing code in Apps Script

**Check what will be pushed:**
```bash
clasp status
```

**Push specific files only:**
```bash
clasp push --watch
```

This watches for file changes and auto-pushes (useful during development).

### 8. Verify the Deployment

**Step 8.1: Open Apps Script Editor**
```bash
clasp open
```

This opens the Apps Script editor in your browser.

**Step 8.2: Verify Files**

In the Apps Script editor, you should see all files:
- Code.gs
- ArenaAPI.gs
- Authorization.gs
- TypeSystemConfig.gs
- All `.html` files
- etc.

**Step 8.3: Test in Spreadsheet**

1. Go back to your Google Sheet (refresh if it was already open)
2. You should see the **"Arena"** menu in the menu bar
3. If the menu doesn't appear:
   - Close and reopen the spreadsheet
   - Or manually run `onOpen()` from Apps Script editor

### 9. Set Up Multiple Environments

It's recommended to have separate environments for development and production.

**Development Setup:**

Create `.clasp.dev.json`:
```json
{
  "scriptId": "YOUR_DEV_SCRIPT_ID",
  "rootDir": "."
}
```

**Production Setup:**

Create `.clasp.prod.json`:
```json
{
  "scriptId": "YOUR_PROD_SCRIPT_ID",
  "rootDir": "."
}
```

**Switch between environments:**

```bash
# Push to dev
cp .clasp.dev.json .clasp.json
clasp push

# Push to prod
cp .clasp.prod.json .clasp.json
clasp push
```

**Or use a helper script** (add to `package.json`):

```json
{
  "scripts": {
    "push:dev": "cp .clasp.dev.json .clasp.json && clasp push",
    "push:prod": "cp .clasp.prod.json .clasp.json && clasp push"
  }
}
```

Then run:
```bash
npm run push:dev
npm run push:prod
```

### 10. Pull Code from Apps Script (Optional)

If someone made changes directly in the Apps Script editor, pull them to your local machine:

```bash
clasp pull
```

**Warning:** This **overwrites** your local files! Commit your local changes first.

**Safe workflow:**
```bash
# Commit local changes first
git add -A
git commit -m "Local changes before pull"

# Pull from Apps Script
clasp pull

# Review changes
git diff

# If good, commit
git commit -m "Pulled latest from Apps Script"
```

## Development Workflow

### Making Changes

1. **Edit files locally** in your preferred text editor
2. **Test locally** if possible (limited options for Apps Script)
3. **Push to Apps Script**:
   ```bash
   clasp push
   ```
4. **Test in spreadsheet** - Open the spreadsheet and test functionality
5. **Check logs** - Apps Script editor → Executions → View logs
6. **Commit changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

### File Types

**Server-side (`.gs` files):**
- Execute on Google's servers
- JavaScript with Apps Script APIs
- Cannot use Node.js modules
- Can access Google services (Sheets, etc.)

**Client-side (`.html` files):**
- Run in browser (within iframe)
- HTML, CSS, JavaScript
- Use `google.script.run` to call server-side functions

### Development Tips

**1. Use Logger for Debugging:**
```javascript
Logger.log('Debug info: ' + JSON.stringify(data));
```

View logs: Apps Script editor → Executions → Select execution → View logs

**2. Test Functions Independently:**
Create test functions:
```javascript
function testMyFunction() {
  var result = myFunction(testData);
  Logger.log('Result: ' + JSON.stringify(result));
}
```

Run from Apps Script editor: Select function → Run

**3. Use Try-Catch for Error Handling:**
```javascript
function myFunction() {
  try {
    // Your code
  } catch (error) {
    Logger.log('Error: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    throw error; // Re-throw for user to see
  }
}
```

**4. Enable V8 Runtime:**
In `appsscript.json`:
```json
{
  "runtimeVersion": "V8"
}
```

Benefits: Modern JavaScript features (const, let, arrow functions, etc.)

## Project Structure

```
PTC-Arena-Sheets-DataCenter/
├── Code.gs                    # Main entry point
├── ArenaAPI.gs               # Arena API client
├── Authorization.gs          # Auth & session management
├── BOMBuilder.gs            # BOM operations
├── RackConfigManager.gs     # Rack management
├── LayoutManager.gs         # Layout management
├── CategoryManager.gs       # Category operations
├── Config.gs                # Configuration
├── *.html                   # UI components
├── appsscript.json          # Project manifest
├── .clasp.json              # Clasp configuration (gitignored)
├── docs/                    # Documentation
│   ├── TECHNICAL_OVERVIEW.md
│   ├── ARENA_API_GUIDE.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPER_GUIDE.md
│   └── LESSONS_LEARNED.md
├── README.md                # Project README
└── .gitignore              # Git ignore file
```

## Environment Setup

### Development Spreadsheet

Create a test spreadsheet for development:

1. Create new Google Sheet
2. Extensions → Apps Script
3. Link your project with `clasp clone`
4. Configure Arena connection (test credentials)
5. Test features without affecting production data

### Test Arena Workspace

Recommended: Use a separate Arena workspace for testing:
- Separate test data
- Safe to experiment
- Won't affect production
- Can reset/clear as needed

## Common Development Tasks

### Adding a New Menu Item

**1. Add menu item in `Code.gs`:**
```javascript
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Arena Data Center')
    .addItem('New Feature', 'newFeatureFunction')
    .addToUi();
}
```

**2. Implement function:**
```javascript
function newFeatureFunction() {
  var ui = SpreadsheetApp.getUi();

  try {
    // Your logic here
    var result = doSomething();

    ui.alert('Success', result.message, ui.ButtonSet.OK);
  } catch (error) {
    Logger.log('Error: ' + error.message);
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}
```

**3. Test:**
```bash
clasp push
# Refresh spreadsheet
# Click menu item
```

### Adding a New Arena API Endpoint

**1. Add method to `ArenaAPI.gs`:**
```javascript
ArenaAPIClient.prototype.newEndpoint = function(params) {
  var endpoint = '/path/to/endpoint';

  return this.makeRequest(endpoint, {
    method: 'GET', // or POST, PUT, DELETE
    payload: params // if needed
  });
};
```

**2. Use in business logic:**
```javascript
function useNewEndpoint() {
  var client = new ArenaAPIClient();
  var result = client.newEndpoint({ param: 'value' });
  return result;
}
```

**3. Test:**
```javascript
function testNewEndpoint() {
  try {
    var result = useNewEndpoint();
    Logger.log('Success: ' + JSON.stringify(result));
  } catch (error) {
    Logger.log('Error: ' + error.message);
  }
}
```

### Creating a New Dialog

**1. Create HTML file (e.g., `NewDialog.html`):**
```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    /* Your styles */
  </style>
</head>
<body>
  <h2>New Dialog</h2>
  <!-- Your UI -->

  <script>
    function submitForm() {
      var data = { /* gather form data */ };

      google.script.run
        .withSuccessHandler(function(result) {
          // Handle success
        })
        .withFailureHandler(function(error) {
          alert('Error: ' + error);
        })
        .serverSideFunction(data);
    }
  </script>
</body>
</html>
```

**2. Add show function in `Code.gs`:**
```javascript
function showNewDialog() {
  var html = HtmlService.createHtmlOutputFromFile('NewDialog')
    .setWidth(600)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dialog Title');
}
```

**3. Add server-side handler:**
```javascript
function serverSideFunction(data) {
  // Process data
  return { success: true, message: 'Done!' };
}
```

### Adding a New Configuration Option

**1. Add storage functions in `Config.gs`:**
```javascript
function getNewConfig() {
  var props = PropertiesService.getUserProperties();
  var config = props.getProperty('new_config');

  if (config) {
    return JSON.parse(config);
  } else {
    return getDefaultNewConfig();
  }
}

function setNewConfig(config) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('new_config', JSON.stringify(config));
}

function getDefaultNewConfig() {
  return {
    option1: true,
    option2: 'default value'
  };
}
```

**2. Use in code:**
```javascript
function useConfig() {
  var config = getNewConfig();

  if (config.option1) {
    // Do something
  }
}
```

## Debugging

### Viewing Logs

**Apps Script Editor:**
1. Open Apps Script editor (`clasp open`)
2. Click "Executions" in left sidebar
3. Click on an execution to see logs

**In Code:**
```javascript
Logger.log('Simple log');
Logger.log('Object: ' + JSON.stringify(obj));
Logger.log('Error: ' + error.message);
Logger.log('Stack: ' + error.stack);
```

### Debugging Client-Side Code

**Browser DevTools:**
1. Open dialog/sidebar in spreadsheet
2. Right-click → Inspect
3. Use Console, Network, etc.

**Client-Side Logging:**
```javascript
console.log('Client log'); // Shows in browser console
```

### Common Issues

**Issue: Function not found**
- Solution: Run `clasp push` again
- Make sure function name matches exactly
- Verify file was uploaded in Apps Script editor

**Issue: Quota exceeded**
- Solution: Apps Script has daily quotas
- Check: https://developers.google.com/apps-script/guides/services/quotas
- Wait for quota reset (midnight Pacific time)

**Issue: Session expired**
- Solution: Should auto-re-login (check `makeRequest` in ArenaAPI.gs)
- If not working, clear credentials and re-login

**Issue: Changes not reflecting**
- Solution: Hard refresh spreadsheet (Ctrl+Shift+R / Cmd+Shift+R)
- Run `clasp push` again to ensure code was uploaded
- Clear Apps Script cache (rare)

### Clasp-Specific Issues

**Issue: `clasp: command not found`**
```bash
# Solution: Install clasp globally
npm install -g @google/clasp

# Verify installation
clasp --version
```

**Issue: `User has not enabled the Apps Script API`**
```bash
# Solution: Enable the API
# 1. Go to https://script.google.com/home/usersettings
# 2. Toggle "Google Apps Script API" ON
# 3. Try clasp command again
```

**Issue: `No credentials. Run clasp login`**
```bash
# Solution: Login to clasp
clasp login

# If that fails, try logout first
clasp logout
clasp login
```

**Issue: `Script ID not found` or `Permission denied`**
```bash
# Solution 1: Verify Script ID is correct
# Open spreadsheet → Extensions → Apps Script → Project Settings → Script ID

# Solution 2: Check .clasp.json file
cat .clasp.json
# Should contain: {"scriptId":"YOUR_SCRIPT_ID","rootDir":"."}

# Solution 3: Make sure you're logged in with correct Google account
clasp login --status
```

**Issue: `clasp push` fails with "Invalid project ID"**
```bash
# Solution: Script ID changed or .clasp.json is wrong
# 1. Delete .clasp.json
rm .clasp.json

# 2. Clone again with correct Script ID
clasp clone YOUR_CORRECT_SCRIPT_ID
```

**Issue: `clasp push` pushes wrong files**
```bash
# Solution: Check what will be pushed
clasp status

# Add .claspignore file to exclude files
echo "node_modules/**" > .claspignore
echo "docs/**" >> .claspignore
echo ".git/**" >> .claspignore
```

**Issue: Multiple clasp installations causing conflicts**
```bash
# Solution: Uninstall and reinstall
npm uninstall -g @google/clasp
npm cache clean --force
npm install -g @google/clasp
```

**Issue: `clasp pull` overwrites my local changes**
```bash
# Solution: Always commit before pulling
git add -A
git commit -m "Before pull"
clasp pull

# If you already pulled and lost changes, use git reflog
git reflog
git checkout HEAD@{1} -- filename.gs
```

**Issue: Files not showing in Apps Script editor after push**
```bash
# Solution 1: Wait a moment and refresh
# Apps Script can take 5-10 seconds to process

# Solution 2: Check file names
# .gs files must end in .gs
# .html files must end in .html
# No spaces in filenames

# Solution 3: Check .claspignore
cat .claspignore
# Make sure your files aren't being ignored
```

**Issue: `clasp open` opens wrong project**
```bash
# Solution: Check .clasp.json
cat .clasp.json

# Update if wrong
echo '{"scriptId":"CORRECT_SCRIPT_ID","rootDir":"."}' > .clasp.json

# Then try again
clasp open
```

## Testing

### Manual Testing Checklist

Before committing changes:

- [ ] Test in development spreadsheet
- [ ] Test with different user permissions
- [ ] Test error scenarios
- [ ] Check Apps Script logs for errors
- [ ] Test UI components in different browsers
- [ ] Verify Arena API calls work
- [ ] Check performance (no excessive API calls)

### Test Data

Create test data in spreadsheet:
- Sample racks with known BOMs
- Test overview with 2-3 rows
- Test categories and colors

### Integration Testing

Test complete workflows:
1. Create rack from Arena
2. Build overview with racks
3. Generate consolidated BOM
4. Push to Arena
5. Verify in Arena

## Code Style Guidelines

### JavaScript (`.gs` files)

**Naming Conventions:**
```javascript
// Functions: camelCase
function getUserData() { }

// Variables: camelCase
var itemNumber = 'ITEM-001';

// Constants: UPPER_SNAKE_CASE (or camelCase)
var MAX_ITEMS = 400;

// Classes: PascalCase
function ArenaAPIClient() { }
```

**Comments:**
```javascript
/**
 * Function description
 * @param {string} itemNumber - The item number
 * @return {Object} The item data
 */
function getItem(itemNumber) {
  // Implementation
}
```

**Error Handling:**
```javascript
// Always use try-catch for operations that can fail
try {
  var result = riskyOperation();
  return { success: true, data: result };
} catch (error) {
  Logger.log('Error in functionName: ' + error.message);
  return { success: false, error: error.message };
}
```

### HTML Files

**Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    /* Styles here */
  </style>
</head>
<body>
  <!-- Content -->

  <script>
    // Client-side JavaScript
  </script>
</body>
</html>
```

**Naming:**
- Use descriptive names: `ItemPicker.html`, not `picker.html`
- Match functionality: `ConfigureColors.html`

## Performance Best Practices

### Spreadsheet Operations

**❌ Bad:**
```javascript
for (var i = 0; i < 100; i++) {
  sheet.getRange(i, 1).setValue(data[i]); // 100 write operations!
}
```

**✅ Good:**
```javascript
var values = data.map(function(item) { return [item]; });
sheet.getRange(1, 1, values.length, 1).setValues(values); // 1 write operation!
```

### API Calls

**❌ Bad:**
```javascript
items.forEach(function(itemNumber) {
  var item = client.getItemByNumber(itemNumber); // N API calls
});
```

**✅ Good:**
```javascript
var allItems = client.getAllItems(); // 1-3 API calls
var itemMap = {};
allItems.forEach(function(item) {
  itemMap[item.number] = item;
});
```

### Caching

Use caching for data that doesn't change frequently:
```javascript
var cache = CacheService.getUserCache();
var cached = cache.get('key');

if (cached) {
  return JSON.parse(cached);
}

var data = fetchData();
cache.put('key', JSON.stringify(data), 3600); // 1 hour
return data;
```

## Deployment

### Staging Environment

1. Create staging spreadsheet
2. Link to same Apps Script project
3. Test changes in staging
4. Deploy to production

### Production Deployment

1. Test thoroughly in staging
2. Commit changes to Git
3. Push to Apps Script: `clasp push`
4. Verify in production spreadsheet
5. Monitor for errors (check Executions)

### Rollback

If issues occur:
1. Revert Git commit: `git revert HEAD`
2. Push reverted code: `clasp push`
3. Or restore from Apps Script version history

## Security

### Never Commit Secrets

In `.gitignore`:
```
.clasp.json
credentials.json
*.secret.js
```

### Credential Handling

```javascript
// ✅ Good - stored securely
PropertiesService.getUserProperties().setProperty('api_key', key);

// ❌ Bad - in code
var apiKey = 'hardcoded-key'; // NEVER DO THIS
```

### Input Validation

Always validate user input:
```javascript
function processInput(userInput) {
  // Validate
  if (!userInput || typeof userInput !== 'string') {
    throw new Error('Invalid input');
  }

  if (userInput.length > 1000) {
    throw new Error('Input too long');
  }

  // Sanitize
  var sanitized = userInput.trim();

  // Process
  return doSomething(sanitized);
}
```

## Getting Help

### Resources

- **Apps Script Documentation**: https://developers.google.com/apps-script
- **Apps Script Reference**: https://developers.google.com/apps-script/reference
- **Stack Overflow**: Tag `google-apps-script`
- **Clasp Documentation**: https://github.com/google/clasp

### Project Documentation

- [Technical Overview](./TECHNICAL_OVERVIEW.md)
- [Arena API Guide](./ARENA_API_GUIDE.md)
- [Architecture](./ARCHITECTURE.md)
- [Lessons Learned](./LESSONS_LEARNED.md)

### Troubleshooting

1. Check Apps Script execution logs
2. Review error messages
3. Check quota limits
4. Test with simplified data
5. Enable detailed logging

## Next Steps

1. Read [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) for system overview
2. Read [ARENA_API_GUIDE.md](./ARENA_API_GUIDE.md) for API details
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for code structure
4. Review [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) for common pitfalls
5. Set up development environment
6. Test existing features
7. Make small change and deploy
8. Build new features!

Happy coding! 🚀
