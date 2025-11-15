/**
 * BOM Builder
 * Handles building, pushing, and pulling Bills of Materials between Google Sheets and Arena
 */

/**
 * Pulls a BOM from Arena and populates the current sheet
 * @param {string} itemNumber - Arena item number to pull BOM for
 * @return {Object} Result object with success status and message
 */
function pullBOM(itemNumber) {
  try {
    var client = new ArenaAPIClient();

    // Find the item by number
    var searchResults = client.searchItems(itemNumber);
    var items = searchResults.results || searchResults.Results || [];

    if (items.length === 0) {
      throw new Error('Item not found: ' + itemNumber);
    }

    var item = items[0];
    var itemGuid = item.guid || item.Guid;

    Logger.log('Found item: ' + itemNumber + ' (GUID: ' + itemGuid + ')');

    // Get the BOM for this item
    var bomData = client.makeRequest('/items/' + itemGuid + '/bom', { method: 'GET' });
    var bomLines = bomData.results || bomData.Results || [];

    Logger.log('Retrieved ' + bomLines.length + ' BOM lines');

    // Get the active sheet
    var sheet = SpreadsheetApp.getActiveSheet();

    // Clear existing data (except headers)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
    }

    // Populate the sheet with BOM data
    populateBOMToSheet(sheet, bomLines, item);

    return {
      success: true,
      message: 'Successfully pulled BOM for ' + itemNumber + '\n' + bomLines.length + ' components imported'
    };

  } catch (error) {
    Logger.log('Error pulling BOM: ' + error.message);
    throw error;
  }
}

/**
 * Populates a sheet with BOM data from Arena
 * @param {Sheet} sheet - The sheet to populate
 * @param {Array} bomLines - Array of BOM line objects from Arena
 * @param {Object} parentItem - The parent item object
 */
