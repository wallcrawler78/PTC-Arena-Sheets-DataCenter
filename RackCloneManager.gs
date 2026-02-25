/**
 * Rack Clone Manager
 * Handles cloning existing rack configurations and creating racks from Arena templates
 * Supports the "150% configuration" workflow: load comprehensive BOM, trim down, push to Arena
 */

// ============================================================================
// CORE CLONE FUNCTIONS
// ============================================================================

/**
 * Clones an existing rack configuration to create a new rack
 * Creates a PLACEHOLDER rack with copied BOM data
 * @param {string} sourceRackNumber - Source rack item number to clone from
 * @param {string} newRackNumber - New rack item number
 * @param {string} newRackName - New rack name
 * @param {string} newDescription - New rack description (optional)
 * @return {Object} Result object with success status and details
 */
function cloneRackConfiguration(sourceRackNumber, newRackNumber, newRackName, newDescription) {
  try {
    Logger.log('=== CLONE RACK CONFIGURATION START ===');
    Logger.log('Source: ' + sourceRackNumber);
    Logger.log('New: ' + newRackNumber + ' (' + newRackName + ')');

    // Step 1: Validate inputs
    var validation = validateCloneInputs(sourceRackNumber, newRackNumber, newRackName);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.errors.join('\n'),
        errors: validation.errors
      };
    }

    // Step 2: Find source rack sheet
    var sourceSheet = findRackConfigTab(sourceRackNumber);
    if (!sourceSheet) {
      return {
        success: false,
        message: 'Source rack "' + sourceRackNumber + '" not found.'
      };
    }

    Logger.log('Found source sheet: ' + sourceSheet.getName());

    // Step 3: Read BOM data from source
    var bomData = readRackBOMData(sourceSheet);
    Logger.log('Read ' + bomData.length + ' BOM lines from source');

    if (bomData.length === 0) {
      return {
        success: false,
        message: 'Source rack has no BOM data to clone.'
      };
    }

    // Step 4: Create new rack sheet structure
    var entitySingular = getTerminology('entity_singular');
    var sheetName = entitySingular + ' - ' + newRackNumber + ' (' + newRackName + ')';

    // Auto-generate description if not provided
    if (!newDescription) {
      newDescription = 'Cloned from ' + sourceRackNumber;
    }

    var newSheet = createRackSheetStructure(newRackNumber, newRackName, newDescription, sheetName);
    Logger.log('Created new sheet structure: ' + sheetName);

    // Step 5: Copy BOM rows to new sheet
    copyBOMRowsToSheet(newSheet, bomData);
    Logger.log('Copied ' + bomData.length + ' BOM rows to new sheet');

    // Step 6: Apply rack tab formatting (colors, freeze, etc.)
    applyRackTabFormatting(newSheet);
    Logger.log('Applied formatting to new sheet');

    // Step 7: Set status as PLACEHOLDER
    var checksum = calculateBOMChecksum(newSheet);
    createRackHistorySummaryRow(newRackNumber, newRackName, {
      status: RACK_STATUS.PLACEHOLDER,
      arenaGuid: '',
      created: new Date(),
      lastRefresh: '',
      lastSync: '',
      lastPush: '',
      checksum: checksum
    });

    // Step 8: Log history event - RACK_CLONED
    addRackHistoryEvent(newRackNumber, HISTORY_EVENT.RACK_CLONED, {
      changesSummary: 'Rack cloned from ' + sourceRackNumber,
      details: 'Cloned ' + bomData.length + ' components from ' + sourceRackNumber + ' (' + sourceSheet.getName() + ')',
      statusAfter: RACK_STATUS.PLACEHOLDER
    });

    // Step 9: Add History link
    createHistoryLinkInRackSheet(newSheet);

    // Step 10: Update tab name with status indicator
    updateRackTabName(newSheet);

    // Step 11: Activate new sheet
    newSheet.activate();

    Logger.log('=== CLONE RACK CONFIGURATION COMPLETE ===');

    return {
      success: true,
      message: 'Successfully cloned rack configuration',
      newSheetName: sheetName,
      newRackNumber: newRackNumber,
      newRackName: newRackName,
      componentCount: bomData.length
    };

  } catch (error) {
    Logger.log('ERROR in cloneRackConfiguration: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    return {
      success: false,
      message: 'Error cloning rack: ' + error.message
    };
  }
}

/**
 * Creates a new rack from an Arena item's BOM (template mode)
 * Loads full BOM from Arena as a starting point for customization
 * @param {string} arenaItemNumber - Arena item number to load as template
 * @param {string} newRackNumber - New rack item number
 * @param {string} newRackName - New rack name
 * @param {string} newDescription - New rack description (optional)
 * @param {Array} selectedComponents - Optional array of pre-selected components from preview
 * @return {Object} Result object with success status and details
 */
