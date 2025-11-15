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
 * Creates a new sheet with consolidated BOM from overview layout
 * Scans overview sheet for rack placements and builds hierarchical BOM
 */
function createConsolidatedBOMSheet() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Find overview sheet (look for sheet with "overview" in name)
  var allSheets = spreadsheet.getSheets();
  var overviewSheet = null;

  for (var i = 0; i < allSheets.length; i++) {
    var sheetName = allSheets[i].getName().toLowerCase();
    if (sheetName.indexOf('overview') !== -1) {
      overviewSheet = allSheets[i];
      break;
    }
  }

  if (!overviewSheet) {
    ui.alert('No Overview Sheet',
      'Could not find an Overview sheet.\n\n' +
      'Please create an overview layout sheet first.',
      ui.ButtonSet.OK);
    return;
  }

  Logger.log('Using overview sheet: ' + overviewSheet.getName());

  // Build consolidated BOM from overview
  try {
    ui.alert('Building Consolidated BOM',
      'Scanning overview layout and rack configurations...\nThis may take a moment.',
      ui.ButtonSet.OK);

    var bomData = buildConsolidatedBOMFromOverview(overviewSheet);

    if (!bomData || bomData.lines.length === 0) {
      ui.alert('No Data',
        'No BOM data could be generated from the overview.\n\n' +
        'Make sure:\n' +
        '1. Overview sheet has rack items placed\n' +
        '2. Rack configuration tabs exist for those racks\n' +
        '3. Rack configs have child items',
        ui.ButtonSet.OK);
      return;
    }

    // Create new sheet
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var newSheetName = 'Consolidated BOM';
    var existingSheet = spreadsheet.getSheetByName(newSheetName);

    if (existingSheet) {
      spreadsheet.deleteSheet(existingSheet);
    }

    var newSheet = spreadsheet.insertSheet(newSheetName);

    // Add summary header
    newSheet.getRange(1, 1).setValue('Consolidated BOM');
    newSheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');

    newSheet.getRange(2, 1).setValue('Generated: ' + timestamp);
    newSheet.getRange(3, 1).setValue('Overview Sheet: ' + overviewSheet.getName());
    newSheet.getRange(4, 1).setValue('Total Items: ' + bomData.totalUniqueItems);
    newSheet.getRange(5, 1).setValue('Total Racks: ' + bomData.totalRacks);

    // Column headers (starting at row 7)
    var headers = ['Level', 'Item Number', 'Name', 'Description', 'Quantity', 'Category'];
    newSheet.getRange(7, 1, 1, headers.length).setValues([headers]);
    newSheet.getRange(7, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    // Write BOM data
    var rowData = [];
    bomData.lines.forEach(function(line) {
      rowData.push([
        line.level,
        line.itemNumber,
        line.name,
        line.description,
        line.quantity,
        line.category
      ]);
    });

    if (rowData.length > 0) {
      newSheet.getRange(8, 1, rowData.length, headers.length).setValues(rowData);

      // Apply category colors
      for (var i = 0; i < rowData.length; i++) {
        var category = rowData[i][5];
        var color = getCategoryColor(category);
        if (color) {
          newSheet.getRange(i + 8, 1, 1, headers.length).setBackground(color);
        }
      }

      // Format level column with indentation
      for (var i = 0; i < rowData.length; i++) {
        var level = rowData[i][0];
        var itemNumberCell = newSheet.getRange(i + 8, 2);
        var currentValue = itemNumberCell.getValue();
        var indent = '  '.repeat(level);
        itemNumberCell.setValue(indent + currentValue);
      }
    }

    // Format sheet
    newSheet.setFrozenRows(7);
    newSheet.setColumnWidth(1, 60);   // Level
    newSheet.setColumnWidth(2, 150);  // Item Number
    newSheet.setColumnWidth(3, 250);  // Name
    newSheet.setColumnWidth(4, 300);  // Description
    newSheet.setColumnWidth(5, 80);   // Quantity
    newSheet.setColumnWidth(6, 150);  // Category

    // Add borders
    newSheet.getRange(7, 1, rowData.length + 1, headers.length)
      .setBorder(true, true, true, true, true, true);

    // Show success message
    ui.alert('Success!',
      'Consolidated BOM created successfully!\n\n' +
      'Total unique items: ' + bomData.totalUniqueItems + '\n' +
      'Total rack instances: ' + bomData.totalRacks + '\n' +
      'BOM lines: ' + bomData.lines.length,
      ui.ButtonSet.OK);

    // Activate the new sheet
    newSheet.activate();

  } catch (error) {
    Logger.log('Error creating consolidated BOM: ' + error.message + '\n' + error.stack);
    ui.alert('Error',
      'Failed to create consolidated BOM:\n\n' + error.message,
      ui.ButtonSet.OK);
  }
}

