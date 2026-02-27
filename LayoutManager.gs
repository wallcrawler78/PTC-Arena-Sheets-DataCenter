/**
 * Layout Manager
 * Handles creation and management of different sheet layouts (Tower, Overview, Rack Config)
 */

// Standard column widths used across layout types
var COLUMN_WIDTHS = {
  POSITION:    80,
  QTY:         60,
  LEVEL:       60,
  ROW_HEADER:  50,
  LIFECYCLE:   100,
  CATEGORY:    120,
  GRID_CELL:   120,
  ITEM_NUMBER: 150,
  NOTES:       200,
  ITEM_NAME:   250
};

/**
 * Creates a tower layout sheet (vertical server stacking)
 * @param {string} sheetName - Name for the new tower sheet
 * @return {Sheet} The created sheet
 */
function createTowerLayout(sheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Check if sheet already exists
  var existingSheet = spreadsheet.getSheetByName(sheetName);
  if (existingSheet) {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert(
      'Sheet Exists',
      'A sheet named "' + sheetName + '" already exists. Overwrite?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      spreadsheet.deleteSheet(existingSheet);
    } else {
      return null;
    }
  }

  // Create new sheet
  var sheet = spreadsheet.insertSheet(sheetName);

  // Set up headers
  var headers = ['Position', 'Qty', 'Item Number', 'Item Name', 'Category', 'Notes'];

  // Add configured attribute columns
  var columns = getItemColumns();
  columns.forEach(function(col) {
    headers.push(col.header || col.attributeName);
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Set column widths
  sheet.setColumnWidth(1, COLUMN_WIDTHS.POSITION);    // Position
  sheet.setColumnWidth(2, COLUMN_WIDTHS.QTY);          // Qty
  sheet.setColumnWidth(3, COLUMN_WIDTHS.ITEM_NUMBER);  // Item Number
  sheet.setColumnWidth(4, COLUMN_WIDTHS.ITEM_NAME);    // Item Name
  sheet.setColumnWidth(5, COLUMN_WIDTHS.CATEGORY);     // Category
  sheet.setColumnWidth(6, COLUMN_WIDTHS.NOTES);        // Notes

  // Add initial rows (positions)
  var positions = [];
  for (var i = 1; i <= 42; i++) {
    positions.push(['U' + i, 1, '', '', '', '']);
  }

  if (positions.length > 0) {
    sheet.getRange(2, 1, positions.length, 6).setValues(positions);
  }

  // Freeze header row and position column
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // Add alternating row colors for better readability
  for (var row = 2; row <= positions.length + 1; row++) {
    if (row % 2 === 0) {
      sheet.getRange(row, 1, 1, headers.length).setBackground('#f8f9fa');
    }
  }

  return sheet;
}

/**
 * Creates an overview layout sheet (horizontal rack grid)
 * @param {string} sheetName - Name for the new overview sheet
 * @param {number} rows - Number of rows in the grid
 * @param {number} cols - Number of columns in the grid
 * @return {Sheet} The created sheet
 */
function createOverviewLayout(sheetName, rows, cols) {
  rows = rows || 10;
  cols = cols || 10;

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Check if sheet already exists
  var existingSheet = spreadsheet.getSheetByName(sheetName);
  if (existingSheet) {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert(
      'Sheet Exists',
      'A sheet named "' + sheetName + '" already exists. Overwrite?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      spreadsheet.deleteSheet(existingSheet);
    } else {
      return null;
    }
  }

  // Create new sheet
  var sheet = spreadsheet.insertSheet(sheetName);

  // Set up title with dynamic terminology
  var hierarchyLevel0 = getTerminology('hierarchy_level_0');
  sheet.getRange(1, 1).setValue(hierarchyLevel0 + ' Overview');
  sheet.getRange(1, 1, 1, cols + 2).merge()  // +2: col A (row#) + col B (Row Item)
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');

  // Create grid
  var startRow = 3;

  // Col B: "Row Item" header — shows Arena-assigned part numbers with clickable links
  sheet.getRange(startRow, 2).setValue('Row Item')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');

  // Col C+: "Pos 1", "Pos 2", ... headers
  var colHeaders = [];
  for (var c = 0; c < cols; c++) {
    colHeaders.push('Pos ' + (c + 1));
  }
  sheet.getRange(startRow, 3, 1, cols).setValues([colHeaders]);
  sheet.getRange(startRow, 3, 1, cols)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');

  // Add row headers (1, 2, 3, etc.) in col A
  var rowHeaders = [];
  for (var r = 0; r < rows; r++) {
    rowHeaders.push([r + 1]);
  }
  sheet.getRange(startRow + 1, 1, rows, 1).setValues(rowHeaders);
  sheet.getRange(startRow + 1, 1, rows, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#f0f0f0');

  // Set cell sizes
  sheet.setColumnWidth(1, COLUMN_WIDTHS.ROW_HEADER);  // Col A: row sequence numbers
  sheet.setColumnWidth(2, COLUMN_WIDTHS.ITEM_NUMBER);  // Col B: Row Item part numbers
  for (var c = 3; c <= cols + 2; c++) {               // Col C+: Pos 1, Pos 2, ...
    sheet.setColumnWidth(c, COLUMN_WIDTHS.GRID_CELL);
  }

  for (var r = startRow + 1; r <= startRow + rows; r++) {
    sheet.setRowHeight(r, 80);
  }

  // Add borders to the rack position grid (col C+)
  var gridRange = sheet.getRange(startRow + 1, 3, rows, cols);
  gridRange.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  // Freeze headers (only freeze rows, not columns due to merged title)
  sheet.setFrozenRows(startRow);

  // Set tab color to green
  sheet.setTabColor('#4caf50');

  return sheet;
}

/**
 * Creates a rack configuration sheet with standard BOM structure
 * @param {string} rackName - Name of the rack (e.g., "Rack A")
 * @return {Sheet} The created sheet
 */
function createRackConfigSheet(rackName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Check if sheet already exists
  var existingSheet = spreadsheet.getSheetByName(rackName);
  if (existingSheet) {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert(
      'Sheet Exists',
      'A sheet named "' + rackName + '" already exists. Overwrite?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      spreadsheet.deleteSheet(existingSheet);
    } else {
      return null;
    }
  }

  // Create new sheet
  var sheet = spreadsheet.insertSheet(rackName);

  // Set up headers for BOM structure
  var headers = ['Level', 'Qty', 'Item Number', 'Item Name', 'Category', 'Lifecycle', 'Notes'];

  // Add configured attribute columns
  var columns = getItemColumns();
  columns.forEach(function(col) {
    headers.push(col.header || col.attributeName);
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Set column widths
  sheet.setColumnWidth(1, COLUMN_WIDTHS.LEVEL);        // Level
  sheet.setColumnWidth(2, COLUMN_WIDTHS.QTY);           // Qty
  sheet.setColumnWidth(3, COLUMN_WIDTHS.ITEM_NUMBER);   // Item Number
  sheet.setColumnWidth(4, COLUMN_WIDTHS.ITEM_NAME);     // Item Name
  sheet.setColumnWidth(5, COLUMN_WIDTHS.CATEGORY);      // Category
  sheet.setColumnWidth(6, COLUMN_WIDTHS.LIFECYCLE);     // Lifecycle
  sheet.setColumnWidth(7, COLUMN_WIDTHS.NOTES);         // Notes

  // Add rack info section at top
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1).setValue('Rack Configuration: ' + rackName)
    .setFontSize(14)
    .setFontWeight('bold');

  sheet.getRange(1, 1, 1, headers.length).merge()
    .setBackground('#f8f9fa');

  // Freeze header row
  sheet.setFrozenRows(2);

  return sheet;
}

/**
 * Links a cell in the overview to a rack configuration sheet
 * @param {string} overviewSheetName - Name of the overview sheet
 * @param {number} row - Row in overview grid
 * @param {number} col - Column in overview grid
 * @param {string} rackSheetName - Name of the rack sheet to link to
 * @param {string} [displayText] - Optional display text for the hyperlink (defaults to rackSheetName)
 */
function linkOverviewToRack(overviewSheetName, row, col, rackSheetName, displayText) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var overviewSheet = spreadsheet.getSheetByName(overviewSheetName);

  if (!overviewSheet) {
    throw new Error('Overview sheet not found: ' + overviewSheetName);
  }

  var rackSheet = spreadsheet.getSheetByName(rackSheetName);
  if (!rackSheet) {
    throw new Error('Rack sheet not found: ' + rackSheetName);
  }

  var cell = overviewSheet.getRange(row, col);

  // Create hyperlink formula — display text defaults to sheet name but can be
  // overridden (e.g. with item number) so scanOverviewByRow can match it later
  var sheetId = rackSheet.getSheetId();
  var url = '#gid=' + sheetId;
  var label = displayText || rackSheetName;

  cell.setFormula('=HYPERLINK("' + url + '", "' + label + '")');
  cell.setFontColor('#1a73e8')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

/**
 * Populates an overview grid cell with rack information
 * @param {string} overviewSheetName - Name of the overview sheet
 * @param {number} row - Row in overview grid
 * @param {number} col - Column in overview grid
 * @param {string} rackName - Rack name/identifier
 * @param {string} category - Rack category for color coding
 */
function populateOverviewCell(overviewSheetName, row, col, rackName, category) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var overviewSheet = spreadsheet.getSheetByName(overviewSheetName);

  if (!overviewSheet) {
    throw new Error('Overview sheet not found: ' + overviewSheetName);
  }

  var cell = overviewSheet.getRange(row, col);
  cell.setValue(rackName);

  // Apply category color
  var color = getCategoryColor(category);
  if (color) {
    cell.setBackground(color);
  }

  // Format
  cell.setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontWeight('bold');
}

/**
 * Menu action to create a new tower layout
 */
function createNewTowerLayout() {
  var ui = SpreadsheetApp.getUi();

  var response = ui.prompt(
    'Create Tower Layout',
    'Enter name for the tower layout (e.g., "Tower A"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var name = response.getResponseText().trim();
    if (!name) {
      ui.alert('Error', 'Tower name is required', ui.ButtonSet.OK);
      return;
    }

    try {
      var sheet = createTowerLayout(name);
      if (sheet) {
        ui.alert('Success', 'Tower layout "' + name + '" created!', ui.ButtonSet.OK);
        SpreadsheetApp.setActiveSheet(sheet);
      }
    } catch (error) {
      ui.alert('Error', 'Failed to create tower layout: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Menu action to create a new overview layout
 */
function createNewOverviewLayout() {
  var ui = SpreadsheetApp.getUi();

  var response = ui.prompt(
    'Create Overview Layout',
    'Enter name for the overview (e.g., "Hall 1 Overview"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var name = response.getResponseText().trim();
    if (!name) {
      ui.alert('Error', 'Overview name is required', ui.ButtonSet.OK);
      return;
    }

    // Prompt for number of rows
    var hierarchyLevel1 = getTerminology('hierarchy_level_1');
    var rowsResponse = ui.prompt(
      'Number of Rows',
      'Enter number of rows in the ' + hierarchyLevel1.toLowerCase() + ' (e.g., "10"):',
      ui.ButtonSet.OK_CANCEL
    );

    if (rowsResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    var rows = parseInt(rowsResponse.getResponseText().trim(), 10);
    if (isNaN(rows) || rows < 1 || rows > 50) {
      ui.alert('Error', 'Number of rows must be between 1 and 50', ui.ButtonSet.OK);
      return;
    }

    // Prompt for number of entity positions per row
    var entitySingular = getTerminology('entity_singular');
    var positionsResponse = ui.prompt(
      entitySingular + ' Positions per Row',
      'Enter number of ' + entitySingular.toLowerCase() + ' positions per row (e.g., "12"):',
      ui.ButtonSet.OK_CANCEL
    );

    if (positionsResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    var positions = parseInt(positionsResponse.getResponseText().trim(), 10);
    if (isNaN(positions) || positions < 1 || positions > 50) {
      ui.alert('Error', 'Number of positions must be between 1 and 50', ui.ButtonSet.OK);
      return;
    }

    try {
      var sheet = createOverviewLayout(name, rows, positions);
      if (sheet) {
        var entityPlural = getTerminology('entity_plural_lower');
        ui.alert('Success',
          'Overview layout "' + name + '" created!\n\n' +
          'Rows: ' + rows + '\n' +
          'Positions per row: ' + positions + '\n\n' +
          'Use "Show ' + entitySingular + ' Picker" to place ' + entityPlural + ' in the grid.',
          ui.ButtonSet.OK);
        SpreadsheetApp.setActiveSheet(sheet);
      }
    } catch (error) {
      ui.alert('Error', 'Failed to create overview layout: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Menu action to create a new rack configuration sheet
 */
function createNewRackConfig() {
  var ui = SpreadsheetApp.getUi();

  var response = ui.prompt(
    'Create Rack Configuration',
    'Enter rack name (e.g., "Rack A"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    var name = response.getResponseText().trim();
    if (!name) {
      ui.alert('Error', 'Rack name is required', ui.ButtonSet.OK);
      return;
    }

    try {
      var sheet = createRackConfigSheet(name);
      if (sheet) {
        ui.alert('Success', 'Rack configuration "' + name + '" created!', ui.ButtonSet.OK);
        SpreadsheetApp.setActiveSheet(sheet);
      }
    } catch (error) {
      ui.alert('Error', 'Failed to create rack configuration: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Auto-links all rack sheets to the overview layout
 * @param {string} overviewSheetName - Name of the overview sheet
 */
function autoLinkRacksToOverview(overviewSheetName) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var entityPlural = getTerminology('entity_plural_lower');

  // Find all rack config sheets using metadata detection (terminology-agnostic)
  var rackConfigs = getAllRackConfigTabs();

  if (rackConfigs.length === 0) {
    SpreadsheetApp.getUi().alert('No ' + getTerminology('entity_plural'),
      'No ' + entityPlural + ' found to link. Create some first.',
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // Dynamically locate the header row and first position column so this works
  // regardless of whether "Row Item" column is present or what row the headers are on.
  var startRow = 4;   // fallback defaults
  var startCol = 3;   // col C (after "Row Item" at col B)
  var maxCols = 5;

  var overviewSheet = spreadsheet.getSheetByName(overviewSheetName);
  if (overviewSheet) {
    var sheetData = overviewSheet.getDataRange().getValues();
    var foundPos = false;
    for (var i = 0; i < sheetData.length && !foundPos; i++) {
      for (var j = 0; j < sheetData[i].length; j++) {
        if (sheetData[i][j] && String(sheetData[i][j]).toLowerCase().indexOf('pos ') === 0) {
          startRow = i + 2;       // data row = header row + 1 (both 1-based)
          startCol = j + 1;       // 1-based column index of first "Pos" header
          // Count consecutive "Pos" columns
          var posCount = 0;
          for (var k = j; k < sheetData[i].length; k++) {
            if (sheetData[i][k] && String(sheetData[i][k]).toLowerCase().indexOf('pos ') === 0) {
              posCount++;
            } else {
              break;
            }
          }
          if (posCount > 0) maxCols = posCount;
          foundPos = true;
          break;
        }
      }
    }
  }

  // Link racks to overview grid (arrange in grid pattern)
  // Uses item number as display text so scanOverviewByRow can match it later
  rackConfigs.forEach(function(config, index) {
    var row = startRow + Math.floor(index / maxCols);
    var col = startCol + (index % maxCols);

    try {
      linkOverviewToRack(overviewSheetName, row, col, config.sheetName, config.itemNumber);
    } catch (error) {
      Logger.log('Error linking rack ' + config.itemNumber + ': ' + error.message);
    }
  });

  SpreadsheetApp.getUi().alert(
    'Success',
    'Linked ' + rackConfigs.length + ' ' + entityPlural + ' to overview',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Menu action to auto-link racks
 */
function autoLinkRacksToOverviewAction() {
  var ui = SpreadsheetApp.getUi();

  // Find overview sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets();
  var overviewSheets = [];

  allSheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.toLowerCase().indexOf('overview') !== -1) {
      overviewSheets.push(name);
    }
  });

  if (overviewSheets.length === 0) {
    ui.alert('No Overview', 'No overview sheet found. Create one first.', ui.ButtonSet.OK);
    return;
  }

  var overviewName = overviewSheets[0];
  if (overviewSheets.length > 1) {
    var response = ui.prompt(
      'Multiple Overviews Found',
      'Enter the name of the overview sheet to use:\n' + overviewSheets.join(', '),
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
      overviewName = response.getResponseText().trim();
    } else {
      return;
    }
  }

  autoLinkRacksToOverview(overviewName);
}