function createRackFromArenaTemplate(arenaItemNumber, newRackNumber, newRackName, newDescription, selectedComponents) {
  try {
    Logger.log('=== CREATE RACK FROM ARENA TEMPLATE START ===');
    Logger.log('Template Item: ' + arenaItemNumber);
    Logger.log('New: ' + newRackNumber + ' (' + newRackName + ')');

    if (selectedComponents && selectedComponents.length > 0) {
      Logger.log('Using ' + selectedComponents.length + ' pre-selected components');
    }

    // Step 1: Validate inputs
    var validation = validateCloneInputs(null, newRackNumber, newRackName);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.errors.join('\n'),
        errors: validation.errors
      };
    }

    // Step 2: Get BOM data (either from selectedComponents or fetch from Arena)
    var arenaClient = getArenaClient();
    var arenaBOM;

    if (selectedComponents && selectedComponents.length > 0) {
      // Use pre-selected components (from preview dialog)
      Logger.log('Using pre-selected components from UI');
      arenaBOM = selectedComponents.map(function(comp) {
        // Reconstruct BOM line format
        return comp.rawBOMLine || {
          item: {
            number: comp.itemNumber,
            Number: comp.itemNumber,
            name: comp.itemName,
            Name: comp.itemName
          },
          quantity: comp.quantity,
          Quantity: comp.quantity
        };
      });
    } else {
      // Fetch full BOM from Arena (backward compatibility)
      Logger.log('Fetching full BOM from Arena');

      var arenaItem = arenaClient.getItemByNumber(arenaItemNumber);
      if (!arenaItem) {
        return {
          success: false,
          message: 'Arena item "' + arenaItemNumber + '" not found.'
        };
      }

      var itemGuid = arenaItem.guid || arenaItem.Guid;
      if (!itemGuid) {
        return {
          success: false,
          message: 'Arena item has no GUID.'
        };
      }

      Logger.log('Fetching BOM for item GUID: ' + itemGuid);

      var bomResponse = arenaClient.makeRequest('/items/' + itemGuid + '/bom', { method: 'GET' });
      arenaBOM = bomResponse.results || bomResponse.Results || [];
    }

    if (!arenaBOM || arenaBOM.length === 0) {
      return {
        success: false,
        message: 'No BOM components to load as template.'
      };
    }

    Logger.log('Using ' + arenaBOM.length + ' BOM lines for template');

    // Step 3: Create new rack sheet structure
    var entitySingular = getTerminology('entity_singular');
    var sheetName = entitySingular + ' - ' + newRackNumber + ' (' + newRackName + ')';

    // Auto-generate description if not provided
    if (!newDescription) {
      newDescription = 'Template loaded from ' + arenaItemNumber;
    }

    var newSheet = createRackSheetStructure(newRackNumber, newRackName, newDescription, sheetName);
    Logger.log('Created new sheet structure: ' + sheetName);

    // Step 4: Populate BOM from Arena (reuse existing function)
    populateRackBOMFromArena(newSheet, arenaBOM, arenaClient);
    Logger.log('Populated BOM from Arena template');

    // Step 5: Add instruction row at top (Row 3)
    insertTemplateInstructionRow(newSheet, arenaItemNumber, arenaBOM.length);

    // Step 6: Apply rack tab formatting
    applyRackTabFormatting(newSheet);
    Logger.log('Applied formatting to new sheet');

    // Step 7: Set status as PLACEHOLDER (not synced - this is key!)
    var checksum = calculateBOMChecksum(newSheet);
    createRackHistorySummaryRow(newRackNumber, newRackName, {
      status: RACK_STATUS.PLACEHOLDER,
      arenaGuid: '',  // No GUID - this is a template, not synced
      created: new Date(),
      lastRefresh: '',
      lastSync: '',
      lastPush: '',
      checksum: checksum
    });

    // Step 8: Log history event - TEMPLATE_LOADED
    addRackHistoryEvent(newRackNumber, HISTORY_EVENT.TEMPLATE_LOADED, {
      changesSummary: 'Template loaded from Arena item ' + arenaItemNumber,
      details: 'Loaded ' + arenaBOM.length + ' components from ' + arenaItemNumber + ' as template for customization',
      statusAfter: RACK_STATUS.PLACEHOLDER
    });

    // Step 9: Add History link
    createHistoryLinkInRackSheet(newSheet);

    // Step 10: Update tab name with status indicator
    updateRackTabName(newSheet);

    // Step 11: Activate new sheet
    newSheet.activate();

    Logger.log('=== CREATE RACK FROM ARENA TEMPLATE COMPLETE ===');

    return {
      success: true,
      message: 'Successfully loaded Arena template',
      newSheetName: sheetName,
      newRackNumber: newRackNumber,
      newRackName: newRackName,
      templateItemNumber: arenaItemNumber,
      componentCount: arenaBOM.length
    };

  } catch (error) {
    Logger.log('ERROR in createRackFromArenaTemplate: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    return {
      success: false,
      message: 'Error loading Arena template: ' + error.message
    };
  }
}

/**
 * Gets a preview of an Arena item's BOM before loading as template
 * Used by UI to show confirmation dialog
 * @param {string} arenaItemNumber - Arena item number
 * @return {Object} Preview object with item details and component summary
 */
function getArenaTemplateBOMPreview(arenaItemNumber) {
  try {
    Logger.log('Getting Arena template preview for: ' + arenaItemNumber);

    var arenaClient = getArenaClient();
    var arenaItem = arenaClient.getItemByNumber(arenaItemNumber);

    if (!arenaItem) {
      return {
        success: false,
        message: 'Item not found in Arena'
      };
    }

    var itemGuid = arenaItem.guid || arenaItem.Guid;
    if (!itemGuid) {
      return {
        success: false,
        message: 'Item has no GUID'
      };
    }

    // Fetch BOM
    var bomResponse = arenaClient.makeRequest('/items/' + itemGuid + '/bom', { method: 'GET' });
    var arenaBOM = bomResponse.results || bomResponse.Results || [];

    if (arenaBOM.length === 0) {
      return {
        success: false,
        message: 'Item has no BOM components'
      };
    }

    // Get ALL components for preview (user will select which to include)
    // No per-item API calls needed — use BOM response data directly
    Logger.log('RackCloneManager: Using cached item data for preview (no extra API calls)');
    var allComponents = [];

    arenaBOM.forEach(function(line) {
      var bomItem = line.item || line.Item || {};
      var itemNumber = bomItem.number || bomItem.Number || '';
      var itemName = bomItem.name || bomItem.Name || '';
      var quantity = line.quantity || line.Quantity || 1;

      if (itemNumber) {
        allComponents.push({
          itemNumber: itemNumber,
          itemName: itemName,
          quantity: quantity,
          rawBOMLine: line  // Keep raw data for later use
        });
      }
    });

    // Analyze categories (if available)
    var categorySet = {};
    arenaBOM.forEach(function(line) {
      var bomItem = line.item || line.Item || {};
      var category = bomItem.category || bomItem.Category || {};
      var categoryName = category.name || category.Name || 'Uncategorized';
      categorySet[categoryName] = true;
    });

    var categories = Object.keys(categorySet);

    // Also return first 10 for backward compatibility
    var firstComponents = allComponents.slice(0, Math.min(10, allComponents.length));

    return {
      success: true,
      itemNumber: arenaItem.number || arenaItem.Number || arenaItemNumber,
      itemName: arenaItem.name || arenaItem.Name || '',
      componentCount: arenaBOM.length,
      allComponents: allComponents,      // NEW: All components for selection
      firstComponents: firstComponents,   // For backward compatibility
      categories: categories,
      hasMore: arenaBOM.length > 10
    };

  } catch (error) {
    Logger.log('ERROR in getArenaTemplateBOMPreview: ' + error.message);
    return {
      success: false,
      message: 'Error fetching preview: ' + error.message
    };
  }
}

/**
 * Quick clone from currently active rack sheet
 * Prompts for new name only (auto-generates item number)
 * @param {string} newRackNumber - New rack item number
 * @param {string} newRackName - New rack name
 * @param {string} newDescription - New description (optional)
 * @return {Object} Result object
 */
