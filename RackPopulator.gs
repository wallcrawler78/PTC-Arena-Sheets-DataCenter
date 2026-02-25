/**
 * Rack Populator
 * Handles populating individual rack configuration tabs with Arena data
 */

/**
 * Populates a rack tab with Arena items
 * @param {string} rackName - Name of the rack tab
 * @param {Array<Object>} arenaItems - Array of Arena items for this rack
 * @return {Object} Result with row count and statistics
 */
function populateRackTab(rackName, arenaItems) {
  try {
    // Prepare the sheet
    var sheet = prepareRackSheet(rackName);

    // If no items, just leave the header
    if (!arenaItems || arenaItems.length === 0) {
      Logger.log('No items for rack: ' + rackName);
      return {
        success: true,
        rackName: rackName,
        rowsAdded: 0,
        message: 'No items for this rack'
      };
    }

    // Process the items (map, consolidate, sort)
    var sheetData = processRackItems(arenaItems);

    if (sheetData.length === 0) {
      return {
        success: true,
        rackName: rackName,
        rowsAdded: 0,
        message: 'No valid items after processing'
      };
    }

    // Write data to sheet starting at row 2 (after header)
    var dataRange = sheet.getRange(2, 1, sheetData.length, sheetData[0].length);
    dataRange.setValues(sheetData);

    // Apply formatting
    formatRackSheet(sheet, sheetData.length);

    Logger.log('Populated rack ' + rackName + ' with ' + sheetData.length + ' items');

    return {
      success: true,
      rackName: rackName,
      rowsAdded: sheetData.length,
      itemCount: sheetData.length
    };

  } catch (error) {
    Logger.log('Error populating rack ' + rackName + ': ' + error.message);
    return {
      success: false,
      rackName: rackName,
      error: error.message
    };
  }
}

/**
 * Formats a rack sheet with proper styling
 * @param {Sheet} sheet - The rack sheet to format
 * @param {number} dataRows - Number of data rows (excluding header)
 */
function formatRackSheet(sheet, dataRows) {
  if (dataRows === 0) return;

  // Format quantity column (Column A) as numbers
  var qtyRange = sheet.getRange(2, RACK_COLUMN_INDICES.QTY + 1, dataRows, 1);
  formatAsQuantity(qtyRange);

  // Apply alternating row colors for better readability
  applyAlternatingRows(sheet, 2, dataRows);

  // Auto-resize all columns
  autoResizeColumns(sheet, 1, 4);

  // Apply borders to data area
  var dataRange = sheet.getRange(2, 1, dataRows, 4);
  applyBorders(dataRange, false);

  // Set wrap strategy for item name column
  var nameRange = sheet.getRange(2, RACK_COLUMN_INDICES.ITEM_NAME + 1, dataRows, 1);
  applyWrapStrategy(nameRange, 'WRAP');
}

/**
 * Populates all rack tabs from grouped Arena items
 * @param {Object} groupedItems - Items grouped by rack type
 * @return {Array<Object>} Array of results for each rack
 */
function populateAllRackTabs(groupedItems) {
  var results = [];

  // Process each rack type
  for (var rackName in groupedItems) {
    // Skip the 'Unassigned' group for now
    if (rackName === 'Unassigned') continue;

    var items = groupedItems[rackName];
    var result = populateRackTab(rackName, items);
    results.push(result);
  }

  return results;
}

/**
 * Calculates total quantities for all items in a rack
 * @param {string} rackName - Name of the rack tab
 * @return {Object} Summary with totals
 */
function calculateRackTotals(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) {
    return { totalItems: 0, totalQuantity: 0 };
  }

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    // Only header or empty
    return { totalItems: 0, totalQuantity: 0 };
  }

  // Get quantity column data
  var qtyRange = sheet.getRange(2, RACK_COLUMN_INDICES.QTY + 1, lastRow - 1, 1);
  var quantities = qtyRange.getValues();

  var totalQuantity = 0;
  quantities.forEach(function(row) {
    totalQuantity += parseInt(row[0], 10) || 0;
  });

  return {
    totalItems: lastRow - 1,
    totalQuantity: totalQuantity
  };
}

/**
 * Adds a totals row to the bottom of a rack sheet
 * @param {string} rackName - Name of the rack tab
 */
function addRackTotalsRow(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) return;

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return; // No data

  var totals = calculateRackTotals(rackName);

  // Add blank row, then totals row
  var totalsRow = lastRow + 2;

  sheet.getRange(totalsRow, 1, 1, 2).setValues([[totals.totalQuantity, 'TOTAL ITEMS: ' + totals.totalItems]]);

  // Format totals row
  var totalsRange = sheet.getRange(totalsRow, 1, 1, 4);
  applyTotalsFormatting(totalsRange);
}

