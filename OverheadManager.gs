/**
 * Overhead Manager
 * Manages the overhead layout grid showing rack positions in the datacenter
 */

/**
 * Generates the overhead layout grid
 * @param {Object} rackConfiguration - Configuration object mapping positions to rack types
 * @return {Object} Result with success status
 */
function generateOverheadLayout(rackConfiguration) {
  try {
    var sheet = getOrCreateSheet(SHEET_NAMES.OVERHEAD);

    // Clear existing content
    sheet.clear();

    // Set up the grid based on configuration
    setupOverheadGrid(sheet, rackConfiguration);

    // Apply formatting
    formatOverheadSheet(sheet);

    return {
      success: true,
      message: 'Overhead layout generated successfully'
    };

  } catch (error) {
    Logger.log('Error generating overhead layout: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sets up the overhead grid structure
 * @param {Sheet} sheet - The overhead sheet
 * @param {Object} rackConfiguration - Rack position mapping
 */
function setupOverheadGrid(sheet, rackConfiguration) {
  var config = OVERHEAD_CONFIG;

  // Example layout structure based on the screenshot
  // This creates a grid with rack positions numbered and color-coded

  var layout = createDefaultLayout();

  // If custom configuration provided, use it
  if (rackConfiguration) {
    layout = rackConfiguration;
  }

  // Populate the grid
  populateOverheadGrid(sheet, layout);
}

/**
 * Creates a default rack layout based on the screenshot
 * @return {Object} Default layout configuration
 */
function createDefaultLayout() {
  // Based on the screenshot showing positions 1-40 in 4 rows of 10
  var layout = {
    rows: [
      // Row 1 (positions 1-10, right to left)
      {
        label: '1',
        positions: [
          { pos: 1, rack: SHEET_NAMES.FULL_RACK_A },
          { pos: 2, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 3, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 4, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 5, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 6, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 7, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 8, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 9, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 10, rack: SHEET_NAMES.FULL_RACK_C }
        ]
      },
      // Row 2 (positions 11-20, left to right)
      {
        label: '2',
        positions: [
          { pos: 20, rack: SHEET_NAMES.FULL_RACK_A },
          { pos: 19, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 18, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 17, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 16, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 15, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 14, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 13, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 12, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 11, rack: SHEET_NAMES.FULL_RACK_C }
        ]
      },
      // Row 3 (positions 21-30, right to left)
      {
        label: '3',
        positions: [
          { pos: 21, rack: SHEET_NAMES.FULL_RACK_A },
          { pos: 22, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 23, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 24, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 25, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 26, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 27, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 28, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 29, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 30, rack: SHEET_NAMES.FULL_RACK_F }
        ]
      },
      // Row 4 (positions 31-40, left to right)
      {
        label: '4',
        positions: [
          { pos: 40, rack: SHEET_NAMES.FULL_RACK_G },
          { pos: 39, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 38, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 37, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 36, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 35, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 34, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 33, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 32, rack: SHEET_NAMES.FULL_RACK_B },
          { pos: 31, rack: SHEET_NAMES.FULL_RACK_E }
        ]
      }
    ]
  };

  return layout;
}

/**
 * Populates the overhead grid with rack data
 * @param {Sheet} sheet - The overhead sheet
 * @param {Object} layout - Layout configuration
 */
function populateOverheadGrid(sheet, layout) {
  var startRow = OVERHEAD_CONFIG.START_ROW;
  var startCol = OVERHEAD_CONFIG.START_COL;

  var currentRow = startRow;

  layout.rows.forEach(function(row, rowIndex) {
    // Add row label
    sheet.getRange(currentRow, 1).setValue(row.label);

    // Add position numbers row
    var posRow = currentRow;
    var positionNumbers = row.positions.map(function(p) { return p.pos; });
    sheet.getRange(posRow, startCol, 1, positionNumbers.length).setValues([positionNumbers]);

    // Add rack names row with hyperlinks
    var rackRow = currentRow + 1;
    row.positions.forEach(function(position, colIndex) {
      var cell = sheet.getRange(rackRow, startCol + colIndex);

      // Create hyperlink to rack tab
      var linkFormula = createSheetLink(position.rack, position.rack);
      cell.setFormula(linkFormula);

      // Apply color coding
      var color = getRackColor(position.rack);
      cell.setBackground(color);

      if (isColorDark(color)) {
        cell.setFontColor('#FFFFFF');
      } else {
        cell.setFontColor('#000000');
      }

      // Center the text
      centerContent(cell);
    });

    // Move to next row group (leave space between aisles)
    currentRow += 3;
  });
}

/**
 * Formats the overhead sheet
 * @param {Sheet} sheet - The overhead sheet
 */
function formatOverheadSheet(sheet) {
  // Set column widths
  var numCols = 11; // Label + 10 positions
  for (var i = 1; i <= numCols; i++) {
    if (i === 1) {
      sheet.setColumnWidth(i, 50); // Narrower for row labels
    } else {
      sheet.setColumnWidth(i, OVERHEAD_CONFIG.CELL_WIDTH);
    }
  }

  // Set row heights
  var numRows = sheet.getLastRow();
  for (var i = 1; i <= numRows; i++) {
    sheet.setRowHeight(i, OVERHEAD_CONFIG.CELL_HEIGHT);
  }

  // Apply borders to all cells with content
  var dataRange = sheet.getDataRange();
  applyBorders(dataRange, false);

  // Center all content
  centerContent(dataRange);

  // Freeze the first column
  sheet.setFrozenColumns(1);
}

/**
 * Links a rack cell to its corresponding tab
 * @param {Range} cellRange - The cell to link
 * @param {string} rackName - Name of the rack tab
 */
function linkRackToTab(cellRange, rackName) {
  var linkFormula = createSheetLink(rackName, rackName);
  cellRange.setFormula(linkFormula);
}

/**
 * Color codes a rack cell based on rack type
 * @param {Range} cellRange - The cell to color
 * @param {string} rackType - The rack type
 */
function colorCodeRackCell(cellRange, rackType) {
  applyColorScheme(cellRange, rackType);
  centerContent(cellRange);
}

/**
 * Updates rack positions in the overhead view
 * @param {Object} layoutData - New layout data
 * @return {Object} Update result
 */
function updateRackPositions(layoutData) {
  try {
    return generateOverheadLayout(layoutData);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gets the current overhead layout as an object
 * @return {Object} Current layout configuration
 */
function getCurrentOverheadLayout() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.OVERHEAD);

  if (!sheet) {
    return null;
  }

  var layout = { rows: [] };
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  // Parse the sheet data back into layout object
  // This is a simplified version - actual implementation would be more robust
  for (var i = 0; i < values.length; i += 3) {
    if (values[i] && values[i][0]) {
      var rowData = {
        label: values[i][0],
        positions: []
      };

      // Get position numbers
      var positionRow = values[i];
      var rackRow = values[i + 1];

      for (var j = 1; j < positionRow.length && positionRow[j]; j++) {
        rowData.positions.push({
          pos: positionRow[j],
          rack: rackRow[j]
        });
      }

      layout.rows.push(rowData);
    }
  }

  return layout;
}

/**
 * Adds a legend to the overhead sheet
 * @param {Sheet} sheet - The overhead sheet
 */
function addOverheadLegend(sheet) {
  var startRow = sheet.getLastRow() + 3;

  // Add legend title
  sheet.getRange(startRow, 1).setValue('Rack Type Legend:');
  sheet.getRange(startRow, 1).setFontWeight('bold');

  startRow++;

  // Add each rack type with color
  var rackTypes = [
    { name: SHEET_NAMES.FULL_RACK_A, color: getEntityTypeColor(SHEET_NAMES.FULL_RACK_A) },
    { name: SHEET_NAMES.FULL_RACK_B, color: getEntityTypeColor(SHEET_NAMES.FULL_RACK_B) },
    { name: SHEET_NAMES.FULL_RACK_C, color: getEntityTypeColor(SHEET_NAMES.FULL_RACK_C) },
    { name: SHEET_NAMES.FULL_RACK_F, color: getEntityTypeColor(SHEET_NAMES.FULL_RACK_F) },
    { name: SHEET_NAMES.FULL_RACK_G, color: getEntityTypeColor(SHEET_NAMES.FULL_RACK_G) }
  ];

  rackTypes.forEach(function(rackType, index) {
    var cell = sheet.getRange(startRow + index, 1, 1, 2);
    cell.merge();
    cell.setValue(rackType.name);
    cell.setBackground(rackType.color);

    if (isColorDark(rackType.color)) {
      cell.setFontColor('#FFFFFF');
    } else {
      cell.setFontColor('#000000');
    }

    centerContent(cell);
  });
}

/**
 * Highlights a specific rack position
 * @param {number} position - The rack position number
 * @param {string} highlightColor - Color to highlight with
 */
function highlightRackPosition(position, highlightColor) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.OVERHEAD);

  if (!sheet) return;

  // Find the cell with this position number
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] === position) {
        // Found it - highlight the rack cell below
        var rackCell = sheet.getRange(i + 2, j + 1); // +2 for rack row, +1 for 1-indexed
        rackCell.setBorder(true, true, true, true, true, true, highlightColor, SpreadsheetApp.BorderStyle.SOLID_THICK);
        return;
      }
    }
  }
}

/**
 * Clears the overhead sheet
 */
function clearOverheadSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.OVERHEAD);

  if (sheet) {
    sheet.clear();
    Logger.log('Cleared overhead sheet');
  }
}
