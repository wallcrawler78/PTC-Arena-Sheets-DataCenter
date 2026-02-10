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
    var arenaClient = new ArenaAPIClient();
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

    var arenaClient = new ArenaAPIClient();
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
