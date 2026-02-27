/**
 * Formatting Utilities
 * Helper functions for consistent formatting across all sheets
 */

/**
 * Applies header formatting to a range
 * @param {Range} range - The range to format as a header
 * @param {Object} customStyle - Optional custom style overrides
 */
function applyHeaderFormatting(range, customStyle) {
  var style = customStyle || HEADER_STYLE;

  range.setBackground(style.BACKGROUND_COLOR)
    .setFontColor(style.FONT_COLOR)
    .setFontWeight(style.FONT_WEIGHT)
    .setFontSize(style.FONT_SIZE)
    .setHorizontalAlignment(style.HORIZONTAL_ALIGNMENT)
    .setVerticalAlignment(style.VERTICAL_ALIGNMENT);
}

/**
 * Applies Legend-NET header formatting
 * @param {Range} range - The range to format
 */
function applyLegendHeaderFormatting(range) {
  range.setBackground(LEGEND_HEADER_STYLE.BACKGROUND_COLOR)
    .setFontColor(LEGEND_HEADER_STYLE.FONT_COLOR)
    .setFontWeight(LEGEND_HEADER_STYLE.FONT_WEIGHT)
    .setFontSize(LEGEND_HEADER_STYLE.FONT_SIZE)
    .setHorizontalAlignment(LEGEND_HEADER_STYLE.HORIZONTAL_ALIGNMENT);
}

/**
 * Applies totals row formatting
 * @param {Range} range - The range to format as a totals row
 */
function applyTotalsFormatting(range) {
  range.setBackground(TOTALS_STYLE.BACKGROUND_COLOR)
    .setFontColor(TOTALS_STYLE.FONT_COLOR)
    .setFontWeight(TOTALS_STYLE.FONT_WEIGHT)
    .setHorizontalAlignment(TOTALS_STYLE.HORIZONTAL_ALIGNMENT);
}

/**
 * Applies color scheme based on rack type
 * @param {Range} range - The range to color
 * @param {string} rackType - The rack type identifier
 */
function applyColorScheme(range, rackType) {
  var color = getEntityTypeColor(rackType);
  range.setBackground(color);

  // Set font color based on background brightness
  if (isColorDark(color)) {
    range.setFontColor('#FFFFFF'); // White text for dark backgrounds
  } else {
    range.setFontColor('#000000'); // Black text for light backgrounds
  }
}

/**
 * Determines if a color is dark (for text color selection)
 * @param {string} hexColor - Hex color code
 * @return {boolean} True if color is dark
 */
function isColorDark(hexColor) {
  // Convert hex to RGB
  var rgb = hexToRgb(hexColor);
  if (!rgb) return false;

  // Calculate relative luminance
  var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

  return luminance < 0.5;
}

/**
 * Converts hex color to RGB
 * @param {string} hex - Hex color code
 * @return {Object} Object with r, g, b properties
 */
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Freezes the header row of a sheet
 * @param {Sheet} sheet - The sheet to freeze headers on
 * @param {number} numRows - Number of rows to freeze (default 1)
 */
function freezeHeaderRows(sheet, numRows) {
  numRows = numRows || 1;
  sheet.setFrozenRows(numRows);
}

/**
 * Auto-resizes all columns in a sheet to fit content
 * @param {Sheet} sheet - The sheet to resize columns for
 * @param {number} startCol - Starting column (default 1)
 * @param {number} numCols - Number of columns (default all)
 */
function autoResizeColumns(sheet, startCol, numCols) {
  startCol = startCol || 1;
  numCols = numCols || sheet.getMaxColumns();

  for (var i = 0; i < numCols; i++) {
    sheet.autoResizeColumn(startCol + i);
  }
}

/**
 * Sets up basic sheet formatting with headers
 * @param {Sheet} sheet - The sheet to format
 * @param {Array<string>} headers - Array of header names
 * @param {boolean} freeze - Whether to freeze the header row
 */
function setupSheetWithHeaders(sheet, headers, freeze) {
  freeze = freeze !== false; // Default to true

  // Clear existing content
  sheet.clear();

  // Set headers
  if (headers && headers.length > 0) {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    applyHeaderFormatting(headerRange);
  }

  // Freeze header
  if (freeze) {
    freezeHeaderRows(sheet, 1);
  }

  // Auto-resize
  autoResizeColumns(sheet, 1, headers.length);
}

/**
 * Applies alternating row colors for better readability
 * @param {Sheet} sheet - The sheet to apply banding to
 * @param {number} startRow - Starting row (usually 2, after header)
 * @param {number} numRows - Number of rows to band
 */
function applyAlternatingRows(sheet, startRow, numRows) {
  startRow = startRow || 2;

  var dataRange = sheet.getRange(startRow, 1, numRows, sheet.getMaxColumns());

  // Remove existing banding
  var bandings = sheet.getBandings();
  bandings.forEach(function(banding) {
    banding.remove();
  });

  // Apply new banding
  dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
}

/**
 * Creates a hyperlink to another sheet/tab
 * @param {string} targetSheetName - Name of the target sheet
 * @param {string} displayText - Text to display for the link
 * @return {string} The hyperlink formula
 */
function createSheetLink(targetSheetName, displayText) {
  displayText = displayText || targetSheetName;

  var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);

  if (!targetSheet) {
    return displayText; // Return plain text if sheet doesn't exist
  }

  var sheetId = targetSheet.getSheetId();
  var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheetId;

  return '=HYPERLINK("' + url + '", "' + displayText + '")';
}

/**
 * Applies border formatting to a range
 * @param {Range} range - The range to add borders to
 * @param {boolean} thick - Whether to use thick borders
 */
function applyBorders(range, thick) {
  var borderStyle = thick ? SpreadsheetApp.BorderStyle.SOLID_THICK : SpreadsheetApp.BorderStyle.SOLID;

  range.setBorder(true, true, true, true, true, true, '#000000', borderStyle);
}

/**
 * Centers content in a range both horizontally and vertically
 * @param {Range} range - The range to center
 */
function centerContent(range) {
  range.setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
}

/**
 * Formats a cell as a quantity (number, right-aligned)
 * @param {Range} range - The range to format
 */
function formatAsQuantity(range) {
  range.setNumberFormat('0')
    .setHorizontalAlignment('right');
}

/**
 * Protects a range from editing
 * @param {Range} range - The range to protect
 * @param {string} description - Description for the protection
 */
function protectRange(range, description) {
  var protection = range.protect();
  protection.setDescription(description || 'Protected range');

  // Only allow the sheet owner to edit
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  protection.removeEditors(protection.getEditors());

  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}

/**
 * Clears formatting from a sheet while preserving data
 * @param {Sheet} sheet - The sheet to clear formatting from
 */
function clearFormatting(sheet) {
  var range = sheet.getDataRange();
  range.clearFormat();
}

/**
 * Applies wrap strategy to a range
 * @param {Range} range - The range to apply wrapping to
 * @param {string} strategy - 'WRAP', 'OVERFLOW', or 'CLIP'
 */
function applyWrapStrategy(range, strategy) {
  strategy = strategy || 'WRAP';

  var wrapStrategy;
  switch (strategy.toUpperCase()) {
    case 'OVERFLOW':
      wrapStrategy = SpreadsheetApp.WrapStrategy.OVERFLOW;
      break;
    case 'CLIP':
      wrapStrategy = SpreadsheetApp.WrapStrategy.CLIP;
      break;
    default:
      wrapStrategy = SpreadsheetApp.WrapStrategy.WRAP;
  }

  range.setWrapStrategy(wrapStrategy);
}