function cloneCurrentRackConfiguration(newRackNumber, newRackName, newDescription) {
  try {
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Verify it's a rack config sheet
    if (!isRackConfigSheet(activeSheet)) {
      return {
        success: false,
        message: 'Current sheet is not a rack configuration. Please open a rack sheet first.'
      };
    }

    var metadata = getRackConfigMetadata(activeSheet);
    if (!metadata) {
      return {
        success: false,
        message: 'Could not read rack metadata.'
      };
    }

    var sourceRackNumber = metadata.itemNumber;

    // Call main clone function
    return cloneRackConfiguration(sourceRackNumber, newRackNumber, newRackName, newDescription);

  } catch (error) {
    Logger.log('ERROR in cloneCurrentRackConfiguration: ' + error.message);
    return {
      success: false,
      message: 'Error cloning current rack: ' + error.message
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Reads BOM data from a rack configuration sheet
 * Returns array of row data objects
 * @param {Sheet} sheet - Rack configuration sheet
 * @return {Array} Array of BOM row objects
 */
function readRackBOMData(sheet) {
  var bomData = [];

  try {
    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      return bomData; // No BOM data
    }

    // Read all columns (including custom attribute columns)
    var itemColumns = getItemColumns();
    var totalColumns = 6 + itemColumns.length; // Base columns + custom attributes

    var dataRange = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, totalColumns);
    var values = dataRange.getValues();
    var backgrounds = dataRange.getBackgrounds();
    var fontWeights = dataRange.getFontWeights();
    var fontStyles = dataRange.getFontStyles();
    var fontColors = dataRange.getFontColors();

    values.forEach(function(row, index) {
      var itemNumber = row[0];

      // Skip empty rows
      if (!itemNumber || itemNumber.toString().trim() === '') {
        return;
      }

      // Skip instruction rows (like "Use Item Picker to add components")
      if (itemNumber.toString().indexOf('Use Item Picker') !== -1) {
        return;
      }

      // Build row object with data and formatting
      var rowObj = {
        values: row,
        backgrounds: backgrounds[index],
        fontWeights: fontWeights[index],
        fontStyles: fontStyles[index],
        fontColors: fontColors[index]
      };

      bomData.push(rowObj);
    });

    Logger.log('readRackBOMData: Read ' + bomData.length + ' BOM rows');

  } catch (error) {
    Logger.log('ERROR in readRackBOMData: ' + error.message);
  }

  return bomData;
}

/**
 * Copies BOM row data to a target sheet with formatting
 * @param {Sheet} targetSheet - Sheet to write BOM data to
 * @param {Array} bomData - Array of BOM row objects from readRackBOMData
 */
function copyBOMRowsToSheet(targetSheet, bomData) {
  try {
    if (bomData.length === 0) {
      Logger.log('copyBOMRowsToSheet: No data to copy');
      return;
    }

    var numRows = bomData.length;
    var numCols = bomData[0].values.length;

    // Extract values, backgrounds, and formatting
    var values = [];
    var backgrounds = [];
    var fontWeights = [];
    var fontStyles = [];
    var fontColors = [];

    bomData.forEach(function(row) {
      values.push(row.values);
      backgrounds.push(row.backgrounds);
      fontWeights.push(row.fontWeights);
      fontStyles.push(row.fontStyles);
      fontColors.push(row.fontColors);
    });

    // Write all data and formatting at once for performance
    var targetRange = targetSheet.getRange(DATA_START_ROW, 1, numRows, numCols);
    targetRange.setValues(values);
    targetRange.setBackgrounds(backgrounds);
    targetRange.setFontWeights(fontWeights);
    targetRange.setFontStyles(fontStyles);
    targetRange.setFontColors(fontColors);

    Logger.log('copyBOMRowsToSheet: Copied ' + numRows + ' rows with formatting');

  } catch (error) {
    Logger.log('ERROR in copyBOMRowsToSheet: ' + error.message);
  }
}

/**
 * Creates a new rack sheet structure (metadata + headers)
 * Does NOT populate BOM data - that's handled separately
 * @param {string} itemNumber - Rack item number
 * @param {string} itemName - Rack name
 * @param {string} description - Rack description
 * @param {string} sheetName - Sheet name to create
 * @return {Sheet} The created sheet
 */
function createRackSheetStructure(itemNumber, itemName, description, sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create new sheet
  var newSheet = ss.insertSheet(sheetName);
  Logger.log('Created sheet: ' + sheetName);

  // Step 1: Set up metadata row (Row 1)
  newSheet.getRange(METADATA_ROW, META_LABEL_COL).setValue('PARENT_ITEM');
  newSheet.getRange(METADATA_ROW, META_ITEM_NUM_COL).setValue(itemNumber);
  newSheet.getRange(METADATA_ROW, META_ITEM_NAME_COL).setValue(itemName);
  newSheet.getRange(METADATA_ROW, META_ITEM_DESC_COL).setValue(description || '');
  // NOTE: E1 (History link) will be set by caller

  // Format metadata row
  var metaRange = newSheet.getRange(METADATA_ROW, 1, 1, 4);
  metaRange.setBackground('#e8f0fe');
  metaRange.setFontWeight('bold');
  metaRange.setFontColor('#1967d2');

  // Step 2: Set up header row (Row 2)
  var itemColumns = getItemColumns();
  var headers = ['Item Number', 'Name', 'Description', 'Category', 'Lifecycle', 'Qty'];

  // Add configured attribute columns
  itemColumns.forEach(function(col) {
    headers.push(col.header || col.attributeName);
  });

  var headerRange = newSheet.getRange(HEADER_ROW, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#1a73e8');
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Step 3: Freeze rows 1 and 2
  newSheet.setFrozenRows(HEADER_ROW);

  // Step 4: Set column widths
  newSheet.setColumnWidth(1, 120);  // Item Number
  newSheet.setColumnWidth(2, 200);  // Name
  newSheet.setColumnWidth(3, 300);  // Description
  newSheet.setColumnWidth(4, 150);  // Category
  newSheet.setColumnWidth(5, 120);  // Lifecycle
  newSheet.setColumnWidth(6, 60);   // Qty

  // Enable text wrapping for Description column
  newSheet.getRange('C:C').setWrap(true);

  Logger.log('Sheet structure created successfully');

  return newSheet;
}

/**
 * Applies rack tab formatting (colors, etc.)
 * @param {Sheet} sheet - Rack sheet to format
 */
function applyRackTabFormatting(sheet) {
  try {
    // Get rack index for cascading blue color
    var allRacks = getAllRackConfigTabs();
    var rackIndex = allRacks.length - 1; // Current rack is last one

    var blueColor = getCascadingBlueColor(rackIndex);
    sheet.setTabColor(blueColor);

    Logger.log('Applied tab color: ' + blueColor);

  } catch (error) {
    Logger.log('ERROR in applyRackTabFormatting: ' + error.message);
  }
}

/**
 * Inserts an instruction row at the top of BOM data for template racks
 * Yellow background with instructions to trim before pushing
 * @param {Sheet} sheet - Rack sheet
 * @param {string} templateItemNumber - Arena template item number
 * @param {number} componentCount - Number of components loaded
 */
function insertTemplateInstructionRow(sheet, templateItemNumber, componentCount) {
  try {
    // Insert new row at DATA_START_ROW (push BOM data down)
    sheet.insertRowBefore(DATA_START_ROW);

    // Get number of columns to span
    var itemColumns = getItemColumns();
    var totalColumns = 6 + itemColumns.length;

    // Set instruction text
    var message = '⚠ Template loaded from ' + templateItemNumber + ' (' + componentCount + ' components) - Trim to desired components before pushing to Arena';

    var instructionRange = sheet.getRange(DATA_START_ROW, 1, 1, totalColumns);
    instructionRange.setValue(message);
    instructionRange.setBackground('#fff3cd'); // Light yellow
    instructionRange.setFontStyle('italic');
    instructionRange.setFontColor('#856404'); // Dark yellow/brown
    instructionRange.setFontWeight('bold');
    instructionRange.setHorizontalAlignment('left');
    instructionRange.setWrap(true);

    // Merge cells for better display
    instructionRange.merge();

    Logger.log('Inserted template instruction row');

  } catch (error) {
    Logger.log('ERROR in insertTemplateInstructionRow: ' + error.message);
  }
}

/**
 * Validates clone/template inputs
 * Checks for duplicates, empty values, invalid characters, etc.
 * @param {string} sourceNumber - Source rack number (null for templates)
 * @param {string} newNumber - New rack number
 * @param {string} newName - New rack name
 * @return {Object} Validation result with valid flag and errors array
 */
function validateCloneInputs(sourceNumber, newNumber, newName) {
  var errors = [];

  // Check source exists (only for clones, not templates)
  if (sourceNumber !== null && sourceNumber !== undefined) {
    var sourceSheet = findRackConfigTab(sourceNumber);
    if (!sourceSheet) {
      errors.push('Source rack "' + sourceNumber + '" not found');
    }
  }

  // Check new number is not empty
  if (!newNumber || newNumber.toString().trim() === '') {
    errors.push('New rack item number cannot be empty');
  }

  // Check new name is not empty
  if (!newName || newName.toString().trim() === '') {
    errors.push('New rack name cannot be empty');
  }

  // Check new number doesn't already exist
  if (newNumber) {
    var existingSheet = findRackConfigTab(newNumber);
    if (existingSheet) {
      errors.push('A rack with item number "' + newNumber + '" already exists');
    }
  }

  // Check sheet name length (Google Sheets limit: 100 characters)
  var entitySingular = getTerminology('entity_singular');
  var proposedSheetName = entitySingular + ' - ' + newNumber + ' (' + newName + ')';
  if (proposedSheetName.length > 100) {
    errors.push('Sheet name would be too long (' + proposedSheetName.length + ' chars, max 100). Use a shorter rack name.');
  }

  // Check for invalid characters in sheet name
  var invalidChars = /[\[\]:\*\?\/\\]/;
  if (invalidChars.test(newName)) {
    errors.push('Rack name contains invalid characters (brackets, colon, asterisk, question mark, slash)');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// UI WRAPPER FUNCTIONS (called from dialogs/modals)
// ============================================================================

/**
 * Handles clone request from RackPicker UI
 * @param {Object} params - Clone parameters from UI
 * @return {Object} Result object
 */
function handleCloneRackRequest(params) {
  try {
    return cloneRackConfiguration(
      params.sourceRackNumber,
      params.newRackNumber,
      params.newRackName,
      params.newDescription || ''
    );
  } catch (error) {
    Logger.log('ERROR in handleCloneRackRequest: ' + error.message);
    return {
      success: false,
      message: 'Unexpected error: ' + error.message
    };
  }
}

/**
 * Handles template load request from RackPicker UI
 * @param {Object} params - Template parameters from UI
 * @return {Object} Result object
 */
function handleTemplateLoadRequest(params) {
  try {
    return createRackFromArenaTemplate(
      params.arenaItemNumber,
      params.newRackNumber,
      params.newRackName,
      params.newDescription || '',
      params.selectedComponents || null  // NEW: Pass selected components
    );
  } catch (error) {
    Logger.log('ERROR in handleTemplateLoadRequest: ' + error.message);
    return {
      success: false,
      message: 'Unexpected error: ' + error.message
    };
  }
}

/**
 * Gets all racks for clone mode (same as getAllRackConfigTabs but returns simple format)
 * @return {Array} Array of rack objects for UI
 */
function getRacksForCloning() {
  try {
    var racks = getAllRackConfigTabs();

    return racks.map(function(rack) {
      return {
        itemNumber: rack.itemNumber,
        itemName: rack.itemName,
        description: rack.description,
        childItemCount: rack.childItemCount,
        sheetName: rack.sheetName
      };
    });

  } catch (error) {
    Logger.log('ERROR in getRacksForCloning: ' + error.message);
    return [];
  }
}

// ============================================================================
// MULTI-LEVEL BOM FUNCTIONS
// ============================================================================

/**
 * Fetches multi-level BOM from Arena for an item
 * Returns hierarchical structure with item details (number, description, revision)
 * @param {string} itemNumber - Arena item number
 * @return {Object} Result with hierarchical BOM tree
 */
function getMultiLevelBOM(itemNumber) {
  try {
    Logger.log('=== GET MULTI-LEVEL BOM START ===');
    Logger.log('Item: ' + itemNumber);

    var arenaClient = getArenaClient();

    // Step 1: Get the root item (cache hit on warm cache)
    var rootItem = arenaClient.getItemByNumber(itemNumber);
    if (!rootItem) {
      return { success: false, message: 'Item "' + itemNumber + '" not found in Arena.' };
    }

    var rootGuid = rootItem.guid || rootItem.Guid;
    if (!rootGuid) {
      return { success: false, message: 'Item has no GUID.' };
    }

    var rootName = rootItem.name || rootItem.Name || '';
    Logger.log('Root item GUID: ' + rootGuid);

    // Step 2: Parallel BFS with deduplication (primary fast path)
    // Uses UrlFetchApp.fetchAll() to fetch each BOM level in one parallel batch.
    // Deduplication ensures shared rack/component GUIDs are only fetched once,
    // collapsing the ~147 sequential calls into ~4 parallel rounds (~4-8s).
    try {
      Logger.log('Attempting parallel BFS approach...');
      var bomTree = fetchBOMParallel(arenaClient, rootGuid);
      Logger.log('Parallel BFS success: ' + _countBOMNodes(bomTree) + ' nodes');
      return { success: true, itemNumber: itemNumber, itemName: rootName, bomTree: bomTree };
    } catch (parallelErr) {
      Logger.log('Parallel BFS failed, falling back to recursive: ' + parallelErr.message);
    }

    // Step 3: Last-resort fallback — sequential recursive /items/{guid}/bom calls
    Logger.log('Using sequential recursive BOM approach for ' + itemNumber);
    var bomTree = fetchBOMRecursive(arenaClient, rootGuid, rootItem, 0);
    return { success: true, itemNumber: itemNumber, itemName: rootName, bomTree: bomTree };

  } catch (error) {
    Logger.log('ERROR in getMultiLevelBOM: ' + error.message);
    return { success: false, message: 'Error fetching multi-level BOM: ' + error.message };
  }
}

/**
 * Counts all nodes in a BOM tree (all levels combined).
 * @param {Array} nodes
 * @return {number}
 */
function _countBOMNodes(nodes) {
  if (!nodes) return 0;
  var count = nodes.length;
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].children && nodes[i].children.length > 0) {
      count += _countBOMNodes(nodes[i].children);
    }
  }
  return count;
}

/**
 * Dispatches Arena export JSON to the correct tree-builder based on the
 * structure returned. Arena can return several shapes depending on version/config:
 *
 *   Format A — Array of items each with a "bom" sub-array (most common for FULL BOM):
 *     [ { guid, number, name, ..., bom: [{quantity, item:{...}}] }, ... ]
 *
 *   Format B — Same but wrapped in an object:
 *     { items: [ { guid, ..., bom: [...] } ] }
 *
 *   Format C — Flat list of parent→child relationships:
 *     [ { parent: {guid,...}, item: {guid,...}, quantity: N }, ... ]
 *     OR { bom: [ { parent, item, quantity } ] }
 *
 * Logs the raw structure on first call so you can verify format in execution logs.
 *
 * @param {*}      exportData  Parsed JSON from the export ZIP
 * @param {string} rootGuid    GUID of the root item
 * @return {Array} Hierarchical BOM tree matching BOMTreeModal.html expected format
 */
function _buildBOMTreeFromExport(exportData, rootGuid) {
  // Log structure for diagnosis (first call)
  if (Array.isArray(exportData)) {
    Logger.log('Export: array[' + exportData.length + '], first keys: ' +
      (exportData.length ? Object.keys(exportData[0]).join(', ') : 'empty'));
  } else {
    Logger.log('Export: object, keys: ' + Object.keys(exportData).join(', '));
  }

  // Format A: top-level array, items have a "bom" key
  if (Array.isArray(exportData) && exportData.length > 0 && exportData[0].bom !== undefined) {
    Logger.log('Export format: A (items array with nested bom)');
    return _buildTreeFromItemsArray(exportData, rootGuid);
  }

  // Format B: { items: [...] } wrapper
  if (exportData.items && Array.isArray(exportData.items)) {
    Logger.log('Export format: B (object.items with nested bom)');
    return _buildTreeFromItemsArray(exportData.items, rootGuid);
  }

  // Format C: flat parent→child list
  var flatLines = null;
  if (Array.isArray(exportData) && exportData.length > 0 && exportData[0].parent !== undefined) {
    flatLines = exportData;
  } else if (exportData.bom && Array.isArray(exportData.bom)) {
    flatLines = exportData.bom;
  }
  if (flatLines) {
    Logger.log('Export format: C (flat parent-child list, ' + flatLines.length + ' lines)');
    return _buildTreeFromFlatList(flatLines, rootGuid);
  }

  Logger.log('ERROR: Unrecognized export format: ' + JSON.stringify(exportData).substring(0, 400));
  throw new Error('Unrecognized Arena export JSON format — check execution logs');
}

// ── Format A/B helpers ──────────────────────────────────────────────────────

function _buildTreeFromItemsArray(items, rootGuid) {
  // Build GUID → item map
  var itemMap = {};
  for (var i = 0; i < items.length; i++) {
    var g = items[i].guid || items[i].Guid || '';
    if (g) itemMap[g] = items[i];
  }

  var rootItem = itemMap[rootGuid];
  if (!rootItem) {
    Logger.log('Root GUID not in export items list, using index 0');
    rootItem = items[0];
    rootGuid = rootItem.guid || rootItem.Guid || '';
  }

  return _nodesFromItemsArray(rootItem, itemMap, 0);
}

function _nodesFromItemsArray(parentItem, itemMap, level) {
  var bomLines = parentItem.bom || parentItem.Bom || [];
  var nodes = [];

  for (var i = 0; i < bomLines.length; i++) {
    var line = bomLines[i];
    var childRef = line.item || line.Item || {};
    var childGuid = childRef.guid || childRef.Guid || '';
    var node = {
      id: childGuid + '_' + level + '_' + i,
      itemNumber: childRef.number  || childRef.Number  || '',
      itemName:   childRef.name    || childRef.Name    || '',
      description:childRef.description || childRef.Description || '',
      revision:   line.revisionNumber  || line.RevisionNumber  ||
                  childRef.revisionNumber || childRef.RevisionNumber || '',
      quantity:   line.quantity || line.Quantity || 1,
      level:      level + 1,
      guid:       childGuid,
      children:   [],
      hasChildren: false
    };

    var childData = itemMap[childGuid];
    if (childData) {
      var children = _nodesFromItemsArray(childData, itemMap, level + 1);
      if (children.length) { node.children = children; node.hasChildren = true; }
    }

    nodes.push(node);
  }
  return nodes;
}

// ── Format C helpers ────────────────────────────────────────────────────────

function _buildTreeFromFlatList(flatLines, rootGuid) {
  // Map: parentGuid → [line objects]
  var childMap = {};
  for (var i = 0; i < flatLines.length; i++) {
    var parentObj = flatLines[i].parent || flatLines[i].Parent || {};
    var pGuid = parentObj.guid || parentObj.Guid || '';
    if (!pGuid) continue;
    if (!childMap[pGuid]) childMap[pGuid] = [];
    childMap[pGuid].push(flatLines[i]);
  }
  Logger.log('Flat list: ' + Object.keys(childMap).length + ' unique parents');
  return _nodesFromFlatList(rootGuid, childMap, 0);
}

function _nodesFromFlatList(parentGuid, childMap, level) {
  var lines = childMap[parentGuid] || [];
  var nodes = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var childObj = line.item || line.Item || {};
    var childGuid = childObj.guid || childObj.Guid || '';
    var node = {
      id: childGuid + '_' + level + '_' + i,
      itemNumber: childObj.number  || childObj.Number  || '',
      itemName:   childObj.name    || childObj.Name    || '',
      description:childObj.description || childObj.Description || '',
      revision:   line.revisionNumber  || line.RevisionNumber  ||
                  childObj.revisionNumber || childObj.RevisionNumber || '',
      quantity:   line.quantity || line.Quantity || 1,
      level:      level + 1,
      guid:       childGuid,
      children:   [],
      hasChildren: false
    };

    if (childGuid && childMap[childGuid]) {
      var children = _nodesFromFlatList(childGuid, childMap, level + 1);
      if (children.length) { node.children = children; node.hasChildren = true; }
    }

    nodes.push(node);
  }
  return nodes;
}

