/**
 * Sheet Manager
 * Manages multi-tab sheet structure and navigation
 */

/**
 * Gets or creates a sheet by name
 * @param {string} sheetName - Name of the sheet to get or create
 * @return {Sheet} The sheet object
 */
function getOrCreateSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('Creating new sheet: ' + sheetName);
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * Gets the complete tab structure configuration
 * @return {Object} Configuration object with all tab types
 */
function getTabStructure() {
  return {
    legend: {
      name: SHEET_NAMES.LEGEND_NET,
      type: 'summary',
      required: true
    },
    overhead: {
      name: SHEET_NAMES.OVERHEAD,
      type: 'layout',
      required: true
    },
    racks: getAllRackTabNames().map(function(name) {
      return {
        name: name,
        type: 'rack',
        required: false
      };
    })
  };
}

/**
 * Validates that required sheets exist in the spreadsheet
 * @return {Object} Validation result with missing sheets
 */
function validateSheetStructure() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var structure = getTabStructure();
  var missing = [];

  // Check legend sheet
  if (!spreadsheet.getSheetByName(structure.legend.name)) {
    missing.push(structure.legend.name);
  }

  // Check overhead sheet
  if (!spreadsheet.getSheetByName(structure.overhead.name)) {
    missing.push(structure.overhead.name);
  }

  return {
    isValid: missing.length === 0,
    missingSheets: missing
  };
}

/**
 * Creates all required sheets if they don't exist
 * @return {Array<Sheet>} Array of created sheets
 */
function ensureRequiredSheets() {
  var createdSheets = [];

  // Create Legend-NET
  var legendSheet = getOrCreateSheet(SHEET_NAMES.LEGEND_NET);
  if (!legendSheet.getLastRow()) {
    createdSheets.push(legendSheet);
  }

  // Create Overhead
  var overheadSheet = getOrCreateSheet(SHEET_NAMES.OVERHEAD);
  if (!overheadSheet.getLastRow()) {
    createdSheets.push(overheadSheet);
  }

  return createdSheets;
}

/**
 * Gets all existing rack sheets
 * @return {Array<Sheet>} Array of rack sheet objects
 */
function getAllRackSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var rackTabNames = getAllRackTabNames();
  var rackSheets = [];

  rackTabNames.forEach(function(tabName) {
    var sheet = spreadsheet.getSheetByName(tabName);
    if (sheet) {
      rackSheets.push(sheet);
    }
  });

  return rackSheets;
}

/**
 * Creates or clears a rack sheet with proper headers
 * @param {string} rackName - Name of the rack sheet
 * @return {Sheet} The prepared rack sheet
 */
function prepareRackSheet(rackName) {
  var sheet = getOrCreateSheet(rackName);

  // Set up headers
  var headers = [
    RACK_COLUMNS.QTY,
    RACK_COLUMNS.ITEM_NUMBER,
    RACK_COLUMNS.ITEM_NAME,
    RACK_COLUMNS.ITEM_CATEGORY
  ];

  setupSheetWithHeaders(sheet, headers, true);

  return sheet;
}

/**
 * Reorders sheets to standard configuration
 * Legend-NET first, then Overhead, then rack tabs alphabetically
 */
function reorderSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Define desired order
  var desiredOrder = [
    SHEET_NAMES.LEGEND_NET,
    SHEET_NAMES.OVERHEAD
  ].concat(getAllRackTabNames().sort());

  var position = 1;

  desiredOrder.forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      spreadsheet.setActiveSheet(sheet);
      spreadsheet.moveActiveSheet(position);
      position++;
    }
  });

  // Move Legend-NET to first position
  var legendSheet = spreadsheet.getSheetByName(SHEET_NAMES.LEGEND_NET);
  if (legendSheet) {
    spreadsheet.setActiveSheet(legendSheet);
  }
}

/**
 * Deletes a sheet by name if it exists
 * @param {string} sheetName - Name of sheet to delete
 * @return {boolean} True if sheet was deleted
 */
function deleteSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    spreadsheet.deleteSheet(sheet);
    Logger.log('Deleted sheet: ' + sheetName);
    return true;
  }

  return false;
}

/**
 * Clears all data from a sheet while preserving structure
 * @param {string} sheetName - Name of sheet to clear
 */
function clearSheetData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (sheet) {
    var lastRow = sheet.getLastRow();

    // Keep header row, clear everything else
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  }
}

/**
 * Gets sheet statistics
 * @return {Object} Statistics about the spreadsheet structure
 */
function getSheetStatistics() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets();

  var stats = {
    totalSheets: allSheets.length,
    legendExists: !!spreadsheet.getSheetByName(SHEET_NAMES.LEGEND_NET),
    overheadExists: !!spreadsheet.getSheetByName(SHEET_NAMES.OVERHEAD),
    rackSheets: [],
    otherSheets: []
  };

  var rackTabNames = getAllRackTabNames();

  allSheets.forEach(function(sheet) {
    var name = sheet.getName();

    if (rackTabNames.indexOf(name) !== -1) {
      stats.rackSheets.push({
        name: name,
        rows: sheet.getLastRow(),
        columns: sheet.getLastColumn()
      });
    } else if (name !== SHEET_NAMES.LEGEND_NET && name !== SHEET_NAMES.OVERHEAD) {
      stats.otherSheets.push(name);
    }
  });

  return stats;
}

/**
 * Activates a sheet by name
 * @param {string} sheetName - Name of sheet to activate
 * @return {boolean} True if sheet was activated
 */
function activateSheet(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet) {
    spreadsheet.setActiveSheet(sheet);
    return true;
  }

  return false;
}

/**
 * Hides empty rack sheets
 * @return {Array<string>} Names of hidden sheets
 */
function hideEmptyRackSheets() {
  var rackSheets = getAllRackSheets();
  var hiddenSheets = [];

  rackSheets.forEach(function(sheet) {
    // If sheet only has header row (or is empty)
    if (sheet.getLastRow() <= 1) {
      sheet.hideSheet();
      hiddenSheets.push(sheet.getName());
    }
  });

  return hiddenSheets;
}

/**
 * Shows all rack sheets
 * @return {Array<string>} Names of shown sheets
 */
function showAllRackSheets() {
  var rackSheets = getAllRackSheets();
  var shownSheets = [];

  rackSheets.forEach(function(sheet) {
    if (sheet.isSheetHidden()) {
      sheet.showSheet();
      shownSheets.push(sheet.getName());
    }
  });

  return shownSheets;
}

/**
 * Creates a backup of current sheet structure
 * @return {Object} Backup information
 */
function createSheetBackup() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
  var backupName = 'Backup_' + timestamp;

  // Create a copy of the spreadsheet
  var backup = spreadsheet.copy(backupName);

  return {
    success: true,
    backupName: backupName,
    backupUrl: backup.getUrl(),
    timestamp: timestamp
  };
}

/**
 * Gets a list of all sheet names
 * @return {Array<string>} Array of sheet names
 */
function getAllSheetNames() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = spreadsheet.getSheets();

  return sheets.map(function(sheet) {
    return sheet.getName();
  });
}

/**
 * Checks if a sheet exists
 * @param {string} sheetName - Name to check
 * @return {boolean} True if sheet exists
 */
function sheetExists(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(sheetName) !== null;
}
