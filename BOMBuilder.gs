/**
 * BOM Builder
 * Handles building, pushing, and pulling Bills of Materials between Google Sheets and Arena
 *
 * NOTE: This file contains many hardcoded "POD", "Row", "Rack" references that should be
 * replaced with dynamic hierarchy level names for full generic support. Current implementation
 * works for migrated datacenter users but needs additional refactoring for complete customization.
 */

// Helper function to get dynamic hierarchy level name
function _getBOMHierarchyName(level) {
  try {
    return getHierarchyLevelName(level);
  } catch (e) {
    // Fallback to defaults if configuration not loaded
    var fallbacks = ['POD', 'Row', 'Rack'];
    return fallbacks[level] || 'Level ' + level;
  }
}

/**
 * Translates raw Arena API errors into user-friendly messages.
 * Use for ui.alert() calls; keep raw messages in Logger.log().
 */
function _getFriendlyApiError(error) {
  var msg = error ? (error.message || String(error)) : 'Unknown error';
  if (msg.indexOf('HTTP 403') !== -1) return 'Access denied — check your Arena permissions for this item.';
  if (msg.indexOf('HTTP 404') !== -1) return 'Item not found in Arena — it may have been deleted or the number is incorrect.';
  if (msg.indexOf('HTTP 401') !== -1) return 'Session expired — please re-authenticate via the Arena menu.';
  if (msg.indexOf('HTTP 429') !== -1) return 'Arena API rate limit reached — please wait a moment and try again.';
  if (msg.indexOf('HTTP 5') !== -1) return 'Arena server error — please try again. If this persists, contact Arena support.';
  return 'Arena error: ' + msg;
}

/**
 * Finds overview sheet by checking the title in cell A1
 * Instead of looking for "overview" in sheet name, checks for "Overview" in the header
 * This allows users to name sheets anything they want (e.g., "Boston Restaurant")
 * @return {Sheet} Overview sheet or null if not found
 */
function findOverviewSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets();

  // Primary: match by tab name — reliable even after we write POD info to A1
  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    if (sheet.getName().toLowerCase().indexOf('overview') !== -1) {
      Logger.log('Found overview sheet by name: ' + sheet.getName());
      return sheet;
    }
  }

  // Fallback: legacy A1-content check (original behaviour, kept for edge cases)
  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    try {
      var headerValue = sheet.getRange(1, 1).getValue();
      if (headerValue && typeof headerValue === 'string') {
        if (headerValue.toLowerCase().indexOf('overview') !== -1) {
          Logger.log('Found overview sheet by A1 content: ' + sheet.getName() + ' (A1: "' + headerValue + '")');
          return sheet;
        }
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Pulls a BOM from Arena and populates the current sheet
 * @param {string} itemNumber - Arena item number to pull BOM for
 * @return {Object} Result object with success status and message
 */
function pullBOM(itemNumber) {
  try {
    var client = getArenaClient();

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
    var bomLines = client.getBOMLines(itemGuid);

    Logger.log('Retrieved ' + bomLines.length + ' BOM lines');

    // Get the active sheet
    var sheet = SpreadsheetApp.getActiveSheet();

    // Confirm before clearing existing BOM data
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var ui = SpreadsheetApp.getUi();
      var confirmed = ui.alert(
        'Clear BOM',
        'This will remove all current BOM items. This action cannot be undone. Continue?',
        ui.ButtonSet.YES_NO
      );
      if (confirmed !== ui.Button.YES) {
        Logger.log('BOM clear cancelled by user');
        return;
      }
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

    var client = getArenaClient();
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
      // Validate parent item exists before attempting BOM operation
      var parentItem = client.getItemByNumber(parentItemNumber);
      if (!parentItem) {
        throw new Error('Cannot create/update BOM: parent item "' + parentItemNumber + '" not found in Arena. Please verify the item number.');
      }

      parentGuid = parentItem.guid || parentItem.Guid;
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
 * @param {Array} bomLines - Array of BOM line objects with itemGuid and itemNumber
 */
/**
 * Syncs BOM lines to Arena (creates/updates BOM for a parent item)
 * @param {ArenaAPIClient} client - Arena API client
 * @param {string} parentGuid - Parent item GUID
 * @param {Array} bomLines - Array of BOM line objects {itemNumber, itemGuid, quantity, level, attributes}
 * @param {Object} options - Optional configuration {bomAttributes: {itemNumber: attributeValue}}
 */
function syncBOMToArena(client, parentGuid, bomLines, options) {
  options = options || {};
  var bomAttributes = options.bomAttributes || {};

  // Input validation - fail fast if critical data is missing
  if (!client) {
    throw new Error('syncBOMToArena: ArenaAPIClient is required');
  }
  if (!parentGuid) {
    throw new Error('syncBOMToArena: Parent item GUID is required');
  }
  if (!bomLines || !Array.isArray(bomLines)) {
    throw new Error('syncBOMToArena: bomLines must be an array');
  }

  // Validate all BOM lines have required fields before proceeding
  Logger.log('Validating ' + bomLines.length + ' BOM lines before sync...');
  var validationErrors = [];

  for (var i = 0; i < bomLines.length; i++) {
    var line = bomLines[i];
    var lineRef = 'BOM line ' + (i + 1) + ' (' + (line.itemNumber || 'unknown') + ')';

    if (!line.itemNumber) {
      validationErrors.push(lineRef + ': missing itemNumber');
    }
    if (!line.itemGuid) {
      validationErrors.push(lineRef + ': missing itemGuid');
    }
    if (typeof line.quantity === 'undefined' || line.quantity === null) {
      validationErrors.push(lineRef + ': missing quantity');
    }
    if (typeof line.level === 'undefined' || line.level === null) {
      validationErrors.push(lineRef + ': missing level');
    }
  }

  // If any validation errors, fail immediately with comprehensive error message
  if (validationErrors.length > 0) {
    var errorMsg = 'syncBOMToArena: BOM validation failed with ' + validationErrors.length + ' error(s):\n' +
                   validationErrors.join('\n');
    Logger.log('ERROR: ' + errorMsg);
    throw new Error(errorMsg);
  }

  Logger.log('✓ All BOM lines validated successfully');

  // === SMART DIFF SYNC ===
  // Fetch existing Arena BOM lines and diff against local lines.
  // Only DELETE lines removed from local, PUT lines with qty changes, POST new lines.
  // This preserves Arena BOM line GUIDs and minimises API calls.

  // Step 1: Fetch existing BOM from Arena
  var existingBOM = [];
  try {
    var bomData = client.makeRequest('/items/' + parentGuid + '/bom', { method: 'GET' });
    existingBOM = bomData.results || bomData.Results || [];
  } catch (error) {
    Logger.log('No existing BOM found (new item) — will POST all lines');
  }

  // Step 2: Build lookup maps
  // existingLinesByItemGuid: { [itemGuid]: { lineGuid, quantity } }
  var existingLinesByItemGuid = {};
  existingBOM.forEach(function(line) {
    var itemObj = line.item || line.Item || {};
    var itemGuid = itemObj.guid || itemObj.Guid || '';
    var lineGuid = line.guid || line.Guid || '';
    if (itemGuid && lineGuid) {
      existingLinesByItemGuid[itemGuid] = {
        lineGuid: lineGuid,
        quantity: line.quantity || line.Quantity || 1
      };
    }
  });

  // localByItemGuid: { [itemGuid]: { quantity, level, lineNumber, itemNumber, bomAttributes } }
  var localByItemGuid = {};
  bomLines.forEach(function(line, index) {
    localByItemGuid[line.itemGuid] = {
      quantity: line.quantity,
      level: line.level,
      lineNumber: index + 1,
      itemNumber: line.itemNumber,
      attrValue: bomAttributes[line.itemNumber] || null
    };
  });

  // Step 3: Compute diff
  var toRemove  = [];  // lineGuids of lines in Arena but not in local
  var toAdd     = [];  // itemGuids of lines in local but not in Arena
  var toUpdate  = [];  // itemGuids of lines in both where quantity differs

  Object.keys(existingLinesByItemGuid).forEach(function(itemGuid) {
    if (!localByItemGuid[itemGuid]) {
      toRemove.push(existingLinesByItemGuid[itemGuid].lineGuid);
    } else if (existingLinesByItemGuid[itemGuid].quantity !== localByItemGuid[itemGuid].quantity) {
      toUpdate.push(itemGuid);
    }
  });

  Object.keys(localByItemGuid).forEach(function(itemGuid) {
    if (!existingLinesByItemGuid[itemGuid]) {
      toAdd.push(itemGuid);
    }
  });

  Logger.log('Smart sync diff — Remove: ' + toRemove.length + ', Update: ' + toUpdate.length + ', Add: ' + toAdd.length);

  // Step 4: DELETE removed lines
  toRemove.forEach(function(lineGuid) {
    try {
      client.makeRequest('/items/' + parentGuid + '/bom/' + lineGuid, { method: 'DELETE' });
      Logger.log('✓ Deleted BOM line: ' + lineGuid);
      Utilities.sleep(150);
    } catch (deleteError) {
      Logger.log('Error deleting BOM line ' + lineGuid + ': ' + deleteError.message);
    }
  });

  // Step 5: PUT (update quantity) for changed lines, with DELETE+POST fallback on 405
  toUpdate.forEach(function(itemGuid) {
    var existing = existingLinesByItemGuid[itemGuid];
    var local = localByItemGuid[itemGuid];
    try {
      client.makeRequest('/items/' + parentGuid + '/bom/' + existing.lineGuid, {
        method: 'PUT',
        payload: { quantity: local.quantity }
      });
      Logger.log('✓ Updated BOM line qty for item GUID ' + itemGuid + ' → ' + local.quantity);
      Utilities.sleep(150);
    } catch (putError) {
      if (putError.message && putError.message.indexOf('405') !== -1) {
        // Arena doesn't support PUT for this line — fallback to DELETE + POST
        Logger.log('Warning: PUT returned 405 for ' + local.itemNumber + ', falling back to DELETE+POST');
        try {
          client.makeRequest('/items/' + parentGuid + '/bom/' + existing.lineGuid, { method: 'DELETE' });
          Utilities.sleep(150);
          toAdd.push(itemGuid);  // Will be handled in the POST loop below
        } catch (fallbackError) {
          Logger.log('Error in DELETE+POST fallback for ' + local.itemNumber + ': ' + fallbackError.message);
        }
      } else {
        Logger.log('Error updating BOM line for ' + local.itemNumber + ': ' + putError.message);
        throw putError;
      }
    }
  });

  // Step 6: POST new lines
  toAdd.forEach(function(itemGuid) {
    var local = localByItemGuid[itemGuid];
    try {
      var bomLineData = {
        item: { guid: itemGuid },
        quantity: local.quantity,
        level: local.level,
        lineNumber: local.lineNumber
      };

      if (local.attrValue) {
        bomLineData.additionalAttributes = local.attrValue;
        Logger.log('Adding BOM attribute for ' + local.itemNumber + ': ' + JSON.stringify(local.attrValue));
      }

      client.makeRequest('/items/' + parentGuid + '/bom', {
        method: 'POST',
        payload: bomLineData
      });

      Logger.log('✓ Added BOM line: ' + local.itemNumber + ' (GUID: ' + itemGuid + ')');
      Utilities.sleep(250);

    } catch (error) {
      var errorMsg = 'Failed to add BOM line (' + local.itemNumber + '): ' + error.message;

      if (error.message && (error.message.indexOf('additional attribute') !== -1 ||
                           error.message.indexOf('additionalAttributes') !== -1)) {
        errorMsg += '\n\nThis error suggests the configured BOM attribute may not be valid. ' +
                   'Please reconfigure using: Arena Data Center > Configuration > Rack BOM Location Setting';
      }

      Logger.log('ERROR: ' + errorMsg);
      throw new Error(errorMsg);
    }
  });

  Logger.log('✓ Smart BOM sync complete — removed ' + toRemove.length + ', updated ' + toUpdate.length + ', added ' + toAdd.length);
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
    var client = getArenaClient();
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
/**
 * Shows loading modal and starts consolidated BOM build process
 */
function createConsolidatedBOMSheet() {
  var html = HtmlService.createHtmlOutputFromFile('ConsolidatedBOMLoadingModal')
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(html, 'Building Consolidated BOM');
}

/**
 * Builds the consolidated BOM (called by loading modal)
 * Creates the sheet and stores results for completion modal
 */
function buildConsolidatedBOM() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Find overview sheet by checking header in cell A1 (not sheet name)
  var overviewSheet = findOverviewSheet();

  if (!overviewSheet) {
    throw new Error('Could not find an Overview sheet. Please create an overview layout sheet first.\n\nOverview sheets are identified by having "Overview" in the tab name or in cell A1.');
  }

  Logger.log('Using overview sheet: ' + overviewSheet.getName());

  // Build consolidated BOM from overview
  try {
    var bomData = buildConsolidatedBOMFromOverview(overviewSheet);

    if (!bomData || bomData.lines.length === 0) {
      throw new Error('No BOM data could be generated from the overview.\n\nMake sure:\n1. Overview sheet has rack items placed\n2. Rack configuration tabs exist for those racks\n3. Rack configs have child items');
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
    var rackHeaderIndices = [];
    bomData.lines.forEach(function(line, idx) {
      rowData.push([
        line.level,
        line.itemNumber,
        line.name,
        line.description,
        line.quantity,
        line.category
      ]);
      if (line.isRackHeader) {
        rackHeaderIndices.push(idx);
      }
    });

    if (rowData.length > 0) {
      newSheet.getRange(8, 1, rowData.length, headers.length).setValues(rowData);

      // Apply category colors to non-rack-header rows only
      for (var i = 0; i < rowData.length; i++) {
        if (rackHeaderIndices.indexOf(i) !== -1) continue;
        var category = rowData[i][5];
        var color = getCategoryColor(category);
        if (color) {
          newSheet.getRange(i + 8, 1, 1, headers.length).setBackground(color);
        }
      }

      // Apply dark header style to rack header rows
      rackHeaderIndices.forEach(function(i) {
        newSheet.getRange(i + 8, 1, 1, headers.length)
          .setBackground('#37474f')
          .setFontColor('#ffffff')
          .setFontWeight('bold');
      });

      // Indent child rows (non-rack-headers) by one level
      for (var i = 0; i < rowData.length; i++) {
        if (rackHeaderIndices.indexOf(i) !== -1) continue;
        var itemNumberCell = newSheet.getRange(i + 8, 2);
        itemNumberCell.setValue('  ' + itemNumberCell.getValue());
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

    // Set purple tab color to match other system tabs
    newSheet.setTabColor('#9c27b0');

    // Move to end of sheet list
    spreadsheet.setActiveSheet(newSheet);
    spreadsheet.moveActiveSheet(spreadsheet.getNumSheets());

    // Store results for completion modal
    PropertiesService.getUserProperties().setProperty('consolidatedBOM_results', JSON.stringify({
      totalUniqueItems: bomData.totalUniqueItems,
      totalRacks: bomData.totalRacks,
      bomLines: bomData.lines.length
    }));

    Logger.log('✓ Consolidated BOM created successfully with ' + bomData.lines.length + ' lines');

    // Show completion modal
    var completionHtml = HtmlService.createHtmlOutputFromFile('ConsolidatedBOMCompleteModal')
      .setWidth(500)
      .setHeight(400);

    ui.showModalDialog(completionHtml, 'Consolidated BOM Complete');

  } catch (error) {
    Logger.log('Error creating consolidated BOM: ' + error.message + '\n' + error.stack);
    throw error;
  }
}

/**
 * Gets consolidated BOM results from PropertiesService
 * Called by completion modal to display summary
 * @return {Object} Result data with totalUniqueItems, totalRacks, bomLines
 */
function getConsolidatedBOMResults() {
  var json = PropertiesService.getUserProperties().getProperty('consolidatedBOM_results');
  return json ? JSON.parse(json) : { totalUniqueItems: 0, totalRacks: 0, bomLines: 0 };
}

/**
 * Navigates to the Consolidated BOM sheet
 * Called by completion modal when user clicks "Go to Consolidated BOM" button
 */
function navigateToConsolidatedBOM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Consolidated BOM');
  if (sheet) {
    sheet.activate();
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
  var arenaClient = getArenaClient();

  // Step 1: Scan overview sheet for all rack placements
  Logger.log('Step 1: Scanning overview sheet for rack placements...');
  var rackPlacements = scanOverviewForRacks(overviewSheet);

  Logger.log('Found ' + Object.keys(rackPlacements).length + ' unique rack types');
  Logger.log('Total rack instances: ' + getTotalRackCount(rackPlacements));

  if (Object.keys(rackPlacements).length === 0) {
    throw new Error('No rack items found in overview sheet');
  }

  // Step 2: Pre-warm item cache before fetching Arena details
  Logger.log('Step 2: Pre-warming item cache...');
  try {
    if (!CacheService.getScriptCache().get(ITEM_CACHE_KEY)) {
      arenaClient.refreshItemCache();
      Logger.log('Cache refreshed successfully');
    } else {
      Logger.log('Cache already warm');
    }
  } catch (_cacheErr) {
    Logger.log('Cache pre-warm failed: ' + _cacheErr.message);
  }

  // Step 3: Build per-rack-type sections (rack header + its children)
  // Each rack type gets its own section so quantities are visible per rack.
  Logger.log('Step 3: Building per-rack-type BOM sections...');
  var bomLines = [];
  var uniqueItemNumbers = {};

  for (var rackItemNumber in rackPlacements) {
    var rackCount = rackPlacements[rackItemNumber];
    Logger.log('Processing rack: ' + rackItemNumber + ' (count: ' + rackCount + ')');

    var rackConfigSheet = findRackConfigTab(rackItemNumber);
    if (!rackConfigSheet) {
      Logger.log('WARNING: No rack config found for ' + rackItemNumber + ', skipping');
      continue;
    }

    var rackMetadata = getRackConfigMetadata(rackConfigSheet);

    // Try to fetch rack category from Arena
    var rackCategory = '';
    try {
      var rackArenaItem = arenaClient.getItemByNumber(rackItemNumber);
      if (rackArenaItem) {
        var catObj = rackArenaItem.category || rackArenaItem.Category || {};
        rackCategory = catObj.name || catObj.Name || '';
      }
    } catch (e) {
      Logger.log('Could not fetch rack from Arena: ' + e.message);
    }

    var rackLevel = getBOMLevelForCategory(rackCategory, hierarchy) || 2;

    // Rack header row (visually distinct in the sheet)
    bomLines.push({
      itemNumber: rackItemNumber,
      name: rackMetadata ? rackMetadata.itemName : rackItemNumber,
      description: rackMetadata ? rackMetadata.description : '',
      category: rackCategory,
      quantity: rackCount,
      level: rackLevel,
      isRackHeader: true
    });
    uniqueItemNumbers[rackItemNumber] = true;

    // Children — quantities multiplied by rack instance count
    var children = getRackConfigChildren(rackConfigSheet);
    Logger.log('  Found ' + children.length + ' children in rack config');

    children.forEach(function(child) {
      var totalChildQty = child.quantity * rackCount;
      var childCategory = child.category || '';

      // Fetch from Arena if category is missing
      if (!childCategory) {
        try {
          var arenaItem = arenaClient.getItemByNumber(child.itemNumber);
          if (arenaItem) {
            var cObj = arenaItem.category || arenaItem.Category || {};
            childCategory = cObj.name || cObj.Name || '';
            if (!child.name) child.name = arenaItem.name || arenaItem.Name || '';
            if (!child.description) child.description = arenaItem.description || arenaItem.Description || '';
          }
        } catch (e) {
          Logger.log('Could not fetch child item from Arena: ' + e.message);
        }
      }

      var childLevel = getBOMLevelForCategory(childCategory, hierarchy) || 3;

      bomLines.push({
        itemNumber: child.itemNumber,
        name: child.name || '',
        description: child.description || '',
        category: childCategory,
        quantity: totalChildQty,
        level: childLevel,
        isRackHeader: false
      });
      uniqueItemNumbers[child.itemNumber] = true;
    });
  }

  Logger.log('Built consolidated BOM: ' + bomLines.length + ' rows, ' +
    Object.keys(uniqueItemNumbers).length + ' unique items');

  return {
    lines: bomLines,
    totalUniqueItems: Object.keys(uniqueItemNumbers).length,
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
  var client = getArenaClient();

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
      'Failed to push BOM to Arena:\n\n' + _getFriendlyApiError(error),
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
  var revisionCol = headers.indexOf('Revision');

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
      quantity: parseFloat(quantity),
      revision: revisionCol >= 0 ? (row[revisionCol] || '') : ''
    });
  }

  Logger.log('Read ' + bomLines.length + ' BOM lines from sheet');
  return bomLines;
}


/**
 * Identifies custom racks that need Arena items created
 * @param {Array} rackItemNumbers - Array of rack item numbers from overview
 * @return {Array} Array of custom rack objects {itemNumber, metadata, sheet}
 */
function identifyCustomRacks(rackItemNumbers) {
  var client = getArenaClient();
  var customRacks = [];

  rackItemNumbers.forEach(function(itemNumber) {
    try {
      // Find the rack config tab
      var rackSheet = findRackConfigTab(itemNumber);
      if (!rackSheet) {
        Logger.log('⚠ No rack config found for: ' + itemNumber + ' - cannot create without config sheet');
        return;
      }

      var metadata = getRackConfigMetadata(rackSheet);

      // CRITICAL: Check Arena FIRST to determine if this is a placeholder
      // A rack can have children locally (BOM populated) but not exist in Arena yet
      Logger.log('Checking if rack ' + itemNumber + ' exists in Arena...');
      var arenaItem = client.getItemByNumber(itemNumber);

      if (!arenaItem) {
        // Item doesn't exist in Arena - it's a placeholder rack that needs creation
        var children = getRackConfigChildren(rackSheet);

        if (children && children.length > 0) {
          Logger.log('✓ Custom rack identified (placeholder with BOM): ' + itemNumber + ' (' + children.length + ' children)');
          customRacks.push({
            itemNumber: itemNumber,
            metadata: metadata,
            sheet: rackSheet,
            children: children,
            reason: 'placeholder_with_bom'
          });
        } else {
          Logger.log('✓ Custom rack identified (placeholder without BOM): ' + itemNumber);
          customRacks.push({
            itemNumber: itemNumber,
            metadata: metadata,
            sheet: rackSheet,
            children: [],
            reason: 'placeholder_no_bom'
          });
        }
        return;
      }

      // Item exists in Arena - check if it needs BOM update
      Logger.log('Rack ' + itemNumber + ' found in Arena');
      var itemGuid = arenaItem.guid || arenaItem.Guid;
      var bomData = client.makeRequest('/items/' + itemGuid + '/bom', { method: 'GET' });
      var bomLines = bomData.results || bomData.Results || [];

      // Get local BOM
      var children = getRackConfigChildren(rackSheet);

      if (bomLines.length === 0 && children && children.length > 0) {
        // Item exists but has no BOM in Arena, but has BOM locally - needs BOM sync
        Logger.log('✓ Rack ' + itemNumber + ' exists in Arena but missing BOM (' + children.length + ' children to sync)');
        customRacks.push({
          itemNumber: itemNumber,
          metadata: metadata,
          sheet: rackSheet,
          arenaItem: arenaItem,
          children: children,
          reason: 'needs_bom_sync'
        });
      } else if (bomLines.length > 0 && (!children || children.length === 0)) {
        // Arena has BOM but local config is empty - suggest pull
        Logger.log('ℹ Rack ' + itemNumber + ' exists in Arena with BOM, but local config is empty - consider pulling BOM from Arena');
      } else {
        // Both have BOMs or both are empty - assume synced
        Logger.log('✓ Rack ' + itemNumber + ' appears synchronized (Arena BOM: ' + bomLines.length + ', Local: ' + (children ? children.length : 0) + ')');
      }

    } catch (error) {
      Logger.log('⚠ Error checking rack ' + itemNumber + ': ' + error.message);

      // On error, check if it's a 404 (item not found) - treat as placeholder
      if (error.message && error.message.indexOf('404') !== -1) {
        Logger.log('✓ Rack ' + itemNumber + ' not found in Arena (404) - treating as placeholder');
        var rackSheet = findRackConfigTab(itemNumber);
        if (rackSheet) {
          var children = getRackConfigChildren(rackSheet);
          customRacks.push({
            itemNumber: itemNumber,
            metadata: getRackConfigMetadata(rackSheet),
            sheet: rackSheet,
            children: children || [],
            reason: children && children.length > 0 ? 'placeholder_with_bom' : 'placeholder_no_bom'
          });
        }
      } else {
        // Other errors - be conservative and skip
        Logger.log('⚠ Cannot determine status for ' + itemNumber + ' - skipping to avoid errors');
      }
    }
  });

  return customRacks;
}

/**
 * Creates Arena items for custom racks with user prompts
 * @param {Array} customRacks - Array of custom rack objects
 * @return {Object} Result with created items
 */
function createCustomRackItems(customRacks) {
  if (customRacks.length === 0) {
    return { success: true, createdItems: [] };
  }

  var ui = SpreadsheetApp.getUi();
  var client = getArenaClient();
  var createdItems = [];

  for (var i = 0; i < customRacks.length; i++) {
    var rack = customRacks[i];

    // Check if Arena item exists but just needs BOM
    if (rack.arenaItem && rack.reason === 'needs_bom_sync') {
      Logger.log('Rack exists in Arena, will add BOM: ' + rack.itemNumber);

      // Get rack children and push BOM
      var children = getRackConfigChildren(rack.sheet);
      var itemGuid = rack.arenaItem.guid || rack.arenaItem.Guid;

      // Convert children to BOM format with GUID lookups
      var bomLines = [];
      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        try {
          Logger.log('Looking up GUID for child component: ' + child.itemNumber);
          var childItem = client.getItemByNumber(child.itemNumber);

          if (!childItem) {
            Logger.log('ERROR: Child component not found in Arena: ' + child.itemNumber);
            throw new Error('Child component not found in Arena: ' + child.itemNumber +
                          '. Needed for rack: ' + rack.itemNumber +
                          '. Please ensure all components exist in Arena before creating rack BOMs.');
          }

          var childGuid = childItem.guid || childItem.Guid;

          bomLines.push({
            itemNumber: child.itemNumber,
            itemGuid: childGuid,  // ✓ Include GUID from Arena lookup
            quantity: child.quantity || 1,
            level: 0
          });

          Logger.log('✓ Found child component GUID: ' + child.itemNumber + ' → ' + childGuid);
        } catch (childError) {
          Logger.log('ERROR looking up child component ' + child.itemNumber + ': ' + childError.message);
          throw childError;  // Fail loudly - don't create incomplete BOMs
        }
      }

      syncBOMToArena(client, itemGuid, bomLines);

      // Update rack status to SYNCED now that BOM has been synced to Arena
      Logger.log('Updating rack status to SYNCED after BOM sync: ' + rack.itemNumber);
      var eventDetails = {
        changesSummary: 'BOM synced to Arena (' + bomLines.length + ' items)',
        details: 'POD push updated existing rack BOM in Arena'
      };
      updateRackSheetStatus(rack.sheet, RACK_STATUS.SYNCED, itemGuid, eventDetails);

      // Log POD push event
      addRackHistoryEvent(rack.itemNumber, HISTORY_EVENT.POD_PUSH, {
        changesSummary: 'Rack BOM updated in Arena during POD push',
        details: bomLines.length + ' BOM items synced to Arena',
        statusAfter: RACK_STATUS.SYNCED
      });

      createdItems.push({
        itemNumber: rack.itemNumber,
        guid: itemGuid,
        updated: true
      });

      continue;
    }

    // Prompt user for rack details
    var promptMsg = '========================================\n' +
                    'CREATING CUSTOM RACK ITEM ' + (i + 1) + ' of ' + customRacks.length + '\n' +
                    '========================================\n\n' +
                    'Rack Item Number: ' + rack.itemNumber + '\n' +
                    'Current Name: ' + (rack.metadata.itemName || 'Not set') + '\n\n' +
                    '----------------------------------------\n' +
                    'Enter a name for this rack in Arena:';

    var nameResponse = ui.prompt('Create Custom Rack (' + (i + 1) + ' of ' + customRacks.length + ')', promptMsg, ui.ButtonSet.OK_CANCEL);

    if (nameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Error', 'Custom rack creation cancelled. Cannot proceed with POD creation.', ui.ButtonSet.OK);
      return { success: false, message: 'Cancelled by user' };
    }

    var rackName = nameResponse.getResponseText().trim();
    if (!rackName) {
      ui.alert('Error', 'Rack name is required.', ui.ButtonSet.OK);
      return { success: false, message: 'Invalid rack name' };
    }

    // Use clickable category selector dialog
    Logger.log('Prompting user to select category for rack: ' + rack.itemNumber);

    var categorySelection = showCategorySelector(
      'Select Category for Rack ' + rack.itemNumber,
      'Choose the Arena category for this custom rack item (' + (i + 1) + ' of ' + customRacks.length + ')'
    );

    if (!categorySelection) {
      ui.alert('Error', 'Category selection cancelled. Cannot proceed with POD creation.', ui.ButtonSet.OK);
      return { success: false, message: 'Cancelled by user' };
    }

    var selectedCategoryName = categorySelection.name;
    Logger.log('Selected category: ' + selectedCategoryName + ' (GUID: ' + categorySelection.guid + ')');

    // Prompt for description
    var descResponse = ui.prompt(
      'Description for Rack ' + rack.itemNumber,
      'RACK: ' + rack.itemNumber + '\n\n' +
      'Enter a description for this rack in Arena:',
      ui.ButtonSet.OK_CANCEL
    );

    if (descResponse.getSelectedButton() !== ui.Button.OK) {
      return { success: false, message: 'Cancelled by user' };
    }

    var description = descResponse.getResponseText().trim();

    // Create the item in Arena
    try {
      Logger.log('Creating rack item: ' + rack.itemNumber + ' with category: ' + selectedCategoryName + ' (GUID: ' + categorySelection.guid + ')');

      // Arena API expects category as an object with guid, not a simple string
      // NOTE: Don't include 'number' in initial creation - Arena may have auto-numbering enabled
      var newItem = client.createItem({
        name: rackName,
        category: {
          guid: categorySelection.guid
        },
        description: description
      });

      var newItemGuid = newItem.guid || newItem.Guid;
      var newItemNumber = newItem.number || newItem.Number;

      Logger.log('Created rack item in Arena (GUID: ' + newItemGuid + ', auto-number: ' + newItemNumber + ')');

      // Always update with our desired rack number (handles both auto-numbering and manual numbering)
      Logger.log('Updating rack item number to: ' + rack.itemNumber);
      client.updateItem(newItemGuid, { number: rack.itemNumber });
      newItemNumber = rack.itemNumber;
      Logger.log('✓ Rack item number set to: ' + newItemNumber);

      // Get rack children and push BOM
      var children = getRackConfigChildren(rack.sheet);

      // Convert children to BOM format with GUID lookups
      var bomLines = [];
      for (var k = 0; k < children.length; k++) {
        var child = children[k];
        try {
          Logger.log('Looking up GUID for child component: ' + child.itemNumber);
          var childItem = client.getItemByNumber(child.itemNumber);

          if (!childItem) {
            Logger.log('ERROR: Child component not found in Arena: ' + child.itemNumber);
            throw new Error('Child component not found in Arena: ' + child.itemNumber +
                          '. Needed for rack: ' + rack.itemNumber +
                          '. Please ensure all components exist in Arena before creating rack BOMs.');
          }

          var childGuid = childItem.guid || childItem.Guid;

          bomLines.push({
            itemNumber: child.itemNumber,
            itemGuid: childGuid,  // ✓ Include GUID from Arena lookup
            quantity: child.quantity || 1,
            level: 0
          });

          Logger.log('✓ Found child component GUID: ' + child.itemNumber + ' → ' + childGuid);
        } catch (childError) {
          Logger.log('ERROR looking up child component ' + child.itemNumber + ': ' + childError.message);
          throw childError;  // Fail loudly - don't create incomplete BOMs
        }
      }

      syncBOMToArena(client, newItemGuid, bomLines);

      // Update rack config metadata with Arena info
      rack.sheet.getRange(1, 2).setValue(rack.itemNumber);
      rack.sheet.getRange(1, 3).setValue(rackName);
      rack.sheet.getRange(1, 4).setValue(description);

      // Update rack status to SYNCED now that it has been created in Arena with BOM
      Logger.log('Updating rack status to SYNCED after creation: ' + rack.itemNumber + ' (GUID: ' + newItemGuid + ')');
      var eventDetails = {
        changesSummary: 'Rack created in Arena with BOM',
        details: 'POD push created new rack with ' + bomLines.length + ' BOM items'
      };
      updateRackSheetStatus(rack.sheet, RACK_STATUS.SYNCED, newItemGuid, eventDetails);

      // Log POD push event (creation)
      addRackHistoryEvent(rack.itemNumber, HISTORY_EVENT.POD_PUSH, {
        changesSummary: 'Rack created in Arena during POD push',
        details: 'New rack item created with ' + bomLines.length + ' BOM items',
        statusAfter: RACK_STATUS.SYNCED
      });

      createdItems.push({
        itemNumber: rack.itemNumber,
        guid: newItemGuid,
        name: rackName,
        created: true
      });

    } catch (error) {
      Logger.log('Error creating rack item: ' + error.message);
      ui.alert('Error', 'Failed to create rack item: ' + _getFriendlyApiError(error), ui.ButtonSet.OK);
      return { success: false, message: error.message };
    }
  }

  return {
    success: true,
    createdItems: createdItems
  };
}

/**
 * Scans overview sheet row by row for rack placements
 * @param {Sheet} sheet - Overview sheet
 * @return {Array} Array of row objects {rowNumber, positions: [{col, itemNumber, rackCount}]}
 */
function scanOverviewByRow(sheet) {
  var data = sheet.getDataRange().getValues();
  var rowData = [];

  // Find header row (contains "Pos 1", "Pos 2", etc.)
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    for (var j = 0; j < row.length; j++) {
      if (row[j] && row[j].toString().toLowerCase().indexOf('pos') === 0) {
        headerRow = i;
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) {
    throw new Error('Could not find position headers in overview sheet');
  }

  var headers = data[headerRow];
  var firstPosCol = -1;

  // Find first position column
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] && headers[j].toString().toLowerCase().indexOf('pos') === 0) {
      firstPosCol = j;
      break;
    }
  }

  // Row Item column is right before position columns
  var rowItemCol = firstPosCol - 1;

  // Scan each row after headers
  for (var i = headerRow + 1; i < data.length; i++) {
    var row = data[i];
    var positions = [];
    var rowHasData = false;

    // Scan position columns
    for (var j = firstPosCol; j < row.length; j++) {
      var cellValue = row[j];

      if (!cellValue) continue;

      // Check if it's a rack (try to find config tab)
      var rackSheet = findRackConfigTab(cellValue.toString());
      if (rackSheet) {
        rowHasData = true;
        positions.push({
          col: j,
          position: (j - firstPosCol + 1),  // Position number (1, 2, 3...)
          positionName: headers[j],
          itemNumber: cellValue.toString()
        });
      }
    }

    if (rowHasData) {
      // Get row number from first column
      var rowNumber = row[0] || (rowData.length + 1);

      // Get row item number from Row Item column if it exists.
      // rowItemCol = 0 means column A, which holds row sequence numbers (1, 2, 3...)
      // not Arena item numbers — skip it unless there is a dedicated interior column.
      var rowItemNumber = null;
      if (rowItemCol > 0 && row[rowItemCol]) {
        rowItemNumber = row[rowItemCol].toString();
      }

      rowData.push({
        rowNumber: rowNumber,
        rowItemNumber: rowItemNumber,
        sheetRow: i + 1, // Sheet row index (1-based)
        positions: positions
      });
    }
  }

  Logger.log('Scanned overview: found ' + rowData.length + ' rows with racks');
  return rowData;
}

/**
 * Creates Row items in Arena with BOM position tracking
 * @param {Array} rowData - Array of row objects from scanOverviewByRow
 * @param {string} rowCategory - Category to use for Row items
 * @return {Array} Array of created row items with metadata
 */
function createRowItems(rowData, rowCategory) {
  var ui = SpreadsheetApp.getUi();
  var client = getArenaClient();
  var rowItems = [];

  for (var i = 0; i < rowData.length; i++) {
    var row = rowData[i];

    // Prompt user for row name
    var promptMsg = '========================================\n' +
                    'CREATING ROW ITEM ' + (i + 1) + ' of ' + rowData.length + '\n' +
                    '========================================\n\n' +
                    'Overview Row Number: ' + row.rowNumber + '\n\n' +
                    'This row contains racks in the following positions:\n';

    row.positions.forEach(function(pos) {
      promptMsg += '  • ' + pos.positionName + ': ' + pos.itemNumber + '\n';
    });

    promptMsg += '\n----------------------------------------\n';
    promptMsg += 'Enter a name for this Row item in Arena:';

    var nameResponse = ui.prompt('Create Row Item (' + (i + 1) + ' of ' + rowData.length + ')', promptMsg, ui.ButtonSet.OK_CANCEL);

    if (nameResponse.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Error', 'Row creation cancelled.', ui.ButtonSet.OK);
      return null;
    }

    var rowName = nameResponse.getResponseText().trim();
    if (!rowName) {
      rowName = 'Row ' + row.rowNumber;
    }

    // Build position names for item description (comma-separated)
    var positionNames = row.positions.map(function(pos) {
      return pos.positionName;
    }).join(', ');

    // Aggregate rack quantities for this row
    var rackCounts = {};
    row.positions.forEach(function(pos) {
      if (!rackCounts[pos.itemNumber]) {
        rackCounts[pos.itemNumber] = 0;
      }
      rackCounts[pos.itemNumber]++;
    });

    // Create row item in Arena
    try {
      Logger.log('=== CREATING ROW ITEM ' + (i + 1) + ' ===');
      Logger.log('Row name: ' + rowName);
      Logger.log('Row category (should be GUID): ' + rowCategory);
      Logger.log('Row category type: ' + typeof rowCategory);
      Logger.log('Row description: Row ' + row.rowNumber + ' with racks in positions: ' + positionNames);

      // Arena API expects category as an object with guid, not a simple string
      var createItemPayload = {
        name: rowName,
        category: {
          guid: rowCategory
        },
        description: 'Row ' + row.rowNumber + ' with racks in positions: ' + positionNames
      };

      Logger.log('Full createItem payload: ' + JSON.stringify(createItemPayload));

      var rowItem = client.createItem(createItemPayload);

      Logger.log('Full response from createItem: ' + JSON.stringify(rowItem));

      var rowItemGuid = rowItem.guid || rowItem.Guid;
      var rowItemNumber = rowItem.number || rowItem.Number;

      Logger.log('✓ Created row item: ' + rowItemNumber + ' (GUID: ' + rowItemGuid + ')');

      // Handle manual item numbering if needed
      if (!rowItemNumber) {
        Logger.log('⚠ Item number is null - category may not have auto-numbering enabled');

        var numberPrompt = '========================================\n' +
                           'ITEM NUMBER REQUIRED\n' +
                           '========================================\n\n' +
                           'The ROW category does not have auto-numbering enabled.\n' +
                           'Please enter an item number for this row:\n\n' +
                           'Row: ' + rowName + '\n' +
                           'GUID: ' + rowItemGuid;

        var numberResponse = ui.prompt('Enter Item Number', numberPrompt, ui.ButtonSet.OK_CANCEL);

        if (numberResponse.getSelectedButton() !== ui.Button.OK) {
          throw new Error('Item number is required but was not provided');
        }

        rowItemNumber = numberResponse.getResponseText().trim();
        if (!rowItemNumber) {
          throw new Error('Item number cannot be empty');
        }

        // Update the item with the user-provided number
        Logger.log('Updating item with manual number: ' + rowItemNumber);
        client.updateItem(rowItemGuid, { number: rowItemNumber });
        Logger.log('✓ Item number set to: ' + rowItemNumber);
      }

      // Position tracking is now handled via BOM attributes (see Rack BOM Location Setting)
      // Each rack on the BOM will have its positions tagged via the configured BOM attribute

      // Create BOM for row (add each rack with its quantity)
      // First, look up GUIDs for each rack from Arena
      var bomLines = [];
      for (var rackNumber in rackCounts) {
        try {
          Logger.log('Looking up GUID for rack: ' + rackNumber);
          var rackItem = client.getItemByNumber(rackNumber);

          if (!rackItem) {
            Logger.log('ERROR: Rack item not found in Arena: ' + rackNumber);
            throw new Error('Rack item not found in Arena: ' + rackNumber + '. Please ensure all rack items exist in Arena before creating rows.');
          }

          var rackGuid = rackItem.guid || rackItem.Guid;

          bomLines.push({
            itemNumber: rackNumber,
            itemGuid: rackGuid,  // Add GUID from Arena lookup
            quantity: rackCounts[rackNumber],
            level: 0
          });

          Logger.log('✓ Found rack GUID: ' + rackNumber + ' → ' + rackGuid);
        } catch (rackError) {
          Logger.log('ERROR looking up rack ' + rackNumber + ': ' + rackError.message);
          throw rackError;  // Stop processing if we can't find a rack
        }
      }

      // Build position mapping for BOM attributes (if configured)
      var bomOptions = {};
      var positionConfig = getBOMPositionAttributeConfig();

      if (positionConfig) {
        Logger.log('✓ Position tracking enabled - using attribute: ' + positionConfig.name);

        // Build rack-to-positions mapping
        var rackPositions = {}; // Map: rackNumber => [positionNames]

        row.positions.forEach(function(pos) {
          if (!rackPositions[pos.itemNumber]) {
            rackPositions[pos.itemNumber] = [];
          }
          rackPositions[pos.itemNumber].push(pos.positionName);
        });

        // Format position values and build BOM attributes map
        var bomAttributes = {};

        for (var rackNumber in rackPositions) {
          var positions = rackPositions[rackNumber];
          var formattedPositions = positions.join(', '); // e.g., "Pos 1, Pos 3, Pos 8"

          // Build additionalAttributes structure for Arena API (must be array format)
          bomAttributes[rackNumber] = [
            {
              guid: positionConfig.guid,
              value: formattedPositions
            }
          ];

          Logger.log('  ' + rackNumber + ' positions: ' + formattedPositions);
        }

        bomOptions.bomAttributes = bomAttributes;
      } else {
        Logger.log('✓ Position tracking DISABLED - skipping BOM position attributes');
      }

      syncBOMToArena(client, rowItemGuid, bomLines, bomOptions);
      Logger.log('Added ' + bomLines.length + ' racks to row BOM');

      rowItems.push({
        rowNumber: row.rowNumber,
        sheetRow: row.sheetRow,
        itemNumber: rowItemNumber,
        guid: rowItemGuid,
        name: rowName,
        positions: positionNames
      });

    } catch (error) {
      Logger.log('Error creating row item: ' + error.message);
      ui.alert('Error', 'Failed to create row item: ' + _getFriendlyApiError(error), ui.ButtonSet.OK);
      return null;
    }
  }

  return rowItems;
}

/**
 * Creates POD item in Arena with all rows as BOM
 * @param {Array} rowItems - Array of row item objects
 * @param {string} podCategory - Category to use for POD item
 * @return {Object} Created POD item metadata
 */
function createPODItem(rowItems, podCategory) {
  var ui = SpreadsheetApp.getUi();
  var client = getArenaClient();

  // Prompt user for POD name
  var promptMsg = '========================================\n' +
                  'CREATING POD ITEM (Top-Level Assembly)\n' +
                  '========================================\n\n' +
                  'This POD will contain ' + rowItems.length + ' Row item(s) in its BOM:\n\n';

  rowItems.forEach(function(row, index) {
    promptMsg += '  ' + (index + 1) + '. ' + row.name + ' (' + row.itemNumber + ')\n';
  });

  promptMsg += '\n----------------------------------------\n';
  promptMsg += 'Enter a name for this POD item in Arena:\n';
  promptMsg += '(e.g., "Data Center Pod A", "West Wing POD")';

  var nameResponse = ui.prompt('Create POD Item', promptMsg, ui.ButtonSet.OK_CANCEL);

  if (nameResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Error', 'POD creation cancelled.', ui.ButtonSet.OK);
    return null;
  }

  var podName = nameResponse.getResponseText().trim();
  if (!podName) {
    ui.alert('Error', 'POD name is required.', ui.ButtonSet.OK);
    return null;
  }

  try {
    Logger.log('=== CREATING POD ITEM ===');
    Logger.log('POD name: ' + podName);
    Logger.log('POD category (should be GUID): ' + podCategory);
    Logger.log('POD category type: ' + typeof podCategory);
    Logger.log('POD description: Point of Delivery containing ' + rowItems.length + ' rows');

    // Arena API expects category as an object with guid, not a simple string
    var createPODPayload = {
      name: podName,
      category: {
        guid: podCategory
      },
      description: 'Point of Delivery containing ' + rowItems.length + ' rows'
    };

    Logger.log('Full createItem payload for POD: ' + JSON.stringify(createPODPayload));

    // Create POD item in Arena
    var podItem = client.createItem(createPODPayload);

    var podItemGuid = podItem.guid || podItem.Guid;
    var podItemNumber = podItem.number || podItem.Number;

    Logger.log('Created POD item: ' + podItemNumber + ' (GUID: ' + podItemGuid + ')');

    // Handle manual item numbering if needed
    if (!podItemNumber) {
      Logger.log('⚠ Item number is null - category may not have auto-numbering enabled');

      var numberPrompt = '========================================\n' +
                         'ITEM NUMBER REQUIRED\n' +
                         '========================================\n\n' +
                         'The POD category does not have auto-numbering enabled.\n' +
                         'Please enter an item number for this POD:\n\n' +
                         'POD: ' + podName + '\n' +
                         'GUID: ' + podItemGuid;

      var numberResponse = ui.prompt('Enter Item Number', numberPrompt, ui.ButtonSet.OK_CANCEL);

      if (numberResponse.getSelectedButton() !== ui.Button.OK) {
        throw new Error('Item number is required but was not provided');
      }

      podItemNumber = numberResponse.getResponseText().trim();
      if (!podItemNumber) {
        throw new Error('Item number cannot be empty');
      }

      // Update the item with the user-provided number
      Logger.log('Updating POD item with manual number: ' + podItemNumber);
      client.updateItem(podItemGuid, { number: podItemNumber });
      Logger.log('✓ POD item number set to: ' + podItemNumber);
    }

    // Create BOM for POD (add all rows with quantity 1)
    var bomLines = rowItems.map(function(row) {
      return {
        itemNumber: row.itemNumber,
        itemGuid: row.guid,  // Use GUID from created row items
        quantity: 1,
        level: 0
      };
    });

    syncBOMToArena(client, podItemGuid, bomLines);
    Logger.log('Added ' + bomLines.length + ' rows to POD BOM');

    return {
      itemNumber: podItemNumber,
      guid: podItemGuid,
      name: podName
    };

  } catch (error) {
    Logger.log('Error creating POD item: ' + error.message);
    ui.alert('Error', 'Failed to create POD item: ' + _getFriendlyApiError(error), ui.ButtonSet.OK);
    return null;
  }
}

/**
 * Attempts to rollback (delete) created items in case of failure
 * Deletes in reverse order: POD → Rows → Racks
 * @param {Object} context - Creation context with createdItems tracking
 * @param {ArenaAPIClient} client - Arena API client
 * @return {Object} {success: boolean, deletedCount: number, errors: Array}
 */
function attemptRollback(context, client) {
  Logger.log('========================================');
  Logger.log('ROLLBACK - ATTEMPTING CLEANUP');
  Logger.log('========================================');

  if (!context || !context.createdItems) {
    Logger.log('No context or createdItems to rollback');
    return { success: true, deletedCount: 0, errors: [] };
  }

  var deletedCount = 0;
  var errors = [];
  var createdItems = context.createdItems;

  // Delete in reverse order: POD → Rows → Racks
  var deleteOrder = [_getBOMHierarchyName(0), _getBOMHierarchyName(1), _getBOMHierarchyName(2)];

  for (var typeIdx = 0; typeIdx < deleteOrder.length; typeIdx++) {
    var itemType = deleteOrder[typeIdx];
    var itemsOfType = [];

    // Collect all items of this type
    for (var i = 0; i < createdItems.length; i++) {
      if (createdItems[i].type === itemType) {
        itemsOfType.push(createdItems[i]);
      }
    }

    if (itemsOfType.length === 0) {
      Logger.log('No ' + itemType + ' items to delete');
      continue;
    }

    Logger.log('Deleting ' + itemsOfType.length + ' ' + itemType + ' item(s)...');

    for (var j = 0; j < itemsOfType.length; j++) {
      var item = itemsOfType[j];
      try {
        Logger.log('  Deleting ' + itemType + ': ' + item.itemNumber + ' (GUID: ' + item.guid + ')');

        // Arena API: DELETE /items/{guid}
        client.makeRequest('/items/' + item.guid, { method: 'DELETE' });

        deletedCount++;
        Logger.log('  ✓ Deleted: ' + item.itemNumber);

        // Small delay to avoid rate limiting
        Utilities.sleep(200);
      } catch (deleteError) {
        var errMsg = 'Failed to delete ' + itemType + ' ' + item.itemNumber + ': ' + deleteError.message;
        Logger.log('  ❌ ' + errMsg);
        errors.push(errMsg);
        // Continue trying to delete other items
      }
    }
  }

  Logger.log('========================================');
  Logger.log('ROLLBACK - COMPLETE');
  Logger.log('Deleted: ' + deletedCount + ' items');
  Logger.log('Errors: ' + errors.length);
  Logger.log('========================================');

  return {
    success: errors.length === 0,
    deletedCount: deletedCount,
    errors: errors
  };
}

/**
 * Validates all preconditions before starting POD push
 * Checks Arena connection, sheet structure, components exist, attributes configured
 * @param {Sheet} overviewSheet - Overview sheet to validate
 * @param {Array} customRacks - Array of custom rack objects to validate
 * @return {Object} {success: boolean, errors: Array, warnings: Array}
 */
function validatePreconditions(overviewSheet, customRacks) {
  Logger.log('========================================');
  Logger.log('PRE-FLIGHT VALIDATION - START');
  Logger.log('========================================');

  var errors = [];
  var warnings = [];
  var client;

  // 1. Validate Arena connection
  Logger.log('1. Validating Arena connection...');
  try {
    client = getArenaClient();
    var testEndpoint = client.getItemAttributeSettings();
    if (!testEndpoint) {
      errors.push('Arena connection test failed - no response from API');
    } else {
      Logger.log('✓ Arena connection successful');
    }
  } catch (connError) {
    errors.push('Arena connection failed: ' + connError.message);
    // Can't continue without connection
    return {
      success: false,
      errors: errors,
      warnings: warnings
    };
  }

  // 2. Validate overview sheet structure
  Logger.log('2. Validating overview sheet structure...');
  try {
    if (!overviewSheet) {
      errors.push('Overview sheet is null or undefined');
    } else {
      var data = overviewSheet.getDataRange().getValues();
      if (data.length === 0) {
        errors.push('Overview sheet is empty');
      } else {
        // Check for position headers
        var hasPositionHeaders = false;
        for (var i = 0; i < data.length && i < 10; i++) {
          for (var j = 0; j < data[i].length; j++) {
            var cell = data[i][j];
            if (cell && cell.toString().toLowerCase().indexOf('pos') === 0) {
              hasPositionHeaders = true;
              break;
            }
          }
          if (hasPositionHeaders) break;
        }

        if (!hasPositionHeaders) {
          errors.push('Overview sheet missing position headers (e.g., "Pos 1", "Pos 2", ...)');
        } else {
          Logger.log('✓ Overview sheet structure valid');
        }
      }
    }
  } catch (sheetError) {
    errors.push('Error validating overview sheet: ' + sheetError.message);
  }

  // 3. Validate BOM position attribute (if configured)
  try {
    var positionConfig = getBOMPositionAttributeConfig();
    if (positionConfig) {
      Logger.log('3. Validating BOM Position attribute...');
      Logger.log('   BOM Position attribute configured: ' + positionConfig.name);

      // Try to fetch the attribute to ensure it exists in Arena
      try {
        var bomAttrs = getBOMAttributes(client);
        var attrFound = false;
        for (var i = 0; i < bomAttrs.length; i++) {
          if (bomAttrs[i].guid === positionConfig.guid) {
            attrFound = true;
            Logger.log('   ✓ Found BOM attribute: ' + bomAttrs[i].name + ' (GUID: ' + bomAttrs[i].guid + ')');
            break;
          }
        }

        if (!attrFound) {
          Logger.log('   ⚠ BOM Position attribute not found - clearing invalid configuration');
          // Clear the invalid configuration so it won't be used during row creation
          clearBOMPositionAttribute();

          warnings.push('BOM Position attribute "' + positionConfig.name + '" (GUID: ' + positionConfig.guid + ') configured but not found in Arena BOM attributes. ' +
                       'It may have been deleted or is an Item attribute (not a BOM attribute). ' +
                       'Configuration has been cleared automatically. ' +
                       'Reconfigure using: Arena Data Center > Configuration > Rack BOM Location Setting');
        } else {
          Logger.log('   ✓ BOM Position attribute "' + positionConfig.name + '" exists in Arena');
        }
      } catch (bomAttrError) {
        Logger.log('   ⚠ Could not fetch BOM attributes - clearing invalid configuration');
        // If we can't fetch BOM attributes, clear the config to prevent errors during row creation
        clearBOMPositionAttribute();

        warnings.push('Could not verify BOM Position attribute: ' + bomAttrError.message + '. ' +
                     'Configuration has been cleared automatically. Position tracking will be disabled for this POD push.');
      }
    } else {
      Logger.log('3. BOM Position attribute - DISABLED (position tracking will be skipped)');
    }
  } catch (bomConfigError) {
    warnings.push('Error checking BOM Position config: ' + bomConfigError.message);
  }

  // 5. Validate all child components for custom racks exist in Arena
  Logger.log('5. Validating child components for custom racks...');
  if (customRacks && customRacks.length > 0) {
    var allChildNumbers = [];
    var childLookupMap = {}; // Track which racks need which children

    for (var r = 0; r < customRacks.length; r++) {
      var rack = customRacks[r];
      try {
        var children = getRackConfigChildren(rack.sheet);

        if (!children || children.length === 0) {
          warnings.push('Rack "' + rack.itemNumber + '" has no child components (empty BOM)');
        } else {
          for (var c = 0; c < children.length; c++) {
            var childNumber = children[c].itemNumber;
            if (allChildNumbers.indexOf(childNumber) === -1) {
              allChildNumbers.push(childNumber);
            }

            // Track which rack needs this child
            if (!childLookupMap[childNumber]) {
              childLookupMap[childNumber] = [];
            }
            if (childLookupMap[childNumber].indexOf(rack.itemNumber) === -1) {
              childLookupMap[childNumber].push(rack.itemNumber);
            }
          }
        }
      } catch (childError) {
        errors.push('Error reading children for rack "' + rack.itemNumber + '": ' + childError.message);
      }
    }

    // Now validate each child component exists in Arena
    Logger.log('Checking ' + allChildNumbers.length + ' unique child components in Arena...');
    var missingComponents = [];

    for (var i = 0; i < allChildNumbers.length; i++) {
      var childNum = allChildNumbers[i];
      try {
        Logger.log('  Checking component: ' + childNum);
        var childItem = client.getItemByNumber(childNum);

        if (!childItem) {
          var racksNeedingThis = childLookupMap[childNum].join(', ');
          missingComponents.push(childNum + ' (needed by: ' + racksNeedingThis + ')');
        } else {
          Logger.log('  ✓ Found: ' + childNum);
        }

        // Small delay to avoid rate limiting
        Utilities.sleep(50);
      } catch (lookupError) {
        var racksNeedingThis = childLookupMap[childNum].join(', ');
        missingComponents.push(childNum + ' (needed by: ' + racksNeedingThis + ') - Error: ' + lookupError.message);
      }
    }

    if (missingComponents.length > 0) {
      errors.push('Missing child components in Arena (' + missingComponents.length + ' total):\n  • ' +
                  missingComponents.join('\n  • '));
    } else {
      Logger.log('✓ All ' + allChildNumbers.length + ' child components found in Arena');
    }
  } else {
    Logger.log('✓ No custom racks to validate');
  }

  // 6. Summary
  Logger.log('========================================');
  Logger.log('PRE-FLIGHT VALIDATION - COMPLETE');
  Logger.log('========================================');
  Logger.log('Errors: ' + errors.length);
  Logger.log('Warnings: ' + warnings.length);

  if (errors.length > 0) {
    Logger.log('ERRORS:');
    errors.forEach(function(err) {
      Logger.log('  ❌ ' + err);
    });
  }

  if (warnings.length > 0) {
    Logger.log('WARNINGS:');
    warnings.forEach(function(warn) {
      Logger.log('  ⚠ ' + warn);
    });
  }

  return {
    success: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Push hierarchical structure to Arena PLM
 * Shows wizard interface for creating/updating POD/Row/Item structures in Arena
 * Uses modern wizard-based approach that scans sheets once and presents comprehensive UI
 */
function pushPODStructureToArena() {
  Logger.log('==========================================');
  Logger.log('POD PUSH WIZARD - START');
  Logger.log('==========================================');

  // Show loading modal immediately - it will call back to prepare data
  var html = HtmlService.createHtmlOutputFromFile('PODPushLoadingModal')
    .setWidth(400)
    .setHeight(350);

  SpreadsheetApp.getUi().showModalDialog(html, 'Preparing POD Structure');
}

/**
 * Computes BOM diff between local rack sheet and Arena BOM lines.
 * Used by preparePODWizardDataForModal to build the Stage 3 visual diff.
 * @param {Array} localBOM - Array of {itemNumber, name, quantity, revision} from getCurrentRackBOMData
 * @param {Array} arenaBOMLines - Raw Arena BOM lines array from /items/{guid}/bom
 * @return {Object} { added, modified, removed, summary }
 */
function _computeWizardBOMDiff(localBOM, arenaBOMLines) {
  var diff = {
    added:    [],
    modified: [],
    removed:  [],
    summary:  { addCount: 0, changeCount: 0, removeCount: 0 }
  };

  // Build local lookup: itemNumber → {name, quantity, revision}
  var localMap = {};
  localBOM.forEach(function(item) {
    localMap[item.itemNumber] = item;
  });

  // Build Arena lookup: itemNumber → {quantity}
  var arenaMap = {};
  arenaBOMLines.forEach(function(line) {
    var bomItem = line.item || line.Item || {};
    var itemNumber = bomItem.number || bomItem.Number || '';
    if (itemNumber) {
      arenaMap[itemNumber] = { quantity: line.quantity || line.Quantity || 1 };
    }
  });

  // Local items vs Arena
  Object.keys(localMap).forEach(function(itemNumber) {
    if (!arenaMap[itemNumber]) {
      // In local, not in Arena → will be added
      diff.added.push({
        itemNumber: itemNumber,
        name: localMap[itemNumber].name || '',
        quantity: localMap[itemNumber].quantity
      });
      diff.summary.addCount++;
    } else {
      var localQty = Number(localMap[itemNumber].quantity) || 1;
      var arenaQty = Number(arenaMap[itemNumber].quantity) || 1;
      if (localQty !== arenaQty) {
        // Quantity changed
        diff.modified.push({
          itemNumber: itemNumber,
          name: localMap[itemNumber].name || '',
          oldQty: arenaQty,
          newQty: localQty,
          oldRevision: '',
          newRevision: localMap[itemNumber].revision || ''
        });
        diff.summary.changeCount++;
      }
    }
  });

  // Arena items not in local → will be removed
  Object.keys(arenaMap).forEach(function(itemNumber) {
    if (!localMap[itemNumber]) {
      diff.removed.push({
        itemNumber: itemNumber,
        name: '',
        quantity: arenaMap[itemNumber].quantity
      });
      diff.summary.removeCount++;
    }
  });

  return diff;
}

/**
 * Prepares all data for the POD push wizard by scanning sheets ONCE
 * Called from the loading modal, returns comprehensive data structure for the UI
 */
function preparePODWizardDataForModal() {
  Logger.log('Preparing POD wizard data...');

  var client = getArenaClient();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Find overview sheet by checking header in cell A1 (not sheet name)
  var overviewSheet = findOverviewSheet();

  if (!overviewSheet) {
    return { success: false, message: 'Overview sheet not found.' };
  }

  // Scan overview for rack/row structure
  var overviewData = scanOverviewByRow(overviewSheet);

  if (overviewData.length === 0) {
    return { success: false, message: 'No racks found in overview sheet.' };
  }

  // Get all unique rack numbers
  var allRackNumbers = [];
  overviewData.forEach(function(row) {
    row.positions.forEach(function(pos) {
      if (allRackNumbers.indexOf(pos.itemNumber) === -1) {
        allRackNumbers.push(pos.itemNumber);
      }
    });
  });

  Logger.log('Found ' + allRackNumbers.length + ' unique racks in overview: ' + allRackNumbers.join(', '));

  // Build rack config map (scan sheets ONCE)
  var sheets = ss.getSheets();
  var rackConfigMap = {};
  sheets.forEach(function(sheet) {
    var metadata = getRackConfigMetadata(sheet);
    if (metadata) {
      Logger.log('Found rack config sheet: ' + metadata.itemNumber + ' - ' + metadata.itemName);
      rackConfigMap[metadata.itemNumber] = {
        sheet: sheet,
        metadata: metadata,
        childCount: Math.max(0, sheet.getLastRow() - 2)
      };
    }
  });

  var rackConfigNumbers = Object.keys(rackConfigMap);
  Logger.log('Built rack config map with ' + rackConfigNumbers.length + ' racks: ' + rackConfigNumbers.join(', '));

  // Build rack position map (which row and position each rack is in)
  var rackPositionMap = {};
  overviewData.forEach(function(row) {
    row.positions.forEach(function(pos) {
      rackPositionMap[pos.itemNumber] = {
        row: row.rowNumber,
        position: pos.position
      };
    });
  });

  // Separate placeholder vs existing racks
  var placeholderRacks = [];
  var existingRacks = [];

  allRackNumbers.forEach(function(itemNumber) {
    var rackConfig = rackConfigMap[itemNumber];

    if (!rackConfig) {
      Logger.log('⚠ No rack config found for: ' + itemNumber);
      return;
    }

    // Check if exists in Arena
    var existsInArena = false;
    var arenaItem = null;

    Logger.log('Checking if rack ' + itemNumber + ' exists in Arena...');

    try {
      arenaItem = client.getItemByNumber(itemNumber);

      Logger.log('Arena API response for ' + itemNumber + ': ' + JSON.stringify(arenaItem));

      if (arenaItem && (arenaItem.guid || arenaItem.Guid)) {
        // Exists in Arena (has valid GUID)
        existsInArena = true;
        var guid = arenaItem.guid || arenaItem.Guid;
        var name = arenaItem.name || arenaItem.Name || rackConfig.metadata.itemName;
        Logger.log('✓ Rack ' + itemNumber + ' EXISTS in Arena (GUID: ' + guid + ', Name: ' + name + ')');
      } else {
        Logger.log('⚠ Arena returned response but no GUID found for ' + itemNumber);
      }
    } catch (error) {
      // Error fetching = doesn't exist in Arena
      Logger.log('✗ Rack ' + itemNumber + ' NOT FOUND in Arena: ' + error.message);
    }

    if (existsInArena) {
      // Extract category info from Arena item
      var categoryName = '';
      if (arenaItem.category || arenaItem.Category) {
        var cat = arenaItem.category || arenaItem.Category;
        categoryName = cat.name || cat.Name || '';
      }

      var position = rackPositionMap[itemNumber] || {};
      var guid = arenaItem.guid || arenaItem.Guid;

      // Compute BOM diff for Stage 3 visual preview
      var rackDiff = { added: [], modified: [], removed: [], summary: { addCount: 0, changeCount: 0, removeCount: 0 } };
      try {
        var localBOM = getCurrentRackBOMData(rackConfig.sheet);
        var arenaBOMData = client.makeRequest('/items/' + guid + '/bom', { method: 'GET' });
        var arenaBOMLines = arenaBOMData.results || arenaBOMData.Results || [];
        rackDiff = _computeWizardBOMDiff(localBOM, arenaBOMLines);
        Logger.log('  Rack BOM diff: +' + rackDiff.summary.addCount + ' ~' + rackDiff.summary.changeCount + ' -' + rackDiff.summary.removeCount);
      } catch (diffErr) {
        Logger.log('Warning: Could not compute BOM diff for existing rack ' + itemNumber + ': ' + diffErr.message);
      }

      existingRacks.push({
        itemNumber: itemNumber,
        name: arenaItem.name || arenaItem.Name || rackConfig.metadata.itemName,
        description: arenaItem.description || arenaItem.Description || rackConfig.metadata.description || '',
        category: categoryName,
        childCount: rackConfig.childCount,
        guid: guid,
        row: position.row,
        position: position.position,
        rackDiff: rackDiff
      });
      Logger.log('→ Added ' + itemNumber + ' to EXISTING racks list (category: ' + categoryName + ')');
    } else {
      // Doesn't exist in Arena - placeholder
      Logger.log('→ Adding ' + itemNumber + ' to PLACEHOLDER list');
      var position = rackPositionMap[itemNumber] || {};

      // For placeholder racks, all local BOM items are "added" (new rack)
      var placeholderDiff = { added: [], modified: [], removed: [], summary: { addCount: 0, changeCount: 0, removeCount: 0 } };
      try {
        var localBOM = getCurrentRackBOMData(rackConfig.sheet);
        localBOM.forEach(function(item) {
          placeholderDiff.added.push({ itemNumber: item.itemNumber, name: item.name || '', quantity: item.quantity });
          placeholderDiff.summary.addCount++;
        });
      } catch (diffErr) {
        Logger.log('Warning: Could not read local BOM for placeholder rack ' + itemNumber + ': ' + diffErr.message);
      }

      placeholderRacks.push({
        itemNumber: itemNumber,
        name: rackConfig.metadata.itemName || '',
        description: rackConfig.metadata.description || '',
        category: null,  // User will select
        childCount: rackConfig.childCount,
        sheetName: rackConfig.sheet.getName(),  // Store name, not object (can't pass through HTML modal)
        row: position.row,
        position: position.position,
        rackDiff: placeholderDiff
      });
    }
  });

  Logger.log('Placeholder racks: ' + placeholderRacks.length);
  Logger.log('Existing racks: ' + existingRacks.length);

  // Extract POD item number from overview sheet A1
  var podItemNumber = null;
  var podName = '';
  var podExists = false;
  var podGuid = null;
  var podCategory = null;

  var podCell = overviewSheet.getRange('A1').getValue();
  if (podCell && typeof podCell === 'string') {
    // Extract item number from format "POD: name (ITEM-NUMBER)"
    var podMatch = podCell.match(/POD:\s*(.+?)\s*\(([^)]+)\)/);
    if (podMatch) {
      podName = podMatch[1].trim();
      podItemNumber = podMatch[2].trim();
      Logger.log('Found POD in overview: ' + podName + ' (' + podItemNumber + ')');

      // Check if POD exists in Arena.
      // Try by item number first; if that fails (e.g. A1 stored a GUID as fallback),
      // try treating the stored value as a GUID via getItem().
      try {
        var podItem = null;
        try {
          podItem = client.getItemByNumber(podItemNumber);
        } catch (numErr) {
          // number lookup failed — may be a GUID stored as fallback
        }
        if (!podItem || !(podItem.guid || podItem.Guid)) {
          // Try as GUID (handles edge case where auto-number wasn't assigned on prior push)
          try {
            podItem = client.getItem(podItemNumber);
          } catch (guidErr) {
            podItem = null;
          }
        }
        if (podItem && (podItem.guid || podItem.Guid)) {
          podExists = true;
          podGuid = podItem.guid || podItem.Guid;
          if (podItem.category || podItem.Category) {
            var cat = podItem.category || podItem.Category;
            podCategory = {
              guid: cat.guid || cat.Guid,
              name: cat.name || cat.Name
            };
          }
          Logger.log('✓ POD ' + podItemNumber + ' EXISTS in Arena (GUID: ' + podGuid + ')');
        }
      } catch (error) {
        Logger.log('POD ' + podItemNumber + ' not found in Arena: ' + error.message);
      }
    }
  }

  // Prepare row data - check if each exists in Arena
  var rowsData = overviewData.map(function(row) {
    var rowItemNumber = row.rowItemNumber;
    var rowExists = false;
    var rowGuid = null;
    var rowCategory = null;
    var rowName = row.rowItemNumber || ('ROW-' + row.rowNumber);

    if (rowItemNumber) {
      // Check if row exists in Arena
      try {
        var rowItem = client.getItemByNumber(rowItemNumber);
        if (rowItem && (rowItem.guid || rowItem.Guid)) {
          rowExists = true;
          rowGuid = rowItem.guid || rowItem.Guid;
          rowName = rowItem.name || rowItem.Name || rowName;
          if (rowItem.category || rowItem.Category) {
            var cat = rowItem.category || rowItem.Category;
            rowCategory = {
              guid: cat.guid || cat.Guid,
              name: cat.name || cat.Name
            };
          }
          Logger.log('✓ ROW ' + rowItemNumber + ' EXISTS in Arena (GUID: ' + rowGuid + ')');
        }
      } catch (error) {
        Logger.log('ROW ' + rowItemNumber + ' not found in Arena: ' + error.message);
      }
    }

    return {
      rowNumber: row.rowNumber,
      rowItemNumber: rowItemNumber,
      name: rowName,
      category: rowCategory,  // May be null if new or user will select
      exists: rowExists,
      guid: rowGuid,
      sheetRow: row.sheetRow,  // 1-based sheet row index for write-back after push
      positions: row.positions.map(function(pos) {
        return {
          position: pos.position,
          itemNumber: pos.itemNumber
        };
      })
    };
  });

  return {
    success: true,
    racks: placeholderRacks,
    existingRacks: existingRacks,
    rows: rowsData,
    overviewSheetName: overviewSheet.getName(),  // Needed for post-push write-back
    pod: {
      itemNumber: podItemNumber,
      name: podName,
      category: podCategory,
      exists: podExists,
      guid: podGuid
    }
  };
}

/**
 * Shows the POD Push Wizard HTML dialog
 * This is the legacy version - kept for backwards compatibility
 */
function showPODPushWizard(wizardData) {
  var html = HtmlService.createHtmlOutputFromFile('PODPushWizard')
    .setWidth(1200)
    .setHeight(800);

  // Pass data to wizard
  var scriptlet = '<script>initializeWizard(' + JSON.stringify(wizardData) + ');</script>';
  var content = html.getContent() + scriptlet;
  html.setContent(content);

  SpreadsheetApp.getUi().showModalDialog(html, 'POD Structure Push Wizard');
}

/**
 * Shows the POD Push Wizard with pre-prepared data
 * Called from the loading modal after data is ready
 */
function showPODPushWizardWithData(wizardData) {
  Logger.log('Showing wizard with prepared data...');

  if (!wizardData.success) {
    SpreadsheetApp.getUi().alert('Error', wizardData.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var html = HtmlService.createHtmlOutputFromFile('PODPushWizard')
    .setWidth(1200)
    .setHeight(800);

  // Pass data to wizard
  var scriptlet = '<script>initializeWizard(' + JSON.stringify(wizardData) + ');</script>';
  var content = html.getContent() + scriptlet;
  html.setContent(content);

  SpreadsheetApp.getUi().showModalDialog(html, 'POD Structure Push Wizard');
}

/**
 * Transitions from loading modal to wizard
 * Called by loading modal when data is ready
 * Opens wizard then signals back so loading modal can close
 */
function transitionToWizard(wizardData) {
  Logger.log('Transitioning from loading modal to wizard...');

  // Open the wizard with prepared data
  showPODPushWizardWithData(wizardData);

  // Return success so loading modal knows wizard is open and can close itself
  return { success: true };
}

/**
 * Executes the batch POD push with data from the wizard
 * This is called by the wizard after user fills in all data
 */
/**
 * Writes current push progress to UserProperties for client polling.
 * @param {number} step - Current step index (0-based)
 * @param {number} total - Total steps
 * @param {string} message - Human-readable progress message
 */
function _setPushProgress(step, total, message) {
  PropertiesService.getUserProperties().setProperty('podPush_progress', JSON.stringify({
    step: step,
    total: total,
    message: message,
    ts: new Date().getTime()
  }));
}

/**
 * Returns the current POD push progress for client polling.
 * @return {Object} Progress object {step, total, message, ts}
 */
function getPushProgress() {
  var json = PropertiesService.getUserProperties().getProperty('podPush_progress');
  return json ? JSON.parse(json) : { step: 0, total: 1, message: 'Starting...', ts: 0 };
}

function executePODPush(wizardData) {
  Logger.log('==========================================');
  Logger.log('EXECUTING BATCH POD PUSH');
  Logger.log('==========================================');

  // Check for concurrent execution (with 10-minute auto-expiry to recover from stale locks)
  var lockJson = PropertiesService.getUserProperties().getProperty('podPush_lock');
  if (lockJson) {
    try {
      var lockData = JSON.parse(lockJson);
      var lockAge = (new Date().getTime() - (lockData.ts || 0)) / 1000;
      if (lockAge < 600) {  // 10 minutes
        throw new Error('Another POD push is already in progress. Please wait for it to complete.');
      }
      Logger.log('Stale POD push lock detected (' + Math.round(lockAge) + 's old) — overriding');
    } catch (parseErr) {
      if (parseErr.message.indexOf('already in progress') !== -1) throw parseErr;
      // Legacy string lock or corrupt data — override it
      Logger.log('Corrupt POD push lock — overriding');
    }
  }

  // Set execution lock with timestamp
  PropertiesService.getUserProperties().setProperty('podPush_lock', JSON.stringify({ ts: new Date().getTime() }));
  Logger.log('POD push lock acquired');

  // Calculate total steps for progress bar: racks + rows + 1 POD
  var totalSteps = (wizardData.racks ? wizardData.racks.length : 0) +
                   (wizardData.rows ? wizardData.rows.length : 0) + 1;
  var currentStep = 0;
  _setPushProgress(0, totalSteps, 'Starting POD push...');

  var client, createdRacks = [], createdRows = [];

  try {
    client = getArenaClient();
    // STEP 1: Create all placeholder racks (batch)
    Logger.log('Step 1: Creating ' + wizardData.racks.length + ' placeholder racks...');

    for (var i = 0; i < wizardData.racks.length; i++) {
      var rack = wizardData.racks[i];

      Logger.log('Creating rack: ' + rack.itemNumber);
      _setPushProgress(currentStep, totalSteps, 'Creating rack ' + (i + 1) + ' of ' + wizardData.racks.length + ': ' + rack.itemNumber);

      // Create item in Arena (without number initially)
      var newItem = client.createItem({
        name: rack.name,
        category: {
          guid: rack.category.guid
        },
        description: rack.description
      });

      var newItemGuid = newItem.guid || newItem.Guid;

      // Update with desired rack number
      client.updateItem(newItemGuid, { number: rack.itemNumber });

      // Get rack children and sync BOM
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var rackSheet = ss.getSheetByName(rack.sheetName);
      if (!rackSheet) {
        throw new Error('Rack config sheet not found: ' + rack.sheetName);
      }
      var children = getRackConfigChildren(rackSheet);
      var bomLines = [];

      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        var childItem = client.getItemByNumber(child.itemNumber);
        var childGuid = childItem.guid || childItem.Guid;

        bomLines.push({
          itemNumber: child.itemNumber,
          itemGuid: childGuid,
          quantity: child.quantity || 1,
          level: 0
        });
      }

      syncBOMToArena(client, newItemGuid, bomLines);

      // Update rack status — use rackSheet (already fetched); rack.sheet is not passed through the modal
      updateRackSheetStatus(rackSheet, RACK_STATUS.SYNCED, newItemGuid, {
        changesSummary: 'Rack created in Arena via POD push',
        details: 'Created with ' + bomLines.length + ' BOM items',
        lastPush: new Date()
      });
      currentStep++;

      createdRacks.push({
        itemNumber: rack.itemNumber,
        guid: newItemGuid,
        name: rack.name
      });

      Logger.log('✓ Created rack: ' + rack.itemNumber);
    }

    // Update history for racks that were already in Arena (existingRacks).
    // These bypass the creation loop above, so their status/GUID would never be
    // recorded without this pass. Failures are non-fatal — log and continue.
    if (wizardData.existingRacks && wizardData.existingRacks.length > 0) {
      Logger.log('Updating history for ' + wizardData.existingRacks.length + ' existing rack(s)...');
      var ss2 = SpreadsheetApp.getActiveSpreadsheet();
      for (var e = 0; e < wizardData.existingRacks.length; e++) {
        var existingRack = wizardData.existingRacks[e];
        try {
          var existingRackSheet = findRackConfigTab(existingRack.itemNumber);
          if (existingRackSheet) {
            updateRackSheetStatus(existingRackSheet, RACK_STATUS.SYNCED, existingRack.guid, {
              changesSummary: 'Rack already in Arena — confirmed during POD push',
              details: 'GUID recorded; rack was pre-existing at push time',
              lastPush: new Date()
            });
            Logger.log('✓ Updated history for existing rack: ' + existingRack.itemNumber);
          } else {
            Logger.log('⚠ No config sheet found for existing rack: ' + existingRack.itemNumber);
          }
        } catch (existErr) {
          Logger.log('⚠ Could not update history for existing rack ' + existingRack.itemNumber + ': ' + existErr.message);
        }
      }
    }

    // STEP 2: Create or update rows
    Logger.log('Step 2: Processing ' + wizardData.rows.length + ' rows...');

    for (var r = 0; r < wizardData.rows.length; r++) {
      var row = wizardData.rows[r];
      var rowItemGuid, rowItemNumber, rowNumericId = null, rowVersionId = null, rowDisplayName = '';

      _setPushProgress(currentStep, totalSteps, 'Processing row ' + (r + 1) + ' of ' + wizardData.rows.length + ': ' + row.name);

      if (row.exists) {
        // Row already exists - just update its BOM
        Logger.log('Row ' + row.rowItemNumber + ' exists - updating BOM...');
        rowItemGuid = row.guid;
        rowItemNumber = row.rowItemNumber;
        rowDisplayName = row.name || '';
        // numericId will be fetched lazily in _writeRowItemNumbersToOverview if needed
      } else {
        // Create new row item
        Logger.log('Creating new row: ' + row.name);

        var rowItem = client.createItem({
          name: row.name,
          category: {
            guid: row.category.guid
          },
          description: 'Row ' + row.rowNumber + ' containing ' + row.positions.length + ' racks'
        });

        rowItemGuid = rowItem.guid || rowItem.Guid;
        rowItemNumber = rowItem.number || rowItem.Number || '';
        // Capture Arena's internal numeric item/version IDs for web app URLs.
        // createItem() returns the raw API response so .id and .workingRevision are present.
        rowNumericId = rowItem.id || null;
        rowVersionId = (rowItem.workingRevision && rowItem.workingRevision.id) || null;
        rowDisplayName = rowItem.name || rowItem.Name || row.name || '';
        Logger.log('✓ Created row: ' + (rowItemNumber || rowItemGuid) + ' (numericId: ' + rowNumericId + ')');
      }

      // Create/Update BOM for row (all racks at positions)
      var rowBomLines = [];
      for (var p = 0; p < row.positions.length; p++) {
        var pos = row.positions[p];
        var rackItem = client.getItemByNumber(pos.itemNumber);
        var rackGuid = rackItem.guid || rackItem.Guid;

        rowBomLines.push({
          itemNumber: pos.itemNumber,
          itemGuid: rackGuid,
          quantity: 1,
          level: 0,
          position: pos.position
        });
      }

      syncBOMToArena(client, rowItemGuid, rowBomLines);
      Logger.log('✓ Synced BOM for row ' + (rowItemNumber || rowItemGuid) + ' (' + rowBomLines.length + ' racks)');

      createdRows.push({
        itemNumber: rowItemNumber,  // Arena-assigned part number (may be empty if auto-number pending)
        guid: rowItemGuid,
        numericId: rowNumericId,    // Arena internal numeric ID for web URLs (new rows only)
        versionId: rowVersionId,    // Arena version ID for web URLs (new rows only)
        name: rowDisplayName,
        sheetRow: row.sheetRow,     // 1-based sheet row index from wizard data
        wasNew: !row.exists
      });
      currentStep++;
    }

    // Write newly created row item numbers back to the Overview sheet so future
    // runs detect them as existing instead of prompting for re-creation.
    if (wizardData.overviewSheetName) {
      try {
        _writeRowItemNumbersToOverview(wizardData.overviewSheetName, createdRows);
      } catch (writeErr) {
        // Non-fatal: log and continue — wizard results are unaffected
        Logger.log('⚠ Could not write row item numbers to overview: ' + writeErr.message);
      }
    }

    // STEP 3: Create or update POD
    var podItemGuid, podItemNumber, podNumericId = null, podVersionId = null;
    _setPushProgress(currentStep, totalSteps, 'Creating POD item...');

    if (wizardData.pod.exists) {
      // POD already exists - just update its BOM
      Logger.log('Step 3: POD ' + wizardData.pod.itemNumber + ' exists - updating BOM...');
      podItemGuid = wizardData.pod.guid;
      podItemNumber = wizardData.pod.itemNumber;
      // Fetch numeric ID so the "Open POD in Arena" button gets a correct URL
      try {
        var existingPodRaw = client.getItem(podItemGuid);
        podNumericId = existingPodRaw._raw && existingPodRaw._raw.id;
        podVersionId = existingPodRaw._raw && existingPodRaw._raw.workingRevision && existingPodRaw._raw.workingRevision.id;
      } catch (e) {
        Logger.log('Could not fetch existing POD numeric ID: ' + e.message);
      }
    } else {
      // Create new POD
      Logger.log('Step 3: Creating new POD...');

      var podItem = client.createItem({
        name: wizardData.pod.name,
        category: {
          guid: wizardData.pod.category.guid
        },
        description: 'Point of Delivery containing ' + createdRows.length + ' rows'
      });

      podItemGuid = podItem.guid || podItem.Guid;
      // Use Arena-assigned part number; don't fall back to GUID (would break re-push detection)
      podItemNumber = podItem.number || podItem.Number || '';
      // Capture numeric item/version IDs for Arena web app URLs (different from API GUID)
      podNumericId = podItem.id || null;
      podVersionId = (podItem.workingRevision && podItem.workingRevision.id) || null;
      Logger.log('✓ Created POD: ' + (podItemNumber || podItemGuid) + ' (numericId: ' + podNumericId + ')');
    }

    _setPushProgress(currentStep, totalSteps, 'Syncing POD BOM (' + createdRows.length + ' rows)...');

    // Create/Update BOM for POD (all rows)
    // itemNumber may be a GUID string for rows created this session — that's OK,
    // syncBOMToArena only uses itemGuid for the actual API call.
    var podBomLines = createdRows.map(function(row) {
      return {
        itemNumber: row.itemNumber || row.guid,
        itemGuid: row.guid,
        quantity: 1,
        level: 0
      };
    });

    syncBOMToArena(client, podItemGuid, podBomLines);
    Logger.log('✓ Synced BOM for POD ' + podItemNumber + ' (' + podBomLines.length + ' rows)');

    // Write POD info to Overview A1 so future wizard runs detect it as EXISTS
    if (wizardData.overviewSheetName) {
      try {
        _writePODInfoToOverview(wizardData.overviewSheetName, podItemNumber, wizardData.pod.name || podItemNumber);
      } catch (podWriteErr) {
        Logger.log('⚠ Could not write POD info to overview: ' + podWriteErr.message);
      }
    }

    currentStep++;
    _setPushProgress(currentStep, totalSteps, 'Complete!');

    // Build the Arena web URL for the "Open POD in Arena" button.
    // Arena's web app requires numeric item_id, not the GUID used by the REST API.
    var podArenaUrl;
    if (podNumericId) {
      podArenaUrl = 'https://app.bom.com/items/detail-spec?item_id=' + podNumericId;
      if (podVersionId) podArenaUrl += '&version_id=' + podVersionId;
    } else {
      // Fallback: search by name if numeric ID unavailable
      podArenaUrl = 'https://app.bom.com/items/searches?searchQuery=' + encodeURIComponent(wizardData.pod.name || podItemNumber);
    }

    // Store results for completion modal.
    // podItemNumber may be empty if Arena auto-number hasn't fired yet — store name as fallback.
    PropertiesService.getUserProperties().setProperty('podPush_results', JSON.stringify({
      racksCreated: createdRacks.length,
      rowsCreated: createdRows.length,
      podItemNumber: podItemNumber || wizardData.pod.name || podItemGuid,
      podGuid: podItemGuid,
      podArenaUrl: podArenaUrl
    }));

    Logger.log('==========================================');
    Logger.log('POD PUSH COMPLETE');
    Logger.log('✓ Racks: ' + createdRacks.length);
    Logger.log('✓ Rows: ' + createdRows.length);
    Logger.log('✓ POD: ' + podItemNumber);
    Logger.log('==========================================');

    // Return success data (wizard will show completion modal after closing)
    return {
      success: true,
      racksCreated: createdRacks.length,
      rowsCreated: createdRows.length,
      podItemNumber: podItemNumber,
      podGuid: podItemGuid
    };

  } catch (error) {
    Logger.log('ERROR in batch POD push: ' + error.message);
    _setPushProgress(0, 1, 'Error: ' + error.message);
    throw error;
  } finally {
    // ALWAYS clear lock, even on error
    PropertiesService.getUserProperties().deleteProperty('podPush_lock');
    Logger.log('POD push lock released');
  }
}

/**
 * Gets POD push results from PropertiesService
 * Called by PODPushCompleteModal to display summary
 * @return {Object} Result data with racksCreated, rowsCreated, podItemNumber, podGuid
 */
function getPODPushResults() {
  var json = PropertiesService.getUserProperties().getProperty('podPush_results');
  return json ? JSON.parse(json) : { racksCreated: 0, rowsCreated: 0, podItemNumber: '', podGuid: '', podArenaUrl: '' };
}

/**
 * Shows POD push completion modal
 * Called by wizard AFTER it closes to avoid modal overlap
 * This prevents the bug where completion modal appears on top of wizard
 */
function showPODPushCompletionModal() {
  var ui = SpreadsheetApp.getUi();
  var completionHtml = HtmlService.createHtmlOutputFromFile('PODPushCompleteModal')
    .setWidth(500)
    .setHeight(400);
  ui.showModalDialog(completionHtml, 'POD Structure Complete');
}

/**
 * Opens the POD item in Arena web interface
 * Called by PODPushCompleteModal when user clicks "Open POD in Arena" button
 */
function openPODInArena() {
  try {
    var json = PropertiesService.getUserProperties().getProperty('podPush_results');
    if (!json) {
      throw new Error('No POD push results found');
    }

    var results = JSON.parse(json);
    var podGuid = results.podGuid;

    if (!podGuid) {
      throw new Error('No POD GUID found in results');
    }

    // Construct Arena item URL using individual accessors — no full credential bundle needed here
    // API base is like: https://api.arenasolutions.com/v1
    // Web URL is like: https://app.arenasolutions.com/workspace/{workspaceId}/item/{itemGuid}
    var apiBase = getApiBase();
    var workspaceId = getWorkspaceId();
    if (!workspaceId) {
      throw new Error('Arena credentials not found');
    }

    // Extract domain from API base and convert to app domain
    var domain = apiBase.replace(/^https?:\/\/api\./, 'https://app.').replace(/\/v\d+$/, '');
    var itemUrl = domain + '/workspace/' + workspaceId + '/item/' + podGuid;

    Logger.log('Opening Arena item URL: ' + itemUrl);

    // Create HTML to open URL in new tab
    var html = '<script>window.open("' + itemUrl + '", "_blank"); google.script.host.close();</script>';
    var htmlOutput = HtmlService.createHtmlOutput(html);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Opening Arena...');

  } catch (error) {
    Logger.log('Error opening POD in Arena: ' + error.message);
    throw error;
  }
}

/**
 * Gets all items from shared cache for Item Picker
 * Uses CacheService so results are shared across all features (6 hour TTL)
 * @return {Array} Array of all cached items
 */
function getAllCachedItems() {
  var client = getArenaClient();
  return client.getAllCachedItems();
}

/**
 * Shows category selector from wizard context
 * Called by PODPushWizard.html
 */
function showCategorySelector() {
  var html = HtmlService.createHtmlOutputFromFile('CategorySelector')
    .setWidth(600)
    .setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Select Category');

  // Note: Category selection is handled via returnCategorySelection()
  // which will call back to the wizard
}

/**
 * Updates overview sheet with POD and Row information
 * @param {Sheet} sheet - Overview sheet
 * @param {Object} podItem - POD item metadata
 * @param {Array} rowItems - Array of row item objects
 */
function updateOverviewWithPODInfo(sheet, podItem, rowItems) {
  // Insert column after row numbers for Row Item info
  var data = sheet.getDataRange().getValues();

  // Find header row
  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    for (var j = 0; j < row.length; j++) {
      if (row[j] && row[j].toString().toLowerCase().indexOf('pos') === 0) {
        headerRow = i + 1; // Convert to 1-based
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) return;

  // Insert new column at position 2 (after row numbers)
  sheet.insertColumnAfter(1);

  // Set header
  sheet.getRange(headerRow, 2).setValue('Row Item');
  sheet.getRange(headerRow, 2).setFontWeight('bold').setBackground('#f0f0f0');

  // Fetch full item data from Arena for building URLs
  var client = getArenaClient();

  // Add row item links
  rowItems.forEach(function(rowItem) {
    var rowArenaItem = client.getItemByNumber(rowItem.itemNumber);
    var arenaUrl = buildArenaItemURLFromItem(rowArenaItem, rowItem.itemNumber);
    var formula = '=HYPERLINK("' + arenaUrl + '", "' + rowItem.itemNumber + '")';
    sheet.getRange(rowItem.sheetRow, 2).setFormula(formula);
    sheet.getRange(rowItem.sheetRow, 2).setFontColor('#0000FF');
  });

  // Add POD info at top (in a merged cell above the grid)
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, 10).merge();
  var podArenaItem = client.getItemByNumber(podItem.itemNumber);
  var podUrl = buildArenaItemURLFromItem(podArenaItem, podItem.itemNumber);
  var podFormula = '=HYPERLINK("' + podUrl + '", "POD: ' + podItem.name + ' (' + podItem.itemNumber + ')")';
  sheet.getRange(1, 1).setFormula(podFormula);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(12).setFontColor('#0000FF');

  Logger.log('Updated overview sheet with POD and Row information');
}

/**
 * Writes row item numbers created during a wizard push back to the Overview sheet.
 * Inserts a "Row Item" column between column A (row numbers) and "Pos 1" when
 * the column doesn't already exist so future wizard runs detect existing rows.
 *
 * @param {string} overviewSheetName - Name of the overview tab
 * @param {Array}  createdRows       - Array of {itemNumber, guid, sheetRow, wasNew}
 *                                     from executePODPush's createdRows array
 */
function _writeRowItemNumbersToOverview(overviewSheetName, createdRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(overviewSheetName);
  if (!sheet) {
    Logger.log('⚠ _writeRowItemNumbersToOverview: sheet not found: ' + overviewSheetName);
    return;
  }

  var data = sheet.getDataRange().getValues();

  // Locate header row and first position column
  var headerRow = -1;
  var firstPosCol = -1;
  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < data[i].length; j++) {
      if (data[i][j] && data[i][j].toString().toLowerCase().indexOf('pos') === 0) {
        headerRow = i;
        firstPosCol = j;
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) {
    Logger.log('⚠ _writeRowItemNumbersToOverview: no position headers found');
    return;
  }

  // Determine whether a "Row Item" column already exists.
  // It would be the column immediately before the first "Pos" column (index firstPosCol - 1).
  // Column A (index 0) holds row sequence numbers and is never the "Row Item" column.
  var rowItemCol0;   // 0-indexed column that holds (or will hold) row item numbers
  var needsInsert = false;

  var candidateCol = firstPosCol - 1;
  if (candidateCol > 0) {
    // There's a column between A and the first Pos — check its header
    var candidateHeader = (data[headerRow][candidateCol] || '').toString().toLowerCase();
    if (candidateHeader.indexOf('row') !== -1) {
      rowItemCol0 = candidateCol;  // Column already exists, use it
    } else {
      // An unexpected column — insert a new one after column A anyway
      needsInsert = true;
    }
  } else {
    // firstPosCol is 1 (column B is "Pos 1") — no "Row Item" column yet
    needsInsert = true;
  }

  if (needsInsert) {
    // insertColumnAfter uses 1-based index; we want to insert after column A (col 1)
    sheet.insertColumnAfter(1);
    rowItemCol0 = 1;  // 0-indexed: new column B
    // Write header in 1-based row, 1-based col
    var headerCell = sheet.getRange(headerRow + 1, rowItemCol0 + 1);
    headerCell.setValue('Row Item').setFontWeight('bold').setBackground('#f0f0f0');
    Logger.log('Inserted "Row Item" column in overview sheet');
  }

  // Write item numbers (with clickable Arena hyperlinks) for all rows in this push.
  // Arena web URLs require numeric item_id (not GUID). For newly created rows the
  // numeric id is captured from the raw createItem response. For existing rows it
  // is fetched via getItem() so the link is always correct.
  var client = getArenaClient();
  var written = 0;
  var colIdx1 = rowItemCol0 + 1;  // 1-based column index

  for (var r = 0; r < createdRows.length; r++) {
    var cr = createdRows[r];
    if (!cr.sheetRow || !cr.guid) continue;

    var sheetRowIdx = cr.sheetRow;  // Already 1-based
    var numericId = cr.numericId;
    var versionId = cr.versionId;
    // Prefer Arena part number; fall back to item name (better than a raw GUID)
    var displayText = (cr.itemNumber && cr.itemNumber !== cr.guid) ? cr.itemNumber
                    : (cr.name || cr.guid);

    // If we don't have the numeric ID (existing rows), fetch it now
    if (!numericId) {
      try {
        var fullItem = client.getItem(cr.guid);   // normalized with ._raw
        var raw = fullItem && fullItem._raw;
        if (raw) {
          numericId = raw.id || null;
          versionId = (raw.workingRevision && raw.workingRevision.id) || null;
          // Also improve display text if part number came back
          if (!cr.itemNumber || cr.itemNumber === cr.guid) {
            displayText = fullItem.number || fullItem.name || cr.name || cr.guid;
          }
        }
      } catch (e) {
        Logger.log('Could not fetch numeric ID for row hyperlink (' + cr.guid + '): ' + e.message);
      }
    }

    if (numericId) {
      // Correct Arena web URL format: item_id=<numeric>&version_id=<numeric>
      var arenaUrl = 'https://app.bom.com/items/detail-spec?item_id=' + numericId;
      if (versionId) arenaUrl += '&version_id=' + versionId;
      var safeDisplay = displayText.replace(/"/g, '""');
      var formula = '=HYPERLINK("' + arenaUrl + '","' + safeDisplay + '")';
      sheet.getRange(sheetRowIdx, colIdx1).setFormula(formula).setFontColor('#1a73e8');
    } else {
      // Could not obtain numeric ID — write plain text at minimum
      Logger.log('⚠ No numeric ID for ' + cr.guid + ' — writing plain text');
      sheet.getRange(sheetRowIdx, colIdx1).setValue(displayText);
    }
    written++;
  }

  Logger.log('✓ Wrote ' + written + ' row item number(s) to overview sheet "' + overviewSheetName + '"');
}

/**
 * Writes (or updates) the POD item info in cell A1 of the Overview sheet so
 * future wizard runs detect the POD as existing rather than prompting for
 * re-creation.
 *
 * Detection in preparePODWizardDataForModal reads A1 and matches the pattern
 * "POD: name (ITEM-NUMBER)". This helper produces exactly that format.
 *
 * If A1 already contains POD info (from a previous push) the row is updated
 * in-place; otherwise a new row is inserted at the top so the header row and
 * data rows are not overwritten.  Note: _writeRowItemNumbersToOverview must be
 * called BEFORE this function so its sheetRow indices are written before the
 * row-insert shifts everything down.
 *
 * @param {string} overviewSheetName - Name of the overview tab
 * @param {string} podItemNumber     - Arena item number for the POD
 * @param {string} podName           - Display name for the POD
 */
function _writePODInfoToOverview(overviewSheetName, podItemNumber, podName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(overviewSheetName);
  if (!sheet) {
    Logger.log('⚠ _writePODInfoToOverview: sheet not found: ' + overviewSheetName);
    return;
  }

  // Check whether A1 already holds POD info from a prior push
  var a1Value = sheet.getRange('A1').getValue().toString();
  var alreadyHasPodRow = /POD:\s*.+\(/.test(a1Value);

  if (!alreadyHasPodRow) {
    // Insert a blank row at the very top so we don't clobber the grid header
    sheet.insertRowBefore(1);
  }

  // Write the POD text in the format the detection regex expects
  var podText = 'POD: ' + (podName || podItemNumber) + ' (' + podItemNumber + ')';

  // Merge across available columns (up to 10) for a banner look, suppress errors
  // if cells are already merged or contain data
  var numCols = Math.max(sheet.getLastColumn(), 1);
  try {
    sheet.getRange(1, 1, 1, Math.min(numCols, 10)).merge();
  } catch (mergeErr) {
    // Already merged or incompatible — just write to A1
  }
  sheet.getRange(1, 1)
    .setValue(podText)
    .setFontWeight('bold')
    .setFontSize(12)
    .setFontColor('#1a73e8');

  Logger.log('✓ Wrote POD info to overview A1: ' + podText);
}

/**
 * Repairs existing POD/Row BOMs from overview sheet
 * For when items were already created but BOMs are empty due to previous bugs
 */
function repairPODAndRowBOMs() {
  Logger.log('==========================================');
  Logger.log('REPAIR POD AND ROW BOMs - START');
  Logger.log('==========================================');

  var ui = SpreadsheetApp.getUi();
  var client = getArenaClient();

  try {
    // Find overview sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var overviewSheet = null;

    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().toLowerCase().indexOf('overview') !== -1) {
        overviewSheet = sheets[i];
        break;
      }
    }

    if (!overviewSheet) {
      ui.alert('Error', 'Overview sheet not found.', ui.ButtonSet.OK);
      return;
    }

    Logger.log('Found overview sheet: ' + overviewSheet.getName());

    // Step 1: Read POD and Row item numbers from sheet
    var data = overviewSheet.getDataRange().getValues();

    // Find POD item number (first row, should be hyperlink formula)
    var podItemNumber = null;
    var podRow = data[0][0];
    if (podRow && typeof podRow === 'string') {
      // Extract item number from format "POD: name (ITEM-NUMBER)"
      var match = podRow.match(/\(([^)]+)\)/);
      if (match) {
        podItemNumber = match[1];
      }
    }

    if (!podItemNumber) {
      ui.alert('Error', 'Could not find POD item number in overview sheet.\n\nPlease ensure the POD was created and the overview sheet has the POD link.', ui.ButtonSet.OK);
      return;
    }

    Logger.log('Found POD item number: ' + podItemNumber);

    // Step 2: Find header row and Row Item column
    var headerRow = -1;
    var rowItemCol = -1;
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      for (var j = 0; j < row.length; j++) {
        if (row[j] && row[j].toString().toLowerCase().indexOf('pos') === 0) {
          headerRow = i;
          // Row Item column should be right before Pos columns
          rowItemCol = j - 1;
          break;
        }
      }
      if (headerRow !== -1) break;
    }

    if (headerRow === -1 || rowItemCol === -1) {
      ui.alert('Error', 'Could not find row layout in overview sheet.', ui.ButtonSet.OK);
      return;
    }

    // Step 3: Extract Row item numbers and their rack placements
    var rowData = [];
    var headers = data[headerRow];
    var firstPosCol = rowItemCol + 1;

    for (var i = headerRow + 1; i < data.length; i++) {
      var row = data[i];
      var rowItemNumber = row[rowItemCol];

      // Skip if no row item number
      if (!rowItemNumber || typeof rowItemNumber !== 'string') continue;

      // Extract item number from hyperlink if needed
      if (rowItemNumber.indexOf('HYPERLINK') !== -1) {
        var match = rowItemNumber.match(/"([^"]+)"/g);
        if (match && match.length >= 2) {
          rowItemNumber = match[1].replace(/"/g, '');
        }
      }

      // Get rack placements for this row
      var rackNumbers = [];
      for (var j = firstPosCol; j < row.length; j++) {
        var cellValue = row[j];
        if (cellValue && typeof cellValue === 'string' && cellValue.trim() !== '') {
          rackNumbers.push(cellValue.trim());
        }
      }

      if (rackNumbers.length > 0) {
        rowData.push({
          rowItemNumber: rowItemNumber,
          racks: rackNumbers
        });
      }
    }

    Logger.log('Found ' + rowData.length + ' row items with rack placements');

    // Step 4: Show confirmation
    var confirmMsg = '========================================\n' +
                     'REPAIR BOM STRUCTURE\n' +
                     '========================================\n\n' +
                     'This will repair the following BOMs in Arena:\n\n' +
                     'POD Item: ' + podItemNumber + '\n' +
                     '  → Will add ' + rowData.length + ' Row items to POD BOM\n\n';

    rowData.forEach(function(row) {
      confirmMsg += 'Row Item: ' + row.rowItemNumber + '\n';
      confirmMsg += '  → Will add ' + row.racks.length + ' Rack items to Row BOM\n';
    });

    confirmMsg += '\n----------------------------------------\n';
    confirmMsg += 'This will DELETE any existing BOM lines and replace them.\n\n';
    confirmMsg += 'Continue?';

    var response = ui.alert('Confirm BOM Repair', confirmMsg, ui.ButtonSet.YES_NO);

    if (response !== ui.Button.YES) {
      ui.alert('Cancelled', 'BOM repair cancelled.', ui.ButtonSet.OK);
      return;
    }

    // Step 5: Look up POD GUID
    Logger.log('Looking up POD item: ' + podItemNumber);
    var podItem = client.getItemByNumber(podItemNumber);
    if (!podItem) {
      throw new Error('POD item not found in Arena: ' + podItemNumber);
    }
    var podGuid = podItem.guid || podItem.Guid;
    Logger.log('Found POD GUID: ' + podGuid);

    // Step 6: Repair Row BOMs
    var rowGuids = [];
    for (var i = 0; i < rowData.length; i++) {
      var row = rowData[i];

      Logger.log('Looking up Row item: ' + row.rowItemNumber);
      var rowItem = client.getItemByNumber(row.rowItemNumber);
      if (!rowItem) {
        Logger.log('WARNING: Row item not found: ' + row.rowItemNumber);
        continue;
      }
      var rowGuid = rowItem.guid || rowItem.Guid;
      Logger.log('Found Row GUID: ' + rowGuid);
      rowGuids.push({ number: row.rowItemNumber, guid: rowGuid });

      // Build BOM lines for this row (add racks)
      var bomLines = [];
      var rackCounts = {};

      // Count rack occurrences
      row.racks.forEach(function(rackNum) {
        if (!rackCounts[rackNum]) {
          rackCounts[rackNum] = 0;
        }
        rackCounts[rackNum]++;
      });

      // Look up GUIDs for each rack
      for (var rackNumber in rackCounts) {
        Logger.log('  Looking up Rack: ' + rackNumber);
        var rackItem = client.getItemByNumber(rackNumber);
        if (!rackItem) {
          Logger.log('  WARNING: Rack not found: ' + rackNumber);
          continue;
        }
        var rackGuid = rackItem.guid || rackItem.Guid;

        bomLines.push({
          itemNumber: rackNumber,
          itemGuid: rackGuid,
          quantity: rackCounts[rackNumber],
          level: 0
        });
        Logger.log('  Found Rack GUID: ' + rackNumber + ' → ' + rackGuid);
      }

      // Sync BOM to Arena
      Logger.log('Syncing BOM for Row: ' + row.rowItemNumber + ' (' + bomLines.length + ' racks)');
      syncBOMToArena(client, rowGuid, bomLines);
      Logger.log('✓ Repaired Row BOM: ' + row.rowItemNumber);
    }

    // Step 7: Repair POD BOM (add all rows)
    Logger.log('Repairing POD BOM: ' + podItemNumber);
    var podBomLines = rowGuids.map(function(row) {
      return {
        itemNumber: row.number,
        itemGuid: row.guid,
        quantity: 1,
        level: 0
      };
    });

    syncBOMToArena(client, podGuid, podBomLines);
    Logger.log('✓ Repaired POD BOM: ' + podItemNumber);

    // Success
    var successMsg = 'BOM Repair Complete!\n\n' +
                     'POD: ' + podItemNumber + '\n' +
                     '  → Added ' + rowGuids.length + ' rows to BOM\n\n';

    rowData.forEach(function(row) {
      var rackCount = row.racks.length;
      var uniqueRacks = {};
      row.racks.forEach(function(r) { uniqueRacks[r] = true; });
      successMsg += 'Row: ' + row.rowItemNumber + '\n';
      successMsg += '  → Added ' + Object.keys(uniqueRacks).length + ' unique rack types (' + rackCount + ' total)\n';
    });

    successMsg += '\n✓ All BOMs have been repaired in Arena!';

    ui.alert('Success', successMsg, ui.ButtonSet.OK);

  } catch (error) {
    Logger.log('Error repairing BOMs: ' + error.message + '\n' + error.stack);
    ui.alert('Error', 'Failed to repair BOMs:\n\n' + _getFriendlyApiError(error), ui.ButtonSet.OK);
  }
}

/**
 * Builds a proper Arena web UI URL for an item
 * @param {Object} item - Arena item object (from API)
 * @param {string} itemNumber - Arena item number (fallback)
 * @return {string} Arena web UI URL
 */
function buildArenaItemURLFromItem(item, itemNumber) {
  try {
    if (!item) {
      Logger.log('WARNING: No item object provided for ' + itemNumber + ', using search URL');
      return 'https://app.bom.com/search?query=' + encodeURIComponent(itemNumber);
    }

    // Extract item_id from Arena item.
    // normalizeArenaItem maps the raw API response to a fixed schema (guid, number,
    // name…) so item.id / item.itemId are absent after normalization.
    // item.guid IS the same identifier Arena's web UI uses for item_id, so include
    // it as a fallback.  _raw preserves the original response for edge cases.
    var itemId = item.itemId || item.ItemId || item.id || item.Id
              || item.guid   || item.Guid
              || (item._raw && (item._raw.guid || item._raw.Guid));

    // Log the full item structure to understand what Arena returns
    Logger.log('Item object keys for ' + itemNumber + ': ' + Object.keys(item).join(', '));

    // If we don't have the item ID, use search URL as fallback
    if (!itemId) {
      Logger.log('WARNING: Missing itemId for ' + itemNumber);
      Logger.log('Available properties: ' + JSON.stringify(Object.keys(item)));
      return 'https://app.bom.com/search?query=' + encodeURIComponent(itemNumber);
    }

    // Build the proper Arena web UI URL (item_id only, no version_id)
    var arenaUrl = 'https://app.bom.com/items/detail-spec?item_id=' + itemId;

    Logger.log('Built Arena URL for ' + itemNumber + ': ' + arenaUrl);
    return arenaUrl;

  } catch (error) {
    Logger.log('ERROR building Arena URL for ' + itemNumber + ': ' + error.message);
    // Fallback to search URL on error
    return 'https://app.bom.com/search?query=' + encodeURIComponent(itemNumber);
  }
}