/**
 * Recursively fetches BOM for an item and its children
 * @param {ArenaAPIClient} arenaClient - Arena API client
 * @param {string} itemGuid - Item GUID
 * @param {Object} itemData - Item data object
 * @param {number} level - Current hierarchy level (0 = root)
 * @return {Array} Array of BOM nodes with children
 */
function fetchBOMRecursive(arenaClient, itemGuid, itemData, level) {
  var bomTree = [];

  try {
    // Fetch BOM for this item
    Logger.log('Fetching BOM for level ' + level + ': ' + itemGuid);
    var bomResponse = arenaClient.makeRequest('/items/' + itemGuid + '/bom', { method: 'GET' });
    var bomLines = bomResponse.results || bomResponse.Results || [];

    Logger.log('Found ' + bomLines.length + ' BOM lines at level ' + level);

    // Process each BOM line
    bomLines.forEach(function(line, index) {
      var childItem = line.item || line.Item;
      if (!childItem) {
        Logger.log('Warning: BOM line has no item data');
        return;
      }

      var childNumber = childItem.number || childItem.Number || '';
      var childName = childItem.name || childItem.Name || '';
      var childGuid = childItem.guid || childItem.Guid || '';
      var quantity = line.quantity || line.Quantity || 1;

      // Extract item details from BOM line data ONLY
      // NO additional API calls - use what Arena already gave us in the BOM response
      var description = '';
      var revision = '';

      // Get description from BOM line data
      description = childItem.description || childItem.Description || '';

      // Get revision from BOM line data
      if (line.revisionNumber || line.RevisionNumber) {
        revision = line.revisionNumber || line.RevisionNumber || '';
      } else if (childItem.revisionNumber || childItem.RevisionNumber) {
        revision = childItem.revisionNumber || childItem.RevisionNumber || '';
      } else if (childItem.effectivity && childItem.effectivity.effectiveRevisionNumber) {
        revision = childItem.effectivity.effectiveRevisionNumber;
      }

      // Note: We do NOT make additional API calls to fetch item details
      // This keeps BOM loading fast (< 5 seconds for most BOMs)
      // Arena BOM API already includes most important data

      // Build BOM node
      var bomNode = {
        id: childGuid + '_' + index,  // Unique ID for UI
        itemNumber: childNumber,
        itemName: childName,
        description: description,
        revision: revision,
        quantity: quantity,
        level: level + 1,
        guid: childGuid,
        children: [],
        hasChildren: false
      };

      // Recursively fetch children (limit depth to prevent infinite loops)
      if (childGuid && level < 10) {
        var childBOM = fetchBOMRecursive(arenaClient, childGuid, childItem, level + 1);
        if (childBOM.length > 0) {
          bomNode.children = childBOM;
          bomNode.hasChildren = true;
        }
      }

      bomTree.push(bomNode);
    });

  } catch (error) {
    Logger.log('ERROR in fetchBOMRecursive: ' + error.message);
  }

  return bomTree;
}