/**
 * Builds consolidated BOM data from overview sheet
 * Scans for rack placements, looks up rack configs, multiplies quantities
 * @param {Sheet} overviewSheet - The overview/layout sheet
 * @return {Object} BOM data with lines array and stats
 */
function buildConsolidatedBOMFromOverview(overviewSheet) {
  var hierarchy = getBOMHierarchy();
  var arenaClient = new ArenaAPIClient();

  // Step 1: Scan overview sheet for all rack placements
  Logger.log('Step 1: Scanning overview sheet for rack placements...');
  var rackPlacements = scanOverviewForRacks(overviewSheet);

  Logger.log('Found ' + Object.keys(rackPlacements).length + ' unique rack types');
  Logger.log('Total rack instances: ' + getTotalRackCount(rackPlacements));

  if (Object.keys(rackPlacements).length === 0) {
    throw new Error('No rack items found in overview sheet');
  }

  // Step 2: For each unique rack, get its configuration and children
  Logger.log('Step 2: Loading rack configurations and children...');
  var consolidatedItems = {};  // Map: itemNumber => {item data, total quantity}

  for (var rackItemNumber in rackPlacements) {
    var rackCount = rackPlacements[rackItemNumber];
    Logger.log('Processing rack: ' + rackItemNumber + ' (count: ' + rackCount + ')');

    // Find rack config tab
    var rackConfigSheet = findRackConfigTab(rackItemNumber);

    if (!rackConfigSheet) {
      Logger.log('WARNING: No rack config found for ' + rackItemNumber + ', skipping');
      continue;
    }

    // Get all children from rack config
    var children = getRackConfigChildren(rackConfigSheet);
    Logger.log('  Found ' + children.length + ' children in rack config');

    // Add rack itself to consolidated BOM
    var rackMetadata = getRackConfigMetadata(rackConfigSheet);
    if (!consolidatedItems[rackItemNumber]) {
      consolidatedItems[rackItemNumber] = {
        itemNumber: rackItemNumber,
        name: rackMetadata.itemName,
        description: rackMetadata.description,
        category: '', // Will fetch from Arena
        quantity: 0,
        level: 2  // Rack level (will be adjusted based on hierarchy config)
      };
    }
    consolidatedItems[rackItemNumber].quantity += rackCount;

    // Add children with multiplied quantities
    children.forEach(function(child) {
      var totalChildQty = child.quantity * rackCount;

      if (!consolidatedItems[child.itemNumber]) {
        consolidatedItems[child.itemNumber] = {
          itemNumber: child.itemNumber,
          name: child.name,
          description: child.description,
          category: child.category,
          quantity: 0,
          level: 3  // Child level (will be adjusted)
        };
      }

      consolidatedItems[child.itemNumber].quantity += totalChildQty;
    });
  }

  // Step 3: Fetch additional details from Arena and apply hierarchy levels
  Logger.log('Step 3: Fetching item details from Arena and applying hierarchy...');
  var bomLines = [];

  for (var itemNumber in consolidatedItems) {
    var item = consolidatedItems[itemNumber];

    // Fetch from Arena if category not set
    if (!item.category) {
      try {
        var arenaItem = arenaClient.getItemByNumber(itemNumber);
        if (arenaItem) {
          var categoryObj = arenaItem.category || arenaItem.Category || {};
          item.category = categoryObj.name || categoryObj.Name || '';
          if (!item.name) item.name = arenaItem.name || arenaItem.Name || '';
          if (!item.description) item.description = arenaItem.description || arenaItem.Description || '';
        }
      } catch (error) {
        Logger.log('Could not fetch details for ' + itemNumber + ': ' + error.message);
      }
    }

    // Determine BOM level based on category → level mapping
    var bomLevel = getBOMLevelForCategory(item.category, hierarchy);
    if (bomLevel !== null) {
      item.level = bomLevel;
    }

    bomLines.push(item);
  }

  // Step 4: Sort by level, then category, then item number
  bomLines.sort(function(a, b) {
    if (a.level !== b.level) return a.level - b.level;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.itemNumber.localeCompare(b.itemNumber);
  });

  Logger.log('Built consolidated BOM with ' + bomLines.length + ' unique items');

  return {
    lines: bomLines,
    totalUniqueItems: bomLines.length,
    totalRacks: getTotalRackCount(rackPlacements),
    sourceSheet: overviewSheet.getName()
  };
}

