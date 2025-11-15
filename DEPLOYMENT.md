# Deployment Guide

Multiple ways to deploy the Arena PLM add-on to Google Sheets.

## Method 1: Manual Deployment (Easiest)

See [QUICKSTART.md](QUICKSTART.md) for step-by-step instructions.

**Pros:** No additional tools needed, beginner-friendly
**Cons:** Manual copy/paste, harder to version control

## Method 2: Using clasp (Recommended for Developers)

[clasp](https://github.com/google/clasp) is the official command-line tool for Apps Script.

### Prerequisites

- Node.js installed (v12 or higher)
- A Google account
- Access to Arena PLM

### Setup

1. **Install clasp globally**
   ```bash
   npm install -g @google/clasp
   ```

2. **Enable Apps Script API**
   - Go to [script.google.com/home/usersettings](https://script.google.com/home/usersettings)
   - Turn on "Google Apps Script API"

3. **Login to clasp**
   ```bash
   clasp login
   ```
   This will open a browser for Google authentication.

### Deploy to New Spreadsheet

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd PTC-Arena-Sheets-DataCenter
   ```

2. **Create a new Apps Script project**
   ```bash
   clasp create --type sheets --title "Arena PLM Add-on"
   ```
   This creates a new Google Sheet with the script attached.

3. **Push the code**
   ```bash
   clasp push
   ```

4. **Open your sheet**
   ```bash
   clasp open --webapp
   ```

### Deploy to Existing Spreadsheet

1. **Get the Script ID from your spreadsheet**
   - Open your Google Sheet
   - Go to **Extensions** → **Apps Script**
   - Click **Project Settings** (gear icon)
   - Copy the **Script ID**

2. **Create .clasp.json**
   ```bash
   echo '{"scriptId":"YOUR_SCRIPT_ID_HERE"}' > .clasp.json
   ```
   Replace `YOUR_SCRIPT_ID_HERE` with your actual Script ID.

3. **Push the code**
   ```bash
   clasp push
   ```

### Development Workflow with clasp

```bash
# Make changes to your code locally

# Push changes to Apps Script
clasp push

# Pull changes from Apps Script (if edited in browser)
clasp pull

# View logs
clasp logs

# Open the script in browser
clasp open
```

## Method 3: As a Google Workspace Add-on (Enterprise)

For organization-wide deployment.

### Prerequisites

- Google Workspace account (not personal Gmail)
- Admin access to Google Workspace
- Google Cloud Project

### Steps

1. **Create a Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project: "Arena PLM Add-on"

2. **Configure OAuth Consent Screen**
   - In Cloud Console, go to **APIs & Services** → **OAuth consent screen**
   - Choose **Internal** (for your organization only)
   - Fill in app information
   - Add scopes:
     - `https://www.googleapis.com/auth/spreadsheets.currentonly`
     - `https://www.googleapis.com/auth/script.external_request`

3. **Link Apps Script to Cloud Project**
   - Open your Apps Script project
   - Click **Project Settings** (gear icon)
   - Under "Google Cloud Platform (GCP) Project", click **Change project**
   - Enter your Cloud Project number
   - Click **Set project**

4. **Publish as Add-on**
   - In Apps Script, click **Deploy** → **New deployment**
   - Select type: **Add-on**
   - Configure:
     - Version: "New version"
     - Description: "Arena PLM integration for datacenter planning"
   - Click **Deploy**

5. **Submit for Google Workspace Marketplace**
   - Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   - Configure store listing
   - Submit for review (takes 2-3 weeks)

6. **Install Organization-Wide**
   - Once approved, admins can install from Workspace Marketplace
   - Or use pre-release deployment for testing

## File Structure

```
PTC-Arena-Sheets-DataCenter/
├── Code.gs                      # Main entry point
├── Config.gs                    # Configuration management
├── ArenaAPI.gs                  # Arena PLM API integration
├── BOM.gs                       # BOM operations
├── Sidebar.html                 # Item browser UI
├── LoginConfig.html             # Login configuration dialog
├── ItemColumnsConfig.html       # Column configuration dialog
├── CategoryColorsConfig.html    # Color configuration dialog
├── BOMHierarchyConfig.html      # Hierarchy configuration dialog
├── appsscript.json              # Apps Script manifest
├── README.md                    # Full documentation
├── QUICKSTART.md               # Quick start guide
└── DEPLOYMENT.md               # This file
```

## Environment Variables

The add-on stores credentials in **Script Properties** (not code). This keeps them secure and separate from version control.

To set manually:
1. Open Apps Script editor
2. Click **Project Settings** (gear icon)
3. Click **Script Properties**
4. Add properties:
   - `ARENA_USERNAME`
   - `ARENA_PASSWORD`
   - `ARENA_API_URL`

Or use the UI: **Arena PLM** → **Configuration** → **Configure Login**

## Security Considerations

### For Individual Use
- Credentials are stored in Script Properties (not visible in code)
- Only you can access your script properties
- Use a strong Arena PLM password
- Enable 2FA on your Google account

### For Organization Deployment
- Consider using a service account for Arena API access
- Implement OAuth flow instead of password storage
- Use Google Secret Manager for credentials
- Set up audit logging
- Require approved scopes only

### API Security
- The add-on makes external requests to Arena PLM
- All requests use HTTPS
- Credentials are sent via Basic Authentication
- Consider implementing token-based auth for production

## Testing

Before deploying to production:

1. **Test all configuration dialogs**
   - Login configuration
   - Item columns
   - Category colors
   - BOM hierarchy

2. **Test item browser**
   - Category filtering
   - Lifecycle filtering
   - Search functionality
   - Item insertion

3. **Test BOM operations**
   - Build BOM levels
   - Push BOM to Arena (use test data)
   - Pull BOM from Arena

4. **Test error handling**
   - Invalid credentials
   - Network failures
   - Invalid item numbers

## Troubleshooting Deployment

### clasp push fails
- Make sure you're logged in: `clasp login`
- Check `.clasp.json` exists with valid scriptId
- Try `clasp push --force`

### Authorization errors
- Check OAuth scopes in `appsscript.json`
- Re-authorize: `clasp login --creds <creds.json>`

### Script not appearing in Sheet
- Wait 10-20 seconds and refresh
- Check for syntax errors in Apps Script editor
- Verify `onOpen()` function exists in Code.gs

### Cannot connect to Arena
- Verify credentials in Script Properties
- Test API URL in browser
- Check firewall/proxy settings
- Verify Arena API is enabled for your account

## Version Control

Recommended `.gitignore`:
```
.clasp.json
.clasprc.json
node_modules/
*.log
```

Keep credentials out of version control!

## Support

- **Apps Script docs:** [developers.google.com/apps-script](https://developers.google.com/apps-script)
- **clasp docs:** [github.com/google/clasp](https://github.com/google/clasp)
- **Arena PLM API:** [arenasolutions.com/developers](https://www.arenasolutions.com/developers)

## Updates

To update an existing deployment:

### Manual method:
1. Copy new code from repository
2. Paste into Apps Script editor
3. Save

### clasp method:
```bash
git pull
clasp push
```

Users will see updates immediately (no need to reinstall).