/**
 * Fetches a multi-level BOM using breadth-first parallel requests.
 *
 * Key improvements over fetchBOMRecursive:
 *  1. PARALLEL — all items at the same BOM level fetched in one UrlFetchApp.fetchAll() call
 *  2. DEDUPLICATED — shared rack/component GUIDs fetched only once regardless of how many
 *     parents reference them (critical: the POD has 3 rows all sharing the same rack type)
 *
 * For a 3-level tree (POD→Row→Rack→Component):
 *   Old: ~147 sequential calls × ~460ms = ~68s
 *   New: 4 parallel rounds × ~1.5s = ~6s
 *
 * @param {ArenaAPIClient} arenaClient
 * @param {string} rootGuid - GUID of the root item
 * @return {Array} Hierarchical BOM tree matching BOMTreeModal.html format
 */
function fetchBOMParallel(arenaClient, rootGuid) {
  // bomCache: guid → [{node},...] — stores BOM children for every fetched item
  // Also serves as deduplication: if guid is a key, we've already fetched (or are fetching) it
  var bomCache = {};

  // Process level by level (BFS)
  var currentBatch = [rootGuid];
  var depth = 0;
  var MAX_DEPTH = 10;

  while (currentBatch.length > 0 && depth < MAX_DEPTH) {
    // Only fetch GUIDs not yet in bomCache
    var toFetch = [];
    for (var f = 0; f < currentBatch.length; f++) {
      if (!bomCache.hasOwnProperty(currentBatch[f])) {
        toFetch.push(currentBatch[f]);
        bomCache[currentBatch[f]] = []; // Reserve slot to prevent double-fetch
      }
    }

    Logger.log('BFS depth ' + depth + ': batch=' + currentBatch.length +
               ', fetching=' + toFetch.length + ' (deduped ' + (currentBatch.length - toFetch.length) + ')');

    if (toFetch.length === 0) { break; }

    // Build and fire all requests for this level in parallel
    var requests = [];
    for (var r = 0; r < toFetch.length; r++) {
      requests.push(arenaClient.bomFetchRequest(toFetch[r]));
    }
    var responses = UrlFetchApp.fetchAll(requests);

    // Collect all child GUIDs for the next level
    var nextBatch = [];

    for (var i = 0; i < toFetch.length; i++) {
      var parentGuid = toFetch[i];
      var resp = responses[i];
      var code = resp.getResponseCode();

      if (code !== 200) {
        Logger.log('BFS: BOM fetch HTTP ' + code + ' for ' + parentGuid);
        continue; // bomCache[parentGuid] already = [], so tree builds cleanly
      }

      var data;
      try {
        data = JSON.parse(resp.getContentText());
      } catch (e) {
        Logger.log('BFS: parse error for ' + parentGuid + ': ' + e.message);
        continue;
      }

      var lines = data.results || data.Results || [];
      var nodes = [];

      for (var j = 0; j < lines.length; j++) {
        var line = lines[j];
        var child = line.item || line.Item || {};
        var childGuid = child.guid || child.Guid || '';

        nodes.push({
          id: childGuid + '_' + depth + '_' + j,
          itemNumber:  child.number      || child.Number      || '',
          itemName:    child.name        || child.Name        || '',
          description: child.description || child.Description || '',
          revision:    line.revisionNumber  || line.RevisionNumber  ||
                       child.revisionNumber || child.RevisionNumber || '',
          quantity:    line.quantity || line.Quantity || 1,
          level:       depth + 1,
          guid:        childGuid,
          children:    [],
          hasChildren: false
        });

        // Queue child for next round — skip if we've already processed it (dedup)
        // Also skip if item is explicitly marked as non-assembly (no children)
        var isAssembly = child.isAssembly !== undefined ? child.isAssembly : true;
        if (childGuid && isAssembly !== false && !bomCache.hasOwnProperty(childGuid)) {
          nextBatch.push(childGuid);
        }
      }

      bomCache[parentGuid] = nodes;
      Logger.log('BFS: ' + parentGuid + ' → ' + nodes.length + ' children');
    }

    currentBatch = nextBatch;
    depth++;
  }

  // Reconstruct the tree from the flat bomCache
  function buildTree(guid) {
    var nodes = bomCache[guid] || [];
    for (var n = 0; n < nodes.length; n++) {
      var children = buildTree(nodes[n].guid);
      nodes[n].children = children;
      nodes[n].hasChildren = children.length > 0;
    }
    return nodes;
  }

  return buildTree(rootGuid);
}