/**
 * Scans overview sheet for rack item placements
 * @param {Sheet} sheet - Overview sheet
 * @return {Object} Map of rack item numbers to instance counts
 */
function scanOverviewForRacks(sheet) {
  var data = sheet.getDataRange().getValues();
  var rackPlacements = {};

  // Scan all cells for rack item numbers
  for (var row = 0; row < data.length; row++) {
    for (var col = 0; col < data[row].length; col++) {
      var cellValue = data[row][col];

      if (!cellValue || typeof cellValue !== 'string') continue;

      var itemNumber = cellValue.trim();

      // Skip empty cells and headers
      if (!itemNumber || itemNumber.length === 0) continue;

      // Check if this is a rack item (has a rack config tab)
      if (findRackConfigTab(itemNumber)) {
        if (rackPlacements[itemNumber]) {
          rackPlacements[itemNumber]++;
        } else {
          rackPlacements[itemNumber] = 1;
        }
      }
    }
  }

  return rackPlacements;
}

/**
 * Gets total count of all rack instances
 * @param {Object} rackPlacements - Map of rack items to counts
 * @return {number} Total count
 */
function getTotalRackCount(rackPlacements) {
  var total = 0;
  for (var rackItem in rackPlacements) {
    total += rackPlacements[rackItem];
  }
  return total;
}

/**
 * Determines BOM level for a given category based on hierarchy configuration
 * @param {string} categoryName - Category name
 * @param {Array} hierarchy - BOM hierarchy configuration
 * @return {number|null} Level number or null if not found
 */
function getBOMLevelForCategory(categoryName, hierarchy) {
  if (!categoryName || !hierarchy) return null;

  for (var i = 0; i < hierarchy.length; i++) {
    if (hierarchy[i].category === categoryName || hierarchy[i].name === categoryName) {
      return hierarchy[i].level;
    }
  }

  return null;
}

/**
 * Pushes the consolidated BOM to Arena
 * Allows user to update existing item or create new
 */