function populateBOMToSheet(sheet, bomLines, parentItem) {
  var hierarchy = getBOMHierarchy();
  var columns = getItemColumns();
  var categoryColors = getCategoryColors();

  // Set up headers if not already present
  var headers = ['Level', 'Qty', 'Item Number', 'Item Name', 'Category'];

  // Add configured attribute columns
  columns.forEach(function(col) {
    headers.push(col.header || col.attributeName);
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f0f0f0');

  // Process BOM lines
  var rowData = [];

  bomLines.forEach(function(line) {
    var item = line.item || line.Item;
    var quantity = line.quantity || line.Quantity || 1;
    var level = line.level || line.Level || 0;

    var itemNumber = item.number || item.Number || '';
    var itemName = item.name || item.Name || item.description || item.Description || '';
    var categoryName = item.category ? (item.category.name || item.category.Name) : '';

    var row = [
      level,
      quantity,
      itemNumber,
      itemName,
      categoryName
    ];

    // Add configured attributes
    columns.forEach(function(col) {
      var value = getAttributeValue(item, col.attributeGuid);
      row.push(value || '');
    });

    rowData.push(row);
  });

  // Write data to sheet
  if (rowData.length > 0) {
    sheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);

    // Apply formatting
    formatBOMSheet(sheet, rowData.length + 1);
  }

  // Auto-resize columns
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Formats a BOM sheet with colors and indentation
 * @param {Sheet} sheet - The sheet to format
 * @param {number} lastRow - The last row with data
 */
function formatBOMSheet(sheet, lastRow) {
  var categoryColors = getCategoryColors();

  // Apply category colors to rows
  for (var row = 2; row <= lastRow; row++) {
    var level = sheet.getRange(row, 1).getValue();
    var category = sheet.getRange(row, 5).getValue();

    // Apply indentation based on level
    var itemNumberCell = sheet.getRange(row, 3);
    var currentValue = itemNumberCell.getValue();
    var indent = '  '.repeat(level);
    itemNumberCell.setValue(indent + currentValue);

    // Apply category color
    var color = getCategoryColor(category);
    if (color) {
      sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(color);
    }
  }

  // Freeze header row
  sheet.setFrozenRows(1);
}

/**
 * Pushes the current sheet BOM to Arena
 * @param {boolean} createNew - If true, creates a new parent item; if false, updates existing
 * @return {Object} Result object with success status and message
 */
function pushBOM() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();

    // Build BOM structure from sheet
    var bomStructure = buildBOMStructure(sheet);

    if (!bomStructure || bomStructure.lines.length === 0) {
      throw new Error('No BOM data found in sheet');
    }

    // Prompt user for parent item
    var ui = SpreadsheetApp.getUi();
    var response = ui.prompt(
      'Push BOM to Arena',
      'Enter the parent item number (or leave blank to create new):',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) {
      return { success: false, message: 'Cancelled by user' };
    }

    var parentItemNumber = response.getResponseText().trim();

    var client = new ArenaAPIClient();
    var parentGuid;
    var createNew = !parentItemNumber;

    if (createNew) {
      // Create new parent item
      var newItemResponse = ui.prompt(
        'Create New Item',
        'Enter name for new parent item:',
        ui.ButtonSet.OK_CANCEL
      );

      if (newItemResponse.getSelectedButton() !== ui.Button.OK) {
        return { success: false, message: 'Cancelled by user' };
      }

      var newItemName = newItemResponse.getResponseText().trim();
      if (!newItemName) {
        throw new Error('Item name is required');
      }

      // Create the parent item in Arena
      var newItem = client.createItem({
        name: newItemName,
        category: bomStructure.rootCategory
      });

      parentGuid = newItem.guid || newItem.Guid;
      parentItemNumber = newItem.number || newItem.Number;

      Logger.log('Created new parent item: ' + parentItemNumber);

    } else {
      // Find existing parent item
      var searchResults = client.searchItems(parentItemNumber);
      var items = searchResults.results || searchResults.Results || [];

      if (items.length === 0) {
        throw new Error('Parent item not found: ' + parentItemNumber);
      }

      parentGuid = items[0].guid || items[0].Guid;
      Logger.log('Found parent item: ' + parentItemNumber);
    }

    // Push BOM lines to Arena
    syncBOMToArena(client, parentGuid, bomStructure.lines);

    return {
      success: true,
      message: 'Successfully pushed BOM to ' + parentItemNumber + '\n' +
               bomStructure.lines.length + ' components uploaded'
    };

  } catch (error) {
    Logger.log('Error pushing BOM: ' + error.message);
    throw error;
  }
}

/**
 * Builds a BOM structure from the current sheet layout
 * @param {Sheet} sheet - The sheet containing BOM data
 * @return {Object} BOM structure with lines array
 */
function buildBOMStructure(sheet) {
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return { lines: [], rootCategory: null };
  }

  var headers = data[0];
  var lines = [];
  var rootCategory = null;

  // Find column indices
  var levelCol = headers.indexOf('Level');
  var qtyCol = headers.indexOf('Qty');
  var itemNumberCol = headers.indexOf('Item Number');
  var categoryCol = headers.indexOf('Category');

  if (itemNumberCol === -1) {
    // Try alternate column names
    itemNumberCol = headers.findIndex(function(h) {
      return h.toLowerCase().indexOf('item') !== -1 && h.toLowerCase().indexOf('number') !== -1;
    });
  }

  if (itemNumberCol === -1) {
    throw new Error('Could not find Item Number column in sheet');
  }

  // Process each row (skip header)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var itemNumber = row[itemNumberCol];

    // Skip empty rows
    if (!itemNumber || itemNumber.toString().trim() === '') {
      continue;
    }

    // Remove indentation from item number
    itemNumber = itemNumber.toString().replace(/^\s+/, '');

    var level = levelCol !== -1 ? (row[levelCol] || 0) : 0;
    var quantity = qtyCol !== -1 ? (row[qtyCol] || 1) : 1;
    var category = categoryCol !== -1 ? row[categoryCol] : '';

    // Track root category
    if (level === 0 && !rootCategory) {
      rootCategory = category;
    }

    lines.push({
      level: parseInt(level, 10),
      itemNumber: itemNumber,
      quantity: parseFloat(quantity),
      category: category
    });
  }

  return {
    lines: lines,
    rootCategory: rootCategory
  };
}