/**
 * Sorts items in a rack sheet by category
 * @param {string} rackName - Name of the rack tab
 */
function sortRackByCategory(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) return;

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return; // No data to sort

  var dataRange = sheet.getRange(2, 1, lastRow - 1, 4);

  // Sort by category (column 4), then by item number (column 2)
  dataRange.sort([
    { column: 4, ascending: true },  // Category
    { column: 2, ascending: true }   // Item Number
  ]);
}

/**
 * Highlights items by category with color coding
 * @param {string} rackName - Name of the rack tab
 */
function highlightItemsByCategory(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) return;

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  // Get category column
  var categoryRange = sheet.getRange(2, RACK_COLUMN_INDICES.ITEM_CATEGORY + 1, lastRow - 1, 1);
  var categories = categoryRange.getValues();

  // Build color arrays for bulk apply instead of per-row sheet calls
  var backgrounds = [];
  var fontColors = [];
  for (var i = 0; i < categories.length; i++) {
    var category = categories[i][0];
    var color = getCategoryColor(category);
    var rowBg = color || '#ffffff';
    var rowFg = (color && isColorDark(color)) ? '#FFFFFF' : '#000000';
    backgrounds.push([rowBg, rowBg, rowBg, rowBg]);
    fontColors.push([rowFg, rowFg, rowFg, rowFg]);
  }
  // Single bulk call instead of N × 3 individual calls
  if (backgrounds.length > 0) {
    var colorRange = sheet.getRange(2, 1, backgrounds.length, 4);
    colorRange.setBackgrounds(backgrounds);
    colorRange.setFontColors(fontColors);
  }
}

/**
 * Gets a color for a category
 * @param {string} category - The category name
 * @return {string|null} Hex color or null
 */
function getCategoryColor(category) {
  var categoryUpper = category.toUpperCase();

  // Map categories to colors
  var colorMap = {
    'CATEGORY A': '#FFE599',  // Light yellow
    'CATEGORY B': '#B6D7A8',  // Light green
    'CATEGORY C': '#A4C2F4',  // Light blue
    'CATEGORY D': '#F4CCCC',  // Light red
    'CATEGORY F': '#D9D2E9',  // Light purple
    'CATEGORY L': '#FCE5CD',  // Light orange
    'ETH': RACK_COLORS.ETH,
    'SPINE': RACK_COLORS.SPINE,
    'GRID': RACK_COLORS.GRID_POD
  };

  for (var key in colorMap) {
    if (categoryUpper.indexOf(key) !== -1) {
      return colorMap[key];
    }
  }

  return null;
}

/**
 * Adds a filter to rack sheet headers
 * @param {string} rackName - Name of the rack tab
 */
function addRackFilter(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) return;

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  // Create filter on entire data range
  var dataRange = sheet.getRange(1, 1, lastRow, 4);

  // Remove existing filter if present
  var existingFilter = sheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  // Add new filter
  dataRange.createFilter();
}

/**
 * Clears a rack sheet and prepares it for new data
 * @param {string} rackName - Name of the rack tab
 */
function clearRackSheet(rackName) {
  prepareRackSheet(rackName);
  Logger.log('Cleared rack sheet: ' + rackName);
}

/**
 * Gets rack sheet data as objects
 * @param {string} rackName - Name of the rack tab
 * @return {Array<Object>} Array of rack part objects
 */
function getRackSheetData(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) {
    return [];
  }

  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  var dataRange = sheet.getRange(2, 1, lastRow - 1, 4);
  var values = dataRange.getValues();

  return values.map(function(row) {
    return {
      quantity: row[RACK_COLUMN_INDICES.QTY],
      itemNumber: row[RACK_COLUMN_INDICES.ITEM_NUMBER],
      itemName: row[RACK_COLUMN_INDICES.ITEM_NAME],
      itemCategory: row[RACK_COLUMN_INDICES.ITEM_CATEGORY]
    };
  });
}

/**
 * Exports rack data to CSV format
 * @param {string} rackName - Name of the rack tab
 * @return {string} CSV formatted string
 */
function exportRackToCSV(rackName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rackName);

  if (!sheet) {
    return '';
  }

  var data = sheet.getDataRange().getValues();

  var csv = data.map(function(row) {
    return row.map(function(cell) {
      // Escape quotes and wrap in quotes if contains comma
      var cellStr = String(cell);
      if (cellStr.indexOf(',') !== -1 || cellStr.indexOf('"') !== -1) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',');
  }).join('\n');

  return csv;
}