function pushConsolidatedBOMToArena() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Find the consolidated BOM sheet
  var bomSheet = spreadsheet.getSheetByName('Consolidated BOM');

  if (!bomSheet) {
    ui.alert('No Consolidated BOM',
      'Could not find a "Consolidated BOM" sheet.\n\n' +
      'Please create a consolidated BOM first using:\n' +
      'BOM Operations → Create Consolidated BOM',
      ui.ButtonSet.OK);
    return;
  }

  // Ask user: Update existing or create new?
  var response = ui.alert('Push BOM to Arena',
    'Do you want to UPDATE an existing item or CREATE a new item?\n\n' +
    'Yes = Update existing item\n' +
    'No = Create new item',
    ui.ButtonSet.YES_NO_CANCEL);

  if (response === ui.Button.CANCEL) {
    return;
  }

  var updateExisting = (response === ui.Button.YES);
  var parentItemNumber;
  var parentGuid;
  var client = new ArenaAPIClient();

  try {
    if (updateExisting) {
      // Prompt for existing item number
      var itemResponse = ui.prompt('Update Existing Item',
        'Enter the Arena item number to update:',
        ui.ButtonSet.OK_CANCEL);

      if (itemResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      parentItemNumber = itemResponse.getResponseText().trim();

      if (!parentItemNumber) {
        ui.alert('Error', 'Item number cannot be empty.', ui.ButtonSet.OK);
        return;
      }

      // Find the item in Arena
      var item = client.getItemByNumber(parentItemNumber);

      if (!item) {
        ui.alert('Item Not Found',
          'Item "' + parentItemNumber + '" not found in Arena.\n\n' +
          'Please check the item number and try again.',
          ui.ButtonSet.OK);
        return;
      }

      parentGuid = item.guid || item.Guid;
      Logger.log('Found existing item: ' + parentItemNumber + ' (' + parentGuid + ')');

    } else {
      // Create new item
      var newItemResponse = ui.prompt('Create New Item',
        'Enter details for the new parent item:\n\n' +
        'Item Number (or leave blank for auto-generation):',
        ui.ButtonSet.OK_CANCEL);

      if (newItemResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      var newItemNumber = newItemResponse.getResponseText().trim();

      var nameResponse = ui.prompt('Create New Item',
        'Enter the item name:',
        ui.ButtonSet.OK_CANCEL);

      if (nameResponse.getSelectedButton() !== ui.Button.OK) {
        return;
      }

      var newItemName = nameResponse.getResponseText().trim();

      if (!newItemName) {
        ui.alert('Error', 'Item name is required.', ui.ButtonSet.OK);
        return;
      }

      // Get category for new item (use first level from hierarchy or ask)
      var hierarchy = getBOMHierarchy();
      var defaultCategory = hierarchy.length > 0 ? hierarchy[0].category : '';

      // Create the item
      Logger.log('Creating new item in Arena...');
      var newItemData = {
        name: newItemName
      };

      if (newItemNumber) {
        newItemData.number = newItemNumber;
      }

      if (defaultCategory) {
        newItemData.category = defaultCategory;
      }

      var createdItem = client.createItem(newItemData);

      parentGuid = createdItem.guid || createdItem.Guid;
      parentItemNumber = createdItem.number || createdItem.Number;

      Logger.log('Created new item: ' + parentItemNumber + ' (' + parentGuid + ')');
    }

    // Read BOM data from sheet
    Logger.log('Reading BOM data from sheet...');
    var bomLines = readBOMFromSheet(bomSheet);

    if (bomLines.length === 0) {
      ui.alert('No Data',
        'No BOM lines found in the consolidated BOM sheet.',
        ui.ButtonSet.OK);
      return;
    }

    // Confirm before pushing
    var confirmResponse = ui.alert('Confirm Push',
      'Ready to push BOM to Arena:\n\n' +
      'Parent Item: ' + parentItemNumber + '\n' +
      'BOM Lines: ' + bomLines.length + '\n\n' +
      (updateExisting ? 'This will DELETE the existing BOM and replace it.\n\n' : '') +
      'Continue?',
      ui.ButtonSet.YES_NO);

    if (confirmResponse !== ui.Button.YES) {
      ui.alert('Cancelled', 'BOM push cancelled.', ui.ButtonSet.OK);
      return;
    }

    // Push to Arena
    Logger.log('Pushing BOM to Arena...');
    syncBOMToArena(client, parentGuid, bomLines);

    ui.alert('Success!',
      'BOM pushed successfully to Arena!\n\n' +
      'Parent Item: ' + parentItemNumber + '\n' +
      'BOM Lines: ' + bomLines.length + '\n\n' +
      'You can view the BOM in Arena PLM.',
      ui.ButtonSet.OK);

  } catch (error) {
    Logger.log('Error pushing BOM to Arena: ' + error.message + '\n' + error.stack);
    ui.alert('Error',
      'Failed to push BOM to Arena:\n\n' + error.message,
      ui.ButtonSet.OK);
  }
}

/**
 * Reads BOM data from a consolidated BOM sheet
 * @param {Sheet} sheet - Consolidated BOM sheet
 * @return {Array} Array of BOM line objects
 */
function readBOMFromSheet(sheet) {
  var data = sheet.getDataRange().getValues();
  var bomLines = [];

  // Find header row (look for row with "Level", "Item Number", etc.)
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] === 'Level' || row[1] === 'Item Number') {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error('Could not find header row in BOM sheet');
  }

  var headers = data[headerRow];
  var levelCol = headers.indexOf('Level');
  var itemNumberCol = headers.indexOf('Item Number');
  var qtyCol = headers.indexOf('Quantity');

  if (itemNumberCol === -1) {
    throw new Error('Could not find "Item Number" column');
  }

  // Read data rows (skip header and any summary rows before it)
  for (var i = headerRow + 1; i < data.length; i++) {
    var row = data[i];
    var itemNumber = row[itemNumberCol];

    // Skip empty rows
    if (!itemNumber || typeof itemNumber !== 'string') continue;

    // Remove indentation
    itemNumber = itemNumber.toString().replace(/^\s+/, '').trim();

    if (!itemNumber) continue;

    var level = levelCol !== -1 ? (row[levelCol] || 0) : 0;
    var quantity = qtyCol !== -1 ? (row[qtyCol] || 1) : 1;

    bomLines.push({
      level: parseInt(level, 10),
      itemNumber: itemNumber,
      quantity: parseFloat(quantity)
    });
  }

  Logger.log('Read ' + bomLines.length + ' BOM lines from sheet');
  return bomLines;
}