/**
 * Syncs BOM lines to Arena
 * @param {ArenaAPIClient} client - Arena API client
 * @param {string} parentGuid - Parent item GUID
 * @param {Array} bomLines - Array of BOM line objects
 */
function syncBOMToArena(client, parentGuid, bomLines) {
  // First, get existing BOM lines for this item
  var existingBOM = [];
  try {
    var bomData = client.makeRequest('/items/' + parentGuid + '/bom', { method: 'GET' });
    existingBOM = bomData.results || bomData.Results || [];
  } catch (error) {
    Logger.log('No existing BOM found (this is OK for new items)');
  }

  // Delete existing BOM lines
  if (existingBOM.length > 0) {
    Logger.log('Deleting ' + existingBOM.length + ' existing BOM lines...');

    existingBOM.forEach(function(line) {
      var lineGuid = line.guid || line.Guid;
      try {
        client.makeRequest('/items/' + parentGuid + '/bom/' + lineGuid, { method: 'DELETE' });
      } catch (deleteError) {
        Logger.log('Error deleting BOM line: ' + deleteError.message);
      }
    });
  }

  // Add new BOM lines
  Logger.log('Adding ' + bomLines.length + ' BOM lines...');

  bomLines.forEach(function(line, index) {
    try {
      // Find the item by number
      var searchResults = client.searchItems(line.itemNumber);
      var items = searchResults.results || searchResults.Results || [];

      if (items.length === 0) {
        Logger.log('Warning: Item not found in Arena: ' + line.itemNumber);
        return;
      }

      var itemGuid = items[0].guid || items[0].Guid;

      // Create BOM line
      var bomLineData = {
        item: {
          guid: itemGuid
        },
        quantity: line.quantity,
        level: line.level,
        lineNumber: index + 1
      };

      client.makeRequest('/items/' + parentGuid + '/bom', {
        method: 'POST',
        payload: bomLineData
      });

      Logger.log('Added BOM line ' + (index + 1) + ': ' + line.itemNumber);

      // Add delay to avoid rate limiting
      Utilities.sleep(100);

    } catch (error) {
      Logger.log('Error adding BOM line for ' + line.itemNumber + ': ' + error.message);
    }
  });
}

/**
 * Calculates aggregated quantities across multiple sheets/configurations
 * @param {Array<string>} sheetNames - Array of sheet names to aggregate
 * @return {Object} Map of item numbers to total quantities
 */
function aggregateQuantities(sheetNames) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var quantities = {};

  sheetNames.forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('Warning: Sheet not found: ' + sheetName);
      return;
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    // Find columns
    var itemNumberCol = headers.findIndex(function(h) {
      return h.toLowerCase().indexOf('item') !== -1 && h.toLowerCase().indexOf('number') !== -1;
    });

    var qtyCol = headers.indexOf('Qty');

    if (itemNumberCol === -1) {
      Logger.log('Warning: Item Number column not found in sheet: ' + sheetName);
      return;
    }

    // Process rows
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var itemNumber = row[itemNumberCol];
      var qty = qtyCol !== -1 ? (row[qtyCol] || 1) : 1;

      if (!itemNumber || itemNumber.toString().trim() === '') {
        continue;
      }

      // Remove indentation
      itemNumber = itemNumber.toString().replace(/^\s+/, '').trim();

      if (quantities[itemNumber]) {
        quantities[itemNumber] += parseFloat(qty);
      } else {
        quantities[itemNumber] = parseFloat(qty);
      }
    }
  });

  return quantities;
}

/**
 * Creates a consolidated BOM from multiple rack configurations
 * @param {Array<string>} rackSheetNames - Array of rack sheet names
 * @return {Object} Result with consolidated BOM data
 */
