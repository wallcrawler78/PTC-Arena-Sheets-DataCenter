# Deployment Guide - Arena PLM Integration

This guide covers deploying the Arena PLM Integration to Google Sheets using clasp (Command Line Apps Script).

## Table of Contents

- [Prerequisites](#prerequisites)
- [First-Time Setup](#first-time-setup)
- [Daily Development Workflow](#daily-development-workflow)
- [Deploying to Production](#deploying-to-production)
- [Multiple Environments](#multiple-environments)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (v14+) installed - [Download](https://nodejs.org/)
- **Git** installed - [Download](https://git-scm.com/)
- **Google Account** with access to Google Sheets
- **Script ID** from your target Google Sheet

---

## First-Time Setup

### Step 1: Install Clasp

```bash
npm install -g @google/clasp
clasp --version
```

### Step 2: Enable Apps Script API

1. Go to https://script.google.com/home/usersettings
2. Toggle **"Google Apps Script API"** to **ON**

### Step 3: Login to Clasp

```bash
clasp login
```

This opens a browser for Google OAuth authentication.

### Step 4: Clone the Repository

```bash
git clone https://github.com/wallcrawler78/PTC-Arena-Sheets-DataCenter.git
cd PTC-Arena-Sheets-DataCenter
```

### Step 5: Get Your Script ID

**Option A: Existing Spreadsheet**

1. Open your Google Sheet
2. **Extensions → Apps Script**
3. **Project Settings** (gear icon) → Copy **Script ID**

**Option B: New Spreadsheet**

1. Create new Google Sheet at https://sheets.google.com
2. Name it (e.g., "Arena PLM Integration - Dev")
3. **Extensions → Apps Script**
4. **Project Settings** → Copy **Script ID**

### Step 6: Configure Clasp

Create `.clasp.json` in the project root:

```bash
echo '{"scriptId":"YOUR_SCRIPT_ID_HERE","rootDir":"."}' > .clasp.json
```

Replace `YOUR_SCRIPT_ID_HERE` with your actual Script ID.

### Step 7: Push Code to Apps Script

```bash
clasp push
```

You should see:
```
Pushed 43 files.
└─ appsscript.json
└─ Code.gs
└─ ArenaAPI.gs
...
```

### Step 8: Verify Deployment

```bash
# Open Apps Script editor
clasp open
```

In the Apps Script editor, verify all files are present.

### Step 9: Test in Spreadsheet

1. Open your Google Sheet (refresh if already open)
2. Look for **"Arena"** menu in the menu bar
3. If menu doesn't appear:
   - Close and reopen the spreadsheet
   - Or run `onOpen()` manually from Apps Script editor

### Step 10: Run Setup Wizard

1. In the spreadsheet, click **Arena → Setup → Run Setup Wizard**
2. Follow the wizard to configure your terminology and settings
3. Connect to Arena PLM with your credentials

**You're done!** 🎉

---

## Daily Development Workflow

### Making Changes

1. **Edit files locally** in your code editor

2. **Push changes to Apps Script**:
   ```bash
   clasp push
   ```

3. **Test in spreadsheet**:
   - Refresh the spreadsheet (Ctrl+Shift+R or Cmd+Shift+R)
   - Test your changes

4. **View logs** (if needed):
   ```bash
   clasp open
   # Then click "Executions" in Apps Script editor
   ```

5. **Commit to Git**:
   ```bash
   git add -A
   git commit -m "Description of changes"
   git push origin main
   ```

### Auto-Push on File Save

For active development, use watch mode:

```bash
clasp push --watch
```

This automatically pushes changes when you save files.

---

## Deploying to Production

### Recommended Workflow

1. **Test in Development**:
   ```bash
   # Ensure you're on dev environment
   cat .clasp.json  # Verify Script ID is dev

   # Push and test
   clasp push
   ```

2. **Commit Changes**:
   ```bash
   git add -A
   git commit -m "Feature: Add new functionality"
   git push origin main
   ```

3. **Switch to Production**:
   ```bash
   # Copy production config
   cp .clasp.prod.json .clasp.json

   # Or manually edit .clasp.json with prod Script ID
   ```

4. **Deploy to Production**:
   ```bash
   clasp push
   ```

5. **Verify Production**:
   - Open production spreadsheet
   - Test the new feature
   - Monitor for errors

6. **Create Version Tag** (optional):
   ```bash
   clasp version "v2.1.0 - Added Type System v2.0"
   ```

### Rollback if Needed

If something goes wrong:

```bash
# Revert Git commit
git revert HEAD

# Push reverted code
clasp push
```

Or restore from Apps Script version history:
1. Apps Script editor → File → Version history
2. Select previous version → Restore

---

## Multiple Environments

### Setup

Create separate config files:

**.clasp.dev.json** (Development):
```json
{
  "scriptId": "YOUR_DEV_SCRIPT_ID",
  "rootDir": "."
}
```

**.clasp.staging.json** (Staging):
```json
{
  "scriptId": "YOUR_STAGING_SCRIPT_ID",
  "rootDir": "."
}
```

**.clasp.prod.json** (Production):
```json
{
  "scriptId": "YOUR_PROD_SCRIPT_ID",
  "rootDir": "."
}
```

**Add to .gitignore**:
```bash
echo ".clasp.json" >> .gitignore
```

This prevents accidentally committing your specific Script IDs.

### Switching Environments

**Manual switching:**
```bash
# Deploy to dev
cp .clasp.dev.json .clasp.json
clasp push

# Deploy to staging
cp .clasp.staging.json .clasp.json
clasp push

# Deploy to prod
cp .clasp.prod.json .clasp.json
clasp push
```

**Using npm scripts** (recommended):

Add to `package.json`:
```json
{
  "name": "arena-plm-integration",
  "scripts": {
    "push:dev": "cp .clasp.dev.json .clasp.json && clasp push",
    "push:staging": "cp .clasp.staging.json .clasp.json && clasp push",
    "push:prod": "cp .clasp.prod.json .clasp.json && clasp push",
    "open:dev": "cp .clasp.dev.json .clasp.json && clasp open",
    "open:staging": "cp .clasp.staging.json .clasp.json && clasp open",
    "open:prod": "cp .clasp.prod.json .clasp.json && clasp open"
  }
}
```

Then deploy with:
```bash
npm run push:dev
npm run push:staging
npm run push:prod
```

### Environment Best Practices

- **Development**: Test all changes here first
- **Staging**: Test with production-like data
- **Production**: Only deploy tested, stable code

---

## Troubleshooting

### Common Issues and Solutions

#### `clasp: command not found`

```bash
# Reinstall clasp
npm install -g @google/clasp
clasp --version
```

#### `User has not enabled the Apps Script API`

1. Go to https://script.google.com/home/usersettings
2. Toggle "Google Apps Script API" **ON**
3. Try command again

#### `No credentials. Run clasp login`

```bash
clasp logout
clasp login
```

#### `Script ID not found` or `Permission denied`

1. Verify Script ID is correct:
   ```bash
   cat .clasp.json
   ```

2. Get Script ID from spreadsheet:
   - Extensions → Apps Script → Project Settings → Script ID

3. Update `.clasp.json`:
   ```bash
   echo '{"scriptId":"CORRECT_SCRIPT_ID","rootDir":"."}' > .clasp.json
   ```

#### Changes not reflecting in spreadsheet

1. Hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. Close and reopen the spreadsheet
3. Verify push was successful: `clasp status`
4. Check Apps Script editor: `clasp open`

#### Menu not appearing after deployment

1. Run `onOpen()` manually:
   - Apps Script editor → Select `onOpen` function → Run

2. Or close and reopen the spreadsheet

3. Check for errors in Executions log

#### Files not uploading

Check `.claspignore` file:
```bash
cat .claspignore
```

Make sure your files aren't being ignored. Common `.claspignore`:
```
node_modules/**
.git/**
docs/**
*.md
.DS_Store
```

#### Multiple people editing code

**Problem**: Someone edited in Apps Script editor, your local code is out of sync.

**Solution**:
```bash
# Commit your local changes first
git add -A
git commit -m "Local changes before pull"

# Pull from Apps Script
clasp pull

# Review changes
git diff

# Merge if needed
git add -A
git commit -m "Merged remote changes"
```

---

## Advanced Topics

### Excluding Files from Push

Create `.claspignore` file:

```
# Dependencies
node_modules/**

# Documentation
docs/**
*.md
README.md

# Git
.git/**
.gitignore

# IDE
.vscode/**
.idea/**

# OS
.DS_Store
Thumbs.db

# Environment configs
.clasp.*.json
```

### Creating Versions

```bash
# Create a version with description
clasp version "v2.1.0 - Type System v2.0"

# List all versions
clasp versions

# View specific version
clasp version 1
```

### Using TypeScript (Optional)

If you want to use TypeScript:

1. Install TypeScript:
   ```bash
   npm install -D @types/google-apps-script
   ```

2. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "lib": ["esnext"],
       "target": "ES2019"
     }
   }
   ```

3. Write `.ts` files (clasp auto-compiles to `.gs`)

4. Push as normal:
   ```bash
   clasp push
   ```

---

## Quick Checklist

### Before Every Push

- [ ] Test changes locally (if possible)
- [ ] Verify correct environment (.clasp.json)
- [ ] Check what will be pushed: `clasp status`
- [ ] Push: `clasp push`
- [ ] Verify in Apps Script editor: `clasp open`
- [ ] Test in spreadsheet
- [ ] Check logs for errors
- [ ] Commit to Git

### Before Production Deploy

- [ ] Tested in development
- [ ] Tested in staging (if applicable)
- [ ] Code reviewed
- [ ] Git committed and pushed
- [ ] Backup production data (if needed)
- [ ] Switch to prod config
- [ ] Deploy: `clasp push`
- [ ] Verify in production
- [ ] Monitor for errors
- [ ] Create version: `clasp version "vX.X.X - Description"`

---

## Resources

- **Clasp Documentation**: https://github.com/google/clasp
- **Apps Script API**: https://developers.google.com/apps-script/api
- **Apps Script Reference**: https://developers.google.com/apps-script/reference
- **Project Documentation**: [README.md](./README.md)
- **Developer Guide**: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

---

## Getting Help

1. Check this guide first
2. Review [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for detailed troubleshooting
3. Check clasp GitHub issues: https://github.com/google/clasp/issues
4. Check Apps Script documentation
5. Review Apps Script execution logs for errors

---

**Happy deploying!** 🚀