/**
 * Inserts selected components into the current rack sheet
 * Appends to existing BOM rows
 * @param {Array} components - Array of component objects to insert
 * @return {Object} Result object
 */
function insertComponentsIntoCurrentRack(components) {
  try {
    Logger.log('=== INSERT COMPONENTS INTO CURRENT RACK START ===');
    Logger.log('Components to insert: ' + components.length);

    if (!components || components.length === 0) {
      return {
        success: false,
        message: 'No components selected to insert.'
      };
    }

    // Step 1: Get active sheet and validate it's a rack sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var activeSheet = ss.getActiveSheet();
    var sheetName = activeSheet.getName();

    var entitySingular = getTerminology('entity_singular');

    // More robust validation - check if entitySingular appears anywhere in the sheet name
    // This handles cases with emoji prefixes or other decorations
    if (sheetName.indexOf(entitySingular) === -1) {
      // Also check for common rack sheet patterns as fallback
      var isRackSheet = sheetName.match(/\b(Rack|Pod|Row)\b/i);

      if (!isRackSheet) {
        return {
          success: false,
          message: 'Please select a rack configuration sheet before inserting components.\n\nActive sheet: ' + sheetName
        };
      }
    }

    Logger.log('Active sheet: ' + sheetName);

    // Step 2: Find the last row with BOM data
    var lastRow = activeSheet.getLastRow();
    var insertRow = lastRow + 1;

    // Check if there's existing BOM data or if this is empty
    var hasExistingData = false;
    if (lastRow >= DATA_START_ROW) {
      var checkRange = activeSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1);
      var checkValues = checkRange.getValues();

      for (var i = 0; i < checkValues.length; i++) {
        var cellValue = checkValues[i][0];
        if (cellValue && cellValue.toString().trim() !== '' &&
            cellValue.toString().indexOf('Use Item Picker') === -1 &&
            cellValue.toString().indexOf('Template loaded') === -1) {
          hasExistingData = true;
          break;
        }
      }
    }

    // If no existing data, start at DATA_START_ROW
    if (!hasExistingData) {
      insertRow = DATA_START_ROW;

      // Clear any instruction rows
      if (lastRow >= DATA_START_ROW) {
        activeSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 10).clearContent();
      }
    }

    Logger.log('Inserting at row: ' + insertRow);

    // Step 3: Prepare component data for insertion
    var arenaClient = getArenaClient();
    var itemColumns = getItemColumns();
    var numCols = 6 + itemColumns.length;

    // Load item cache (correct key) for base-field lookups
    var cachedItems = {};
    try {
      var cachedJson = CacheService.getScriptCache().get(ITEM_CACHE_KEY);
      if (cachedJson) {
        cachedItems = JSON.parse(cachedJson);
        Logger.log('Item cache loaded: ' + Object.keys(cachedItems).length + ' items');
      }
    } catch (e) {
      Logger.log('Could not load item cache: ' + e.message);
    }

    // If custom attribute columns are configured, batch-fetch full item details in parallel
    // (the item cache only stores base fields; additionalAttributes require a full item fetch)
    var fullItemMap = {}; // guid → full item object with additionalAttributes
    if (itemColumns.length > 0) {
      var guidsToFetch = [];
      var seenGuids = {};
      for (var gi = 0; gi < components.length; gi++) {
        var g = components[gi].guid;
        if (g && !seenGuids[g]) { seenGuids[g] = true; guidsToFetch.push(g); }
      }

      if (guidsToFetch.length > 0) {
        Logger.log('Fetching full item details for ' + guidsToFetch.length + ' items (custom attrs)...');
        var itemRequests = guidsToFetch.map(function(guid) {
          return {
            url: arenaClient.apiBase + '/items/' + encodeURIComponent(guid) + '?responseview=full',
            method: 'GET',
            headers: { 'arena_session_id': arenaClient.sessionId, 'Content-Type': 'application/json' },
            muteHttpExceptions: true
          };
        });
        try {
          var itemResponses = UrlFetchApp.fetchAll(itemRequests);
          for (var ri = 0; ri < guidsToFetch.length; ri++) {
            if (itemResponses[ri].getResponseCode() === 200) {
              fullItemMap[guidsToFetch[ri]] = JSON.parse(itemResponses[ri].getContentText());
            }
          }
          Logger.log('Full item details fetched: ' + Object.keys(fullItemMap).length);
        } catch (fetchErr) {
          Logger.log('Could not batch-fetch item details: ' + fetchErr.message);
        }
      }
    }

    var values = [];
    var backgrounds = [];
    var fontWeights = [];
    var categoryColors = getCategoryColors();

    components.forEach(function(comp) {
      var itemNumber = comp.itemNumber || '';
      var itemName   = comp.itemName   || '';
      var description = comp.description || '';
      var category   = comp.category   || '';
      var lifecycle  = comp.lifecycle  || '';
      var quantity   = comp.quantity   || 1;

      // Fill missing base fields from item cache
      var cached = cachedItems[itemNumber];
      if (cached) {
        if (!description && cached.description) description = cached.description;
        if (!itemName   && cached.name)         itemName    = cached.name;
        if (!category   && cached.category)     category    = cached.category.name || cached.category.Name || '';
        if (!lifecycle  && cached.lifecyclePhase) lifecycle = cached.lifecyclePhase.name || cached.lifecyclePhase.Name || '';
      }

      // Build row: 6 base fields + configured attribute columns
      var rowValues = [itemNumber, itemName, description, category, lifecycle, quantity];

      // Custom attribute columns — use full item when available, otherwise blank
      var fullItem = fullItemMap[comp.guid] || null;
      for (var i = 0; i < itemColumns.length; i++) {
        rowValues.push(fullItem ? (getAttributeValue(fullItem, itemColumns[i].attributeGuid) || '') : '');
      }

      values.push(rowValues);

      // Apply category color if available
      var bgColor = '#ffffff';
      if (category && categoryColors[category]) {
        bgColor = categoryColors[category];
      }

      var rowBg = [];
      for (var j = 0; j < numCols; j++) {
        rowBg.push(bgColor);
      }
      backgrounds.push(rowBg);

      // Font weight (normal)
      var rowWeight = [];
      for (var k = 0; k < numCols; k++) {
        rowWeight.push('normal');
      }
      fontWeights.push(rowWeight);
    });

    // Step 4: Write data to sheet
    var numRows = values.length;
    var targetRange = activeSheet.getRange(insertRow, 1, numRows, numCols);

    targetRange.setValues(values);
    targetRange.setBackgrounds(backgrounds);
    targetRange.setFontWeights(fontWeights);

    Logger.log('Inserted ' + numRows + ' components at row ' + insertRow);

    // Step 5: Update rack status (mark as modified if it was synced)
    updateRackStatusAfterModification(activeSheet);

    return {
      success: true,
      message: 'Successfully inserted ' + numRows + ' component(s) into ' + sheetName,
      componentsInserted: numRows,
      startRow: insertRow
    };

  } catch (error) {
    Logger.log('ERROR in insertComponentsIntoCurrentRack: ' + error.message);
    return {
      success: false,
      message: 'Error inserting components: ' + error.message
    };
  }
}

