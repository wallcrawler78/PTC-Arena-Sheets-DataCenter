/**
 * Rack Configuration Management
 * Handles creation, metadata, and utilities for rack configuration tabs
 */

// Constants for metadata row structure
var METADATA_ROW = 1;
var HEADER_ROW = 2;
var DATA_START_ROW = 3;

var META_LABEL_COL = 1;  // Column A - "PARENT_ITEM"
var META_ITEM_NUM_COL = 2;  // Column B - Item Number
var META_ITEM_NAME_COL = 3;  // Column C - Item Name
var META_ITEM_DESC_COL = 4;  // Column D - Description
var META_HISTORY_LINK_COL = 5;  // Column E - History Link

/**
 * Validates an Arena item number format (NNN-NNNN)
 * @param {string} itemNumber - The item number to validate
 * @return {boolean} True if valid Arena item number format
 */
function _isValidArenaItemNumber(itemNumber) {
  return typeof itemNumber === 'string' && /^\d{3}-\d{4}$/.test(itemNumber.trim());
}

/**
 * Creates a new rack configuration tab
 * Prompts user for rack name and parent item
 */
function createNewRackConfiguration() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get dynamic terminology
  var entitySingular = getTerminology('entity_singular');
  var entitySingularLower = getTerminology('entity_singular_lower');

  // Step 1: Ask for entity name
  var nameResponse = ui.prompt(
    'New ' + entitySingular + ' Configuration',
    'Enter a name for this ' + entitySingularLower + ' configuration (e.g., "Primary ' + entitySingular + '"):',
    ui.ButtonSet.OK_CANCEL
  );

  if (nameResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var rackName = nameResponse.getResponseText().trim();
  if (!rackName) {
    ui.alert('Error', entitySingular + ' name cannot be empty.', ui.ButtonSet.OK);
    return;
  }

  // Step 2: Ask if linking to existing item or creating placeholder
  var linkResponse = ui.alert(
    'Parent Item',
    'Do you want to link this ' + entitySingularLower + ' configuration to an existing Arena item?\n\n' +
    'Yes - Select existing item from Arena\n' +
    'No - Enter placeholder item number (will create in Arena later)',
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (linkResponse === ui.Button.CANCEL) {
    return;
  }

  var rackItemNumber, rackItemName, rackItemDescription;
  var arenaItem = null;  // Track the Arena item if linking to existing
  var arenaBOM = null;   // Track the BOM if available

  if (linkResponse === ui.Button.YES) {
    // Option A: Select from Arena using Item Picker
    // For now, use a simple prompt (TODO: enhance with filtered Item Picker)
    var itemResponse = ui.prompt(
      'Select Parent Item',
      'Enter the Arena item number for this ' + entitySingularLower + ':',
      ui.ButtonSet.OK_CANCEL
    );

    if (itemResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    rackItemNumber = itemResponse.getResponseText().trim();
    if (!rackItemNumber) {
      ui.alert('Error', 'Item number cannot be empty.', ui.ButtonSet.OK);
      return;
    }

    // Validate Arena item number format before API call
    if (!_isValidArenaItemNumber(rackItemNumber)) {
      ui.alert('Error', 'Invalid item number format "' + rackItemNumber + '". Expected format: NNN-NNNN (e.g., 100-0042)', ui.ButtonSet.OK);
      return;
    }

    // Fetch item details from Arena
    try {
      var arenaClient = getArenaClient();
      var item = arenaClient.getItemByNumber(rackItemNumber);

      if (!item) {
        ui.alert('Error', 'Item "' + rackItemNumber + '" not found in Arena.', ui.ButtonSet.OK);
        return;
      }

      arenaItem = item;  // Store for later BOM fetch
      rackItemName = item.name || item.Name || rackName;
      rackItemDescription = item.description || item.Description || '';

      // Fetch BOM from Arena if item has one
      var itemGuid = item.guid || item.Guid;
      if (itemGuid) {
        Logger.log('Fetching BOM for item ' + rackItemNumber + ' (GUID: ' + itemGuid + ')');
        try {
          arenaBOM = arenaClient.getBOMLines(itemGuid);
          Logger.log('Fetched ' + arenaBOM.length + ' BOM lines from Arena');
        } catch (bomError) {
          Logger.log('Could not fetch BOM: ' + bomError.message);
          // Continue without BOM - user can add manually or refresh later
        }
      }

    } catch (error) {
      ui.alert('Error', 'Failed to fetch item from Arena: ' + error.message, ui.ButtonSet.OK);
      return;
    }

  } else {
    // Option B: Enter placeholder item number
    var placeholderResponse = ui.prompt(
      'Placeholder Item Number',
      'Enter a placeholder item number for this ' + entitySingularLower + ' (e.g., "' + entitySingular.toUpperCase() + '-001"):\n' +
      'This item will be created in Arena when you push the BOM.',
      ui.ButtonSet.OK_CANCEL
    );

    if (placeholderResponse.getSelectedButton() !== ui.Button.OK) {
      return;
    }

    rackItemNumber = placeholderResponse.getResponseText().trim();
    if (!rackItemNumber) {
      ui.alert('Error', 'Item number cannot be empty.', ui.ButtonSet.OK);
      return;
    }

    rackItemName = rackName;
    rackItemDescription = entitySingular + ' configuration for ' + rackName;
  }

  // Step 3: Check for duplicate parent item number
  var existingRacks = getAllRackConfigTabs();
  for (var i = 0; i < existingRacks.length; i++) {
    if (existingRacks[i].itemNumber === rackItemNumber) {
      ui.alert(
        'Duplicate Item',
        'A ' + entitySingularLower + ' configuration for item "' + rackItemNumber + '" already exists:\n' +
        'Sheet: "' + existingRacks[i].sheetName + '"\n\n' +
        'Please use a different item number or delete the existing ' + entitySingularLower + ' config.',
        ui.ButtonSet.OK
      );
      return;
    }
  }

  // Step 4: Create the new sheet
  var sheetName = entitySingular + ' - ' + rackItemNumber + ' (' + rackName + ')';
  var newSheet;

  try {
    newSheet = ss.insertSheet(sheetName);
    Logger.log('Created new sheet: ' + sheetName);
  } catch (createError) {
    ui.alert('Error', 'Failed to create sheet: ' + createError.message, ui.ButtonSet.OK);
    return;
  }

  // Step 5: Set up metadata row (Row 1)
  Logger.log('Step 5: Setting up metadata row...');
  newSheet.getRange(METADATA_ROW, META_LABEL_COL, 1, 4).setValues([
    ['PARENT_ITEM', rackItemNumber, rackItemName, rackItemDescription || '']
  ]);
  // NOTE: E1 will be set to History link below

  // Format metadata row (basic info only, columns A-D)
  var metaRange = newSheet.getRange(METADATA_ROW, 1, 1, 4);
  metaRange.setBackground('#e8f0fe');
  metaRange.setFontWeight('bold');
  metaRange.setFontColor('#1967d2');
  Logger.log('Metadata row created successfully');

  // Step 5b: Initialize rack in History tab
  // Status depends on whether we linked to Arena item with BOM
  var initialStatus = RACK_STATUS.PLACEHOLDER;
  var arenaGuid = '';
  if (arenaItem) {
    arenaGuid = arenaItem.guid || arenaItem.Guid || '';
    if (arenaBOM && arenaBOM.length > 0) {
      initialStatus = RACK_STATUS.SYNCED;  // Has Arena data
    }
  }

  createRackHistorySummaryRow(rackItemNumber, rackItemName, {
    status: initialStatus,
    arenaGuid: arenaGuid,
    created: new Date(),
    lastRefresh: '',
    lastSync: arenaGuid ? new Date() : '',
    lastPush: '',
    checksum: ''
  });

  // Log rack creation event
  addRackHistoryEvent(rackItemNumber, HISTORY_EVENT.RACK_CREATED, {
    changesSummary: 'New rack configuration created' + (arenaBOM && arenaBOM.length > 0 ? ' with BOM from Arena' : ''),
    details: 'Rack configuration sheet created: ' + rackItemName + (arenaBOM && arenaBOM.length > 0 ? ' (' + arenaBOM.length + ' components)' : ''),
    statusAfter: initialStatus
  });

  // Step 5c: Add History link in D1
  try {
    createHistoryLinkInRackSheet(newSheet);
  } catch (historyLinkError) {
    Logger.log('Warning: Could not create history link: ' + historyLinkError.message);
  }

  // Step 6: Set up header row (Row 2)
  Logger.log('Step 6: Setting up header row...');

  try {
    var itemColumns = getItemColumns();
    Logger.log('Got item columns: ' + JSON.stringify(itemColumns));

    var headers = ['Item Number', 'Name', 'Description', 'Category', 'Lifecycle', 'Qty'];
    Logger.log('Base headers created: ' + headers.join(', '));

    // Add configured attribute columns
    itemColumns.forEach(function(col) {
      headers.push(col.header || col.attributeName);
    });
    Logger.log('Final headers with custom columns: ' + headers.join(', '));

    var headerRange = newSheet.getRange(HEADER_ROW, 1, 1, headers.length);
    Logger.log('Header range: Row ' + HEADER_ROW + ', 1, 1, ' + headers.length);

    headerRange.setValues([headers]);
    Logger.log('Headers set successfully');

    headerRange.setBackground('#1a73e8');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    Logger.log('Header formatting applied');
  } catch (headerError) {
    Logger.log('ERROR in Step 6 (headers): ' + headerError.message);
    Logger.log('Stack trace: ' + headerError.stack);
    throw new Error('Failed to create header row: ' + headerError.message);
  }

  // Step 7: Freeze rows 1 and 2
  Logger.log('Step 7: Freezing rows...');
  newSheet.setFrozenRows(HEADER_ROW);
  Logger.log('Rows frozen successfully');

  // Step 8: Set column widths
  newSheet.setColumnWidth(1, 120);  // Item Number
  newSheet.setColumnWidth(2, 200);  // Name
  newSheet.setColumnWidth(3, 300);  // Description
  newSheet.setColumnWidth(4, 150);  // Category
  newSheet.setColumnWidth(5, 120);  // Lifecycle
  newSheet.setColumnWidth(6, 60);   // Qty

  // Step 8b: Enable text wrapping for Description column
  newSheet.getRange('C:C').setWrap(true);

  // Step 9: Populate BOM if available, otherwise add instructions
  if (arenaBOM && arenaBOM.length > 0) {
    Logger.log('Populating BOM with ' + arenaBOM.length + ' items from Arena');

    try {
      // Populate BOM data to the sheet
      populateRackBOMFromArena(newSheet, arenaBOM, arenaClient);

      // Update status with checksum
      var checksum = calculateBOMChecksum(newSheet);
      updateRackHistorySummary(rackItemNumber, rackItemName, {
        checksum: checksum
      });

      Logger.log('BOM populated successfully with checksum: ' + checksum);
    } catch (bomPopError) {
      Logger.log('Error populating BOM: ' + bomPopError.message);
      // Fall back to showing instruction message
      newSheet.getRange(DATA_START_ROW, 1).setValue('Use Item Picker to add components →');
      newSheet.getRange(DATA_START_ROW, 1, 1, headers.length).setFontStyle('italic').setFontColor('#666666');
    }
  } else {
    // No BOM available - show instruction message
    newSheet.getRange(DATA_START_ROW, 1).setValue('Use Item Picker to add components →');
    newSheet.getRange(DATA_START_ROW, 1, 1, headers.length).setFontStyle('italic').setFontColor('#666666');
  }

  // Step 10: Set tab color to cascading blue
  var rackIndex = getAllRackConfigTabs().length;  // Get count including this new one
  var blueColor = getCascadingBlueColor(rackIndex - 1);  // Subtract 1 for zero-based index
  newSheet.setTabColor(blueColor);

  // Step 10b: Update tab name with status indicator
  updateRackTabName(newSheet);

  // Step 11: Force all pending changes to be applied immediately
  Logger.log('Step 11: Flushing spreadsheet changes...');
  SpreadsheetApp.flush();
  Logger.log('Spreadsheet flushed successfully');

  // Step 12: Activate the new sheet
  newSheet.activate();

  var successMessage = 'Rack configuration sheet created successfully!\n\n' +
    'Sheet: "' + sheetName + '"\n' +
    'Parent Item: ' + rackItemNumber + '\n\n';

  if (arenaBOM && arenaBOM.length > 0) {
    successMessage += '✓ BOM automatically populated with ' + arenaBOM.length + ' component(s) from Arena.';
  } else {
    successMessage += 'Use the Item Picker to add components to this rack.';
  }

  ui.alert(
    'Rack Configuration Created',
    successMessage,
    ui.ButtonSet.OK
  );
}

/**
 * Gets metadata from a rack configuration sheet
 * @param {Sheet} sheet - The sheet to read metadata from
 * @return {Object|null} Metadata object or null if not a rack config
 */
function getRackConfigMetadata(sheet) {
  if (!sheet) return null;
  try {
    var metaValues = sheet.getRange(METADATA_ROW, META_LABEL_COL, 1, 4).getValues()[0];
    var label = metaValues[0];
    if (label !== 'PARENT_ITEM') {
      return null;
    }
    return {
      itemNumber:  metaValues[1],
      itemName:    metaValues[2],
      description: metaValues[3],
      sheetName:   sheet.getName(),
      sheet:       sheet
    };
  } catch (error) {
    Logger.log('Error reading metadata from sheet "' + sheet.getName() + '": ' + error.message);
    return null;
  }
}

/**
 * Checks if a sheet is a rack configuration sheet
 * @param {Sheet} sheet - Sheet to check
 * @return {boolean} True if rack config sheet
 */
function isRackConfigSheet(sheet) {
  return getRackConfigMetadata(sheet) !== null;
}

/**
 * Renames a rack configuration
 * Updates sheet name, metadata cells (B1, C1, D1), and history tab
 * @param {string} oldItemNumber - Current item number (identifier)
 * @param {string} newItemNumber - New item number
 * @param {string} newItemName - New item name
 * @param {string} newDescription - New description (optional)
 * @return {Object} Result object with success status and message
 */
function renameRackConfiguration(oldItemNumber, newItemNumber, newItemName, newDescription) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Find the rack configuration sheet
    var rackSheet = findRackConfigTab(oldItemNumber);
    if (!rackSheet) {
      return {
        success: false,
        message: 'Rack configuration not found for item number: ' + oldItemNumber
      };
    }

    // Get current metadata
    var currentItemNumber = rackSheet.getRange(METADATA_ROW, META_ITEM_NUM_COL).getValue();
    var currentItemName = rackSheet.getRange(METADATA_ROW, META_ITEM_NAME_COL).getValue();

    // Validate new item number doesn't already exist (unless it's the same)
    if (newItemNumber !== oldItemNumber) {
      var existingSheet = findRackConfigTab(newItemNumber);
      if (existingSheet) {
        return {
          success: false,
          message: 'A rack configuration with item number "' + newItemNumber + '" already exists'
        };
      }
    }

    // Update metadata cells
    rackSheet.getRange(METADATA_ROW, META_ITEM_NUM_COL).setValue(newItemNumber);
    rackSheet.getRange(METADATA_ROW, META_ITEM_NAME_COL).setValue(newItemName);

    if (newDescription !== undefined && newDescription !== null) {
      rackSheet.getRange(METADATA_ROW, META_ITEM_DESC_COL).setValue(newDescription);
    } else {
      // Auto-generate description if not provided
      var entitySingular = getTerminology('entity_singular');
      newDescription = entitySingular + ' configuration for ' + newItemName;
      rackSheet.getRange(METADATA_ROW, META_ITEM_DESC_COL).setValue(newDescription);
    }

    // Update sheet name
    var entitySingular = getTerminology('entity_singular');
    var newSheetName = entitySingular + ' - ' + newItemNumber + ' (' + newItemName + ')';

    // Check if new sheet name is unique
    var existingSheetWithName = ss.getSheetByName(newSheetName);
    if (existingSheetWithName && existingSheetWithName.getSheetId() !== rackSheet.getSheetId()) {
      return {
        success: false,
        message: 'A sheet with name "' + newSheetName + '" already exists'
      };
    }

    rackSheet.setName(newSheetName);

    // Update History tab if item number changed
    if (newItemNumber !== oldItemNumber) {
      updateRackHistoryItemNumber(oldItemNumber, newItemNumber, newItemName);
    } else {
      // Just update the name in history
      updateRackHistoryName(newItemNumber, newItemName);
    }

    Logger.log('Successfully renamed rack: ' + oldItemNumber + ' -> ' + newItemNumber + ' (' + newItemName + ')');

    return {
      success: true,
      message: 'Rack configuration renamed successfully',
      newSheetName: newSheetName,
      newItemNumber: newItemNumber,
      newItemName: newItemName
    };

  } catch (error) {
    Logger.log('Error renaming rack configuration: ' + error.message);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Gets all rack configuration tabs in the spreadsheet
 * @return {Array<Object>} Array of rack config metadata objects
 */
function getAllRackConfigTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var rackConfigs = [];

  sheets.forEach(function(sheet) {
    var metadata = getRackConfigMetadata(sheet);
    if (metadata) {
      // Add child item count
      var lastRow = sheet.getLastRow();
      var childItemCount = Math.max(0, lastRow - HEADER_ROW);
      metadata.childItemCount = childItemCount;

      rackConfigs.push(metadata);
    }
  });

  return rackConfigs;
}

/**
 * Finds a rack configuration tab by parent item number
 * @param {string} itemNumber - Parent rack item number to search for
 * @return {Sheet|null} Rack config sheet or null if not found
 */
function findRackConfigTab(itemNumber) {
  if (!itemNumber) return null;

  var rackConfigs = getAllRackConfigTabs();

  // Normalize search term: trim whitespace and convert to uppercase for case-insensitive matching
  var normalizedSearch = itemNumber.toString().trim().toUpperCase();

  Logger.log('findRackConfigTab: Searching for "' + itemNumber + '" (normalized: "' + normalizedSearch + '")');

  for (var i = 0; i < rackConfigs.length; i++) {
    var configItemNumber = rackConfigs[i].itemNumber ? rackConfigs[i].itemNumber.toString().trim().toUpperCase() : '';

    Logger.log('  Comparing with rack config: "' + rackConfigs[i].itemNumber + '" (normalized: "' + configItemNumber + '")');

    if (configItemNumber === normalizedSearch) {
      Logger.log('  ✓ MATCH FOUND: ' + rackConfigs[i].sheetName);
      return rackConfigs[i].sheet;
    }
  }

  Logger.log('  ✗ No matching rack config found for "' + itemNumber + '"');
  return null;
}

/**
 * Updates metadata for a rack configuration sheet
 * @param {Sheet} sheet - Rack config sheet to update
 * @param {string} itemNumber - New item number
 * @param {string} itemName - New item name
 * @param {string} description - New description
 */
function updateRackConfigMetadata(sheet, itemNumber, itemName, description) {
  if (!isRackConfigSheet(sheet)) {
    throw new Error('Sheet "' + sheet.getName() + '" is not a rack configuration sheet.');
  }

  // Update metadata cells
  sheet.getRange(METADATA_ROW, META_ITEM_NUM_COL, 1, 3).setValues([
    [itemNumber, itemName, description]
  ]);

  // Update sheet name
  var newSheetName = 'Rack - ' + itemNumber + ' (' + itemName + ')';
  sheet.setName(newSheetName);

  Logger.log('Updated rack config metadata: ' + newSheetName);
}

/**
 * Gets all child items from a rack configuration sheet
 * @param {Sheet} sheet - Rack config sheet
 * @return {Array<Object>} Array of child items with quantities
 */
function getRackConfigChildren(sheet) {
  if (!isRackConfigSheet(sheet)) {
    throw new Error('Sheet "' + sheet.getName() + '" is not a rack configuration sheet.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    return [];  // No data rows
  }

  var dataRange = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, 5);  // Get first 5 columns
  var values = dataRange.getValues();

  var children = [];

  values.forEach(function(row) {
    var itemNumber = row[0];
    var itemName = row[1];
    var description = row[2];
    var category = row[3];
    var qty = row[4];

    // Skip empty rows and instruction row
    if (!itemNumber || typeof itemNumber !== 'string') {
      return;
    }

    // Skip instruction text
    if (itemNumber.indexOf('Use Item Picker') !== -1) {
      return;
    }

    // Validate quantity
    if (!qty || isNaN(qty) || qty <= 0) {
      qty = 1;  // Default to 1
    }

    children.push({
      itemNumber: itemNumber,
      name: itemName,
      description: description,
      category: category,
      quantity: Number(qty)
    });
  });

  return children;
}

/**
 * Validates all rack configurations
 * Checks for issues like missing items, invalid quantities, etc.
 * @return {Array<string>} Array of warning messages
 */
function validateRackConfigurations() {
  var warnings = [];
  var rackConfigs = getAllRackConfigTabs();
  var arenaClient = getArenaClient(); // Single client for all validations — Phase 1 A1 singleton

  rackConfigs.forEach(function(config) {
    // Check if parent item exists in Arena
    try {
      var item = arenaClient.getItemByNumber(config.itemNumber);
      if (!item) {
        warnings.push('Rack "' + config.sheetName + '": Parent item "' + config.itemNumber + '" not found in Arena');
      }
    } catch (error) {
      warnings.push('Rack "' + config.sheetName + '": Failed to validate parent item - ' + error.message);
    }

    // Check for child items
    var children = getRackConfigChildren(config.sheet);
    if (children.length === 0) {
      warnings.push('Rack "' + config.sheetName + '": No child items configured');
    }

    // Validate child quantities
    children.forEach(function(child) {
      if (child.quantity <= 0) {
        warnings.push('Rack "' + config.sheetName + '": Item "' + child.itemNumber + '" has invalid quantity: ' + child.quantity);
      }
    });
  });

  return warnings;
}

/**
 * Gets a cascading blue color for rack tabs
 * Returns different shades of blue based on index
 * @param {number} index - Zero-based index of the rack
 * @return {string} Hex color code
 */
function getCascadingBlueColor(index) {
  // Array of blue shades from darker to lighter
  var blueShades = [
    '#0d47a1', // Dark blue
    '#1565c0', // Medium dark blue
    '#1976d2', // Medium blue
    '#1e88e5', // Medium light blue
    '#2196f3', // Light blue
    '#42a5f5', // Lighter blue
    '#64b5f6', // Very light blue
    '#90caf9'  // Lightest blue
  ];

  // Cycle through colors if we have more racks than colors
  return blueShades[index % blueShades.length];
}

/**
 * Populates a rack BOM sheet with data from Arena
 * Fetches full item details for each BOM line
 * @param {Sheet} sheet - The rack configuration sheet
 * @param {Array<Object>} arenaBOMLines - BOM lines from Arena API
 * @param {ArenaAPIClient} arenaClient - Arena API client
 */
function populateRackBOMFromArena(sheet, arenaBOMLines, arenaClient) {
  Logger.log('populateRackBOMFromArena: Populating ' + arenaBOMLines.length + ' BOM lines');

  var rowData = [];

  Logger.log('populateRackBOMFromArena: Pre-warming item cache for ' + arenaBOMLines.length + ' BOM lines...');
  try {
    if (!CacheService.getScriptCache().get(ITEM_CACHE_KEY)) {
      arenaClient.refreshItemCache();
      Logger.log('populateRackBOMFromArena: Cache refreshed successfully');
    } else {
      Logger.log('populateRackBOMFromArena: Cache already warm');
    }
  } catch (cacheErr) {
    Logger.log('populateRackBOMFromArena: Cache warm-up failed: ' + cacheErr.message);
  }

  arenaBOMLines.forEach(function(line, index) {
    try {
      var bomItem = line.item || line.Item || {};
      var itemNumber = bomItem.number || bomItem.Number || '';
      var itemGuid = bomItem.guid || bomItem.Guid || '';
      var quantity = line.quantity || line.Quantity || 1;

      if (!itemNumber) {
        Logger.log('populateRackBOMFromArena: Skipping line ' + (index + 1) + ' - no item number');
        return;
      }

      Logger.log('populateRackBOMFromArena: Fetching details for ' + itemNumber);

      // Use cache instead of per-item API call
      var fullItem = arenaClient.getItemByNumber(itemNumber);
      if (!fullItem && itemGuid) {
        try {
          fullItem = arenaClient.getItem(itemGuid);
        } catch (e) {
          Logger.log('populateRackBOMFromArena: Fallback API call failed for ' + itemNumber + ': ' + e.message);
          fullItem = bomItem;
        }
      }

      // Extract fields
      var name = fullItem.name || fullItem.Name || '';
      var description = fullItem.description || fullItem.Description || '';
      var categoryName = '';
      if (fullItem.category || fullItem.Category) {
        var cat = fullItem.category || fullItem.Category;
        categoryName = cat.name || cat.Name || '';
      }
      var lifecycleName = '';
      if (fullItem.lifecyclePhase || fullItem.LifecyclePhase) {
        var lc = fullItem.lifecyclePhase || fullItem.LifecyclePhase;
        lifecycleName = lc.name || lc.Name || '';
      }

      // Build row: [Item Number, Name, Description, Category, Lifecycle, Qty]
      var row = [
        itemNumber,
        name,
        description,
        categoryName,
        lifecycleName,
        quantity
      ];

      // TODO: Add custom attribute columns if configured
      // For now, just add the base 6 columns

      rowData.push(row);

      Logger.log('populateRackBOMFromArena: Added ' + itemNumber + ' - ' + name);

    } catch (error) {
      Logger.log('populateRackBOMFromArena: Error processing line ' + (index + 1) + ': ' + error.message);
    }
  });

  // Write data to sheet starting at row 3
  if (rowData.length > 0) {
    sheet.getRange(DATA_START_ROW, 1, rowData.length, 6).setValues(rowData);
    Logger.log('populateRackBOMFromArena: Wrote ' + rowData.length + ' rows to sheet');
  } else {
    Logger.log('populateRackBOMFromArena: No data to write');
  }
}
