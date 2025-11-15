/**
 * Legend Manager
 * Manages the Legend-NET summary tab showing categorized totals
 */

/**
 * Generates the Legend-NET summary from all rack data
 * @param {Object} allRackData - Data from all rack tabs grouped by category
 * @return {Object} Result with success status
 */
function generateLegendSummary(allRackData) {
  try {
    var sheet = getOrCreateSheet(SHEET_NAMES.LEGEND_NET);

    // Clear existing content
    sheet.clear();

    // Set up the Legend-NET structure
    setupLegendStructure(sheet);

    // Populate with data from all racks
    populateLegendData(sheet, allRackData);

    // Apply formatting
    formatLegendSheet(sheet);

    return {
      success: true,
      message: 'Legend-NET summary generated successfully'
    };

  } catch (error) {
    Logger.log('Error generating Legend-NET summary: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sets up the Legend-NET structure with headers
 * @param {Sheet} sheet - The Legend-NET sheet
 */
function setupLegendStructure(sheet) {
  var currentRow = 1;

  // Main header
  var headerRange = sheet.getRange(currentRow, 2, 1, 2);
  headerRange.merge();
  headerRange.setValue('Networking Legend');
  applyLegendHeaderFormatting(headerRange);

  currentRow++;

  // Subheader
  var subheaderRange = sheet.getRange(currentRow, 2, 1, 2);
  subheaderRange.merge();
  subheaderRange.setValue('Rack Types');
  applyLegendHeaderFormatting(subheaderRange);

  // Key column header
  var keyHeaderRange = sheet.getRange(currentRow, 4, 1, 1);
  keyHeaderRange.setValue('Rack Type Key');
  applyLegendHeaderFormatting(keyHeaderRange);

  currentRow++;

  return currentRow;
}

/**
 * Populates the Legend-NET with category data
 * @param {Sheet} sheet - The Legend-NET sheet
 * @param {Object} allRackData - All rack data grouped by type
 */
function populateLegendData(sheet, allRackData) {
  var currentRow = 3; // Start after headers

  // Get all items from all racks
  var allItems = getAllItemsFromRacks();

  // Group by main categories (ETH, SPINE, GRID-POD)
  var categoryGroups = groupByMainCategory(allItems);

  // ETH Section
  currentRow = addCategorySection(sheet, currentRow, 'ETH', categoryGroups.ETH || []);

  // SPINE Section
  currentRow = addCategorySection(sheet, currentRow, 'SPINE', categoryGroups.SPINE || []);

  // GRID-POD Section
  currentRow = addCategorySection(sheet, currentRow, 'GRID_POD', categoryGroups.GRID_POD || []);

  // Future Expansion
  currentRow++;
  sheet.getRange(currentRow, 3).setValue('Future Expansion');
  currentRow++;
  sheet.getRange(currentRow, 3).setValue('Future expansion');
}

/**
 * Adds a category section to the Legend
 * @param {Sheet} sheet - The Legend sheet
 * @param {number} startRow - Starting row for this section
 * @param {string} categoryKey - Category key (ETH, SPINE, GRID_POD)
 * @param {Array<Object>} items - Items in this category
 * @return {number} Next available row
 */
function addCategorySection(sheet, startRow, categoryKey, items) {
  var category = LEGEND_CATEGORIES[categoryKey];

  if (!category) return startRow;

  var currentRow = startRow;

  // Group items by subcategory
  var subcategories = {};

  items.forEach(function(item) {
    var subcat = item.itemCategory || 'Other';
    if (!subcategories[subcat]) {
      subcategories[subcat] = [];
    }
    subcategories[subcat].push(item);
  });

  // Add each subcategory
  for (var subcat in subcategories) {
    var subcatItems = subcategories[subcat];

    // Category description
    var descCell = sheet.getRange(currentRow, 3);
    descCell.setValue(category.name + ': "Items description"');

    // Item key
    var keyCell = sheet.getRange(currentRow, 4);
    keyCell.setValue('Item');
    keyCell.setBackground(category.color);

    if (isColorDark(category.color)) {
      keyCell.setFontColor('#FFFFFF');
    } else {
      keyCell.setFontColor('#000000');
    }

    currentRow++;
  }

  // If no items, still show one row
  if (Object.keys(subcategories).length === 0) {
    var descCell = sheet.getRange(currentRow, 3);
    descCell.setValue(category.name + ': "Items description"');

    var keyCell = sheet.getRange(currentRow, 4);
    keyCell.setValue('Item');
    keyCell.setBackground(category.color);

    if (isColorDark(category.color)) {
      keyCell.setFontColor('#FFFFFF');
    } else {
      keyCell.setFontColor('#000000');
    }

    currentRow++;
  }

  // Add totals row
  var totalsCell = sheet.getRange(currentRow, 4);
  totalsCell.setValue('Totals');
  applyTotalsFormatting(totalsCell);

  currentRow++;

  return currentRow;
}

/**
 * Gets all items from all rack sheets
 * @return {Array<Object>} All items across all racks
 */
function getAllItemsFromRacks() {
  var allItems = [];
  var rackSheets = getAllRackSheets();

  rackSheets.forEach(function(sheet) {
    var rackData = getRackSheetData(sheet.getName());
    allItems = allItems.concat(rackData);
  });

  return allItems;
}

/**
 * Groups items by main category (ETH, SPINE, GRID_POD)
 * @param {Array<Object>} items - All items
 * @return {Object} Items grouped by main category
 */
function groupByMainCategory(items) {
  var groups = {
    ETH: [],
    SPINE: [],
    GRID_POD: [],
    OTHER: []
  };

  items.forEach(function(item) {
    var category = (item.itemCategory || '').toUpperCase();

    if (category.indexOf('ETH') !== -1 || category.indexOf('ETHERNET') !== -1) {
      groups.ETH.push(item);
    } else if (category.indexOf('SPINE') !== -1) {
      groups.SPINE.push(item);
    } else if (category.indexOf('GRID') !== -1 || category.indexOf('POD') !== -1) {
      groups.GRID_POD.push(item);
    } else {
      groups.OTHER.push(item);
    }
  });

  return groups;
}

/**
 * Calculates category totals across all racks
 * @param {string} category - Category to calculate totals for
 * @param {Array<Object>} allRackData - All rack data
 * @return {Object} Totals for the category
 */
function calculateCategoryTotals(category, allRackData) {
  var totalQuantity = 0;
  var totalItems = 0;

  allRackData.forEach(function(item) {
    if (item.itemCategory === category) {
      totalQuantity += item.quantity;
      totalItems++;
    }
  });

  return {
    category: category,
    totalQuantity: totalQuantity,
    totalItems: totalItems
  };
}

/**
 * Formats the Legend-NET sheet
 * @param {Sheet} sheet - The Legend sheet
 */
function formatLegendSheet(sheet) {
  // Set column widths
  sheet.setColumnWidth(1, 50);   // Row labels
  sheet.setColumnWidth(2, 300);  // Rack Types header
  sheet.setColumnWidth(3, 400);  // Description
  sheet.setColumnWidth(4, 150);  // Key

  // Auto-resize rows
  var numRows = sheet.getLastRow();
  for (var i = 1; i <= numRows; i++) {
    sheet.setRowHeight(i, 21);
  }

  // Apply borders
  var dataRange = sheet.getDataRange();
  applyBorders(dataRange, false);
}

/**
 * Updates the Legend-NET with current rack data
 * @return {Object} Update result
 */
function updateNetworkingLegend() {
  try {
    var allItems = getAllItemsFromRacks();
    return generateLegendSummary({ items: allItems });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Adds a summary statistics section to the Legend
 * @param {Sheet} sheet - The Legend sheet
 * @param {number} startRow - Starting row
 * @return {number} Next available row
 */
function addSummaryStatistics(sheet, startRow) {
  var currentRow = startRow + 2; // Leave a gap

  // Title
  var titleCell = sheet.getRange(currentRow, 2, 1, 3);
  titleCell.merge();
  titleCell.setValue('Summary Statistics');
  applyLegendHeaderFormatting(titleCell);

  currentRow++;

  // Get all items
  var allItems = getAllItemsFromRacks();

  // Calculate statistics
  var totalQuantity = 0;
  var categoryBreakdown = {};

  allItems.forEach(function(item) {
    totalQuantity += item.quantity;

    var category = item.itemCategory || 'Uncategorized';
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { count: 0, quantity: 0 };
    }
    categoryBreakdown[category].count++;
    categoryBreakdown[category].quantity += item.quantity;
  });

  // Total items
  sheet.getRange(currentRow, 2).setValue('Total Unique Items:');
  sheet.getRange(currentRow, 3).setValue(allItems.length);
  currentRow++;

  // Total quantity
  sheet.getRange(currentRow, 2).setValue('Total Quantity:');
  sheet.getRange(currentRow, 3).setValue(totalQuantity);
  currentRow++;

  // Category breakdown
  currentRow++;
  sheet.getRange(currentRow, 2).setValue('Category Breakdown:');
  sheet.getRange(currentRow, 2).setFontWeight('bold');
  currentRow++;

  for (var category in categoryBreakdown) {
    sheet.getRange(currentRow, 2).setValue(category + ':');
    sheet.getRange(currentRow, 3).setValue(categoryBreakdown[category].count + ' items');
    sheet.getRange(currentRow, 4).setValue('Qty: ' + categoryBreakdown[category].quantity);
    currentRow++;
  }

  return currentRow;
}

/**
 * Clears the Legend-NET sheet
 */
function clearLegendSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LEGEND_NET);

  if (sheet) {
    sheet.clear();
    Logger.log('Cleared Legend-NET sheet');
  }
}

/**
 * Exports Legend data to a structured object
 * @return {Object} Legend data structure
 */
function exportLegendData() {
  var allItems = getAllItemsFromRacks();
  var categoryGroups = groupByMainCategory(allItems);

  var legendData = {
    timestamp: new Date().toISOString(),
    categories: {}
  };

  for (var category in categoryGroups) {
    var items = categoryGroups[category];
    legendData.categories[category] = {
      itemCount: items.length,
      totalQuantity: items.reduce(function(sum, item) {
        return sum + item.quantity;
      }, 0),
      items: items
    };
  }

  return legendData;
}

/**
 * Generates a text summary of the Legend data
 * @return {string} Text summary
 */
function generateLegendTextSummary() {
  var legendData = exportLegendData();
  var summary = 'Legend-NET Summary\n';
  summary += 'Generated: ' + legendData.timestamp + '\n\n';

  for (var category in legendData.categories) {
    var catData = legendData.categories[category];
    summary += category + ':\n';
    summary += '  Items: ' + catData.itemCount + '\n';
    summary += '  Total Quantity: ' + catData.totalQuantity + '\n\n';
  }

  return summary;
}