/**
 * Updates rack status after manual modification
 * If rack was SYNCED, mark as LOCAL_MODIFIED
 * @param {Sheet} sheet - Rack sheet
 */
function updateRackStatusAfterModification(sheet) {
  try {
    var metadata = getRackConfigMetadata(sheet);
    if (!metadata) return;

    var currentStatus = getRackStatus(metadata.itemNumber);

    // If rack was synced, mark as modified
    if (currentStatus === RACK_STATUS.SYNCED) {
      updateRackStatus(metadata.itemNumber, RACK_STATUS.LOCAL_MODIFIED);

      // Log history event
      addRackHistoryEvent(metadata.itemNumber, HISTORY_EVENT.BOM_MODIFIED, {
        changesSummary: 'Components inserted via BOM Tree Selector',
        statusAfter: RACK_STATUS.LOCAL_MODIFIED
      });
    }

  } catch (error) {
    Logger.log('Warning: Could not update rack status: ' + error.message);
  }
}

// ============================================================================
// BOM TREE CUSTOM ATTRIBUTES
// ============================================================================

/**
 * Fetches custom attribute values for multiple items
 * Uses caching to avoid redundant API calls
 * @param {Array<string>} itemGuids - Array of item GUIDs to fetch attributes for
 * @param {Array<string>} attributeGuids - Array of attribute GUIDs to fetch
 * @return {Object} Map of itemGuid -> {attributeGuid: value}
 */