function consolidateBOM(rackSheetNames) {
  try {
    var quantities = aggregateQuantities(rackSheetNames);

    // Get item details from Arena
    var client = new ArenaAPIClient();
    var consolidatedLines = [];

    for (var itemNumber in quantities) {
      try {
        var searchResults = client.searchItems(itemNumber);
        var items = searchResults.results || searchResults.Results || [];

        if (items.length > 0) {
          var item = items[0];
          consolidatedLines.push({
            itemNumber: itemNumber,
            itemName: item.name || item.Name || '',
            category: item.category ? (item.category.name || item.category.Name) : '',
            totalQuantity: quantities[itemNumber]
          });
        } else {
          // Item not found in Arena, still include it
          consolidatedLines.push({
            itemNumber: itemNumber,
            itemName: 'Unknown',
            category: 'Unknown',
            totalQuantity: quantities[itemNumber]
          });
        }

        Utilities.sleep(50); // Avoid rate limiting

      } catch (error) {
        Logger.log('Error fetching item details for ' + itemNumber + ': ' + error.message);
      }
    }

    // Sort by category, then item number
    consolidatedLines.sort(function(a, b) {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.itemNumber.localeCompare(b.itemNumber);
    });

    return {
      success: true,
      lines: consolidatedLines,
      totalItems: consolidatedLines.length,
      sourceSheets: rackSheetNames
    };

  } catch (error) {
    Logger.log('Error consolidating BOM: ' + error.message);
    throw error;
  }
}

/**
 * Creates a new sheet with consolidated BOM from selected rack sheets
 */
function createConsolidatedBOMSheet() {
  var ui = SpreadsheetApp.getUi();

  // Get all rack sheet names (sheets with "Rack" in the name)
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets();
  var rackSheets = [];

  allSheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.toLowerCase().indexOf('rack') !== -1 ||
        name.toLowerCase().indexOf('full') !== -1) {
      rackSheets.push(name);
    }
  });

  if (rackSheets.length === 0) {
    ui.alert('No Racks Found', 'No rack sheets found to consolidate.', ui.ButtonSet.OK);
    return;
  }

  // Show progress
  ui.alert('Consolidating BOM',
    'Consolidating ' + rackSheets.length + ' rack sheets...\nThis may take a moment.',
    ui.ButtonSet.OK);

  try {
    var consolidated = consolidateBOM(rackSheets);

    // Create new sheet for consolidated BOM
    var newSheetName = 'Consolidated BOM';
    var existingSheet = spreadsheet.getSheetByName(newSheetName);
    if (existingSheet) {
      spreadsheet.deleteSheet(existingSheet);
    }

    var newSheet = spreadsheet.insertSheet(newSheetName);

    // Write headers
    var headers = ['Item Number', 'Item Name', 'Category', 'Total Quantity', 'Source Sheets'];
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');

    // Write data
    var rowData = [];
    consolidated.lines.forEach(function(line) {
      rowData.push([
        line.itemNumber,
        line.itemName,
        line.category,
        line.totalQuantity,
        rackSheets.join(', ')
      ]);
    });

    if (rowData.length > 0) {
      newSheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);

      // Apply category colors
      var categoryColors = getCategoryColors();
      for (var i = 0; i < rowData.length; i++) {
        var category = rowData[i][2];
        var color = getCategoryColor(category);
        if (color) {
          newSheet.getRange(i + 2, 1, 1, headers.length).setBackground(color);
        }
      }
    }

    // Format
    newSheet.setFrozenRows(1);
    for (var col = 1; col <= headers.length; col++) {
      newSheet.autoResizeColumn(col);
    }

    ui.alert('Success',
      'Consolidated BOM created!\n\n' +
      'Total unique items: ' + consolidated.totalItems + '\n' +
      'Source sheets: ' + rackSheets.length,
      ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Error', 'Failed to consolidate BOM: ' + error.message, ui.ButtonSet.OK);
  }
}
