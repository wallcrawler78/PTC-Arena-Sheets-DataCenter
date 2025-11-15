# Developer Setup Guide

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

```bash
npm install -g @google/clasp
```

### 3. Enable Apps Script API

1. Go to https://script.google.com/home/usersettings
2. Enable "Google Apps Script API"

### 4. Login to Clasp

```bash
clasp login
```

This will open a browser window for Google authentication.

### 5. Create a New Apps Script Project (or link existing)

**Option A: Create New Project**
```bash
clasp create --title "Arena Data Center" --type sheets
```

This creates a new Google Sheets file with an Apps Script project attached.

**Option B: Link to Existing Spreadsheet**
```bash
clasp clone <SCRIPT_ID>
```

Find the Script ID in your existing spreadsheet:
- Extensions → Apps Script
- Project Settings → Script ID

### 6. Push Code to Apps Script

```bash
clasp push
```

This uploads all `.gs` and `.html` files to your Apps Script project.

### 7. Open in Apps Script Editor

```bash
clasp open
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

**Issue: Quota exceeded**
- Solution: Apps Script has daily quotas
- Check: https://developers.google.com/apps-script/guides/services/quotas
- Wait for quota reset (midnight Pacific time)

**Issue: Session expired**
- Solution: Should auto-re-login (check `makeRequest` in ArenaAPI.gs)
- If not working, clear credentials and re-login

**Issue: Changes not reflecting**
- Solution: Hard refresh spreadsheet (Ctrl+Shift+R / Cmd+Shift+R)
- Clear Apps Script cache (rare)

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