function fetchItemAttributeValues(itemGuids, attributeGuids) {
  try {
    Logger.log('=== FETCH ITEM ATTRIBUTE VALUES START ===');
    Logger.log('Items: ' + itemGuids.length + ', Attributes: ' + attributeGuids.length);

    if (!itemGuids || itemGuids.length === 0 || !attributeGuids || attributeGuids.length === 0) {
      return {};
    }

    var cache = CacheService.getScriptCache();
    var arenaClient = getArenaClient();
    var results = {};

    itemGuids.forEach(function(itemGuid) {
      if (!itemGuid) return;

      results[itemGuid] = {};

      // Check cache first
      var cacheKey = 'attr_' + itemGuid;
      var cachedData = cache.get(cacheKey);

      if (cachedData) {
        try {
          var cached = JSON.parse(cachedData);
          Logger.log('Cache hit for item: ' + itemGuid);

          // Use cached values for requested attributes
          attributeGuids.forEach(function(attrGuid) {
            results[itemGuid][attrGuid] = cached[attrGuid] || '-';
          });

          return;  // Skip API call, we have cached data
        } catch (parseError) {
          Logger.log('Cache parse error: ' + parseError.message);
        }
      }

      // Cache miss - fetch from Arena
      try {
        Logger.log('Fetching attributes from Arena for: ' + itemGuid);
        var itemDetails = arenaClient.makeRequest('/items/' + itemGuid, { method: 'GET' });

        // Extract attribute values
        var attributes = itemDetails.attributes || itemDetails.Attributes || {};
        var attributeData = {};

        attributeGuids.forEach(function(attrGuid) {
          // Look for attribute value in attributes object
          var attrValue = '-';

          if (attributes[attrGuid]) {
            attrValue = attributes[attrGuid].value || attributes[attrGuid].Value || '-';
          }

          attributeData[attrGuid] = attrValue;
          results[itemGuid][attrGuid] = attrValue;
        });

        // Cache the result for 1 hour (3600 seconds)
        cache.put(cacheKey, JSON.stringify(attributeData), 3600);
        Logger.log('Cached attributes for: ' + itemGuid);

      } catch (fetchError) {
        Logger.log('Warning: Could not fetch attributes for ' + itemGuid + ': ' + fetchError.message);

        // Return "-" for all attributes on error
        attributeGuids.forEach(function(attrGuid) {
          results[itemGuid][attrGuid] = '-';
        });
      }
    });

    Logger.log('Attribute fetch complete');
    return results;

  } catch (error) {
    Logger.log('ERROR in fetchItemAttributeValues: ' + error.message);
    return {};
  }
}
