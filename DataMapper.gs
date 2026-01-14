/**
 * Data Mapper
 * Transforms Arena API data to Google Sheets format
 */

/**
 * Maps an Arena item to rack part format
 * @param {Object} arenaItem - The raw Arena API item object
 * @return {Object} Mapped item with quantity, itemNumber, itemName, itemCategory
 */
function mapArenaItemToRackPart(arenaItem) {
  if (!arenaItem) {
    return null;
  }

  var mappedItem = {
    quantity: extractQuantity(arenaItem),
    itemNumber: extractItemNumber(arenaItem),
    itemName: extractItemName(arenaItem),
    itemCategory: categorizePartByType(arenaItem)
  };

  return mappedItem;
}

/**
 * Extracts the item number from an Arena item
 * @param {Object} arenaItem - Arena API item
 * @return {string} The item number
 */
function extractItemNumber(arenaItem) {
  // Try various possible field names for item number
  if (arenaItem.number) return arenaItem.number;
  if (arenaItem.itemNumber) return arenaItem.itemNumber;
  if (arenaItem.partNumber) return arenaItem.partNumber;
  if (arenaItem.guid) return arenaItem.guid;
  if (arenaItem.id) return arenaItem.id;

  return 'UNKNOWN';
}

/**
 * Extracts the item name/description from an Arena item
 * @param {Object} arenaItem - Arena API item
 * @return {string} The item name/description
 */
function extractItemName(arenaItem) {
  // Try various possible field names for item name
  if (arenaItem.name) return arenaItem.name;
  if (arenaItem.description) return arenaItem.description;
  if (arenaItem.title) return arenaItem.title;

  return 'Unknown Item';
}

/**
 * Extracts quantity from an Arena item
 * @param {Object} arenaItem - Arena API item
 * @return {number} The quantity (default 1)
 */
function extractQuantity(arenaItem) {
  // Try various possible field names for quantity
  if (arenaItem.quantity) return parseInt(arenaItem.quantity, 10) || 1;
  if (arenaItem.qty) return parseInt(arenaItem.qty, 10) || 1;
  if (arenaItem.count) return parseInt(arenaItem.count, 10) || 1;

  return 1; // Default quantity
}

/**
 * Categorizes a part by type based on Arena data
 * @param {Object} arenaItem - Arena API item
 * @return {string} The determined category
 */
function categorizePartByType(arenaItem) {
  var itemName = extractItemName(arenaItem);
  var itemCategory = arenaItem.category || '';

  return getCategoryFromItem(itemName, itemCategory);
}

/**
 * Extracts all relevant attributes from an Arena item
 * @param {Object} arenaItem - Arena API item
 * @return {Object} Object with all extracted attributes
 */
function extractPartAttributes(arenaItem) {
  return {
    number: extractItemNumber(arenaItem),
    name: extractItemName(arenaItem),
    quantity: extractQuantity(arenaItem),
    category: categorizePartByType(arenaItem),
    description: arenaItem.description || '',
    revision: arenaItem.revisionNumber || arenaItem.revision || '',
    lifecycle: arenaItem.lifecyclePhase || arenaItem.status || '',
    entityType: determineEntityType(arenaItem), // REFACTORED: Now uses dynamic entity type
    rackType: determineEntityType(arenaItem),   // DEPRECATED: Keep for backward compatibility
    rawData: arenaItem // Keep original data for reference
  };
}

/**
 * Converts an array of Arena items to rack parts
 * @param {Array<Object>} arenaItems - Array of Arena items
 * @return {Array<Object>} Array of mapped rack parts
 */
function mapArenaItemsToRackParts(arenaItems) {
  if (!arenaItems || !Array.isArray(arenaItems)) {
    return [];
  }

  return arenaItems.map(function(item) {
    return mapArenaItemToRackPart(item);
  }).filter(function(item) {
    return item !== null;
  });
}

/**
 * Groups Arena items by entity type
 * REFACTORED: Now uses dynamic entity types from configuration
 * @param {Array<Object>} arenaItems - Array of Arena items
 * @return {Object} Object with entity types as keys, arrays of items as values
 */
function groupItemsByEntityType(arenaItems) {
  var grouped = {};

  // Initialize groups for all entity types (from configuration)
  getAllEntityTabNames().forEach(function(entityName) {
    grouped[entityName] = [];
  });

  // Also track unassigned items
  grouped['Unassigned'] = [];

  // Group items
  arenaItems.forEach(function(arenaItem) {
    var entityType = determineEntityType(arenaItem);

    if (entityType && grouped[entityType]) {
      var mappedItem = mapArenaItemToRackPart(arenaItem);
      if (mappedItem) {
        grouped[entityType].push(mappedItem);
      }
    } else {
      // Add to unassigned
      var mappedItem = mapArenaItemToRackPart(arenaItem);
      if (mappedItem) {
        grouped['Unassigned'].push(mappedItem);
      }
    }
  });

  return grouped;
}

/**
 * @deprecated Use groupItemsByEntityType() instead
 * Kept for backward compatibility with existing code
 */
function groupItemsByRackType(arenaItems) {
  Logger.log('DEPRECATED: groupItemsByRackType() called. Use groupItemsByEntityType() instead.');
  return groupItemsByEntityType(arenaItems);
}

/**
 * Groups items by category for Legend-NET
 * @param {Array<Object>} arenaItems - Array of Arena items
 * @return {Object} Object with categories as keys
 */
function groupItemsByCategory(arenaItems) {
  var grouped = {};

  arenaItems.forEach(function(arenaItem) {
    var mappedItem = mapArenaItemToRackPart(arenaItem);
    if (!mappedItem) return;

    var category = mappedItem.itemCategory;

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(mappedItem);
  });

  return grouped;
}

/**
 * Consolidates duplicate items and sums quantities
 * @param {Array<Object>} rackParts - Array of mapped rack parts
 * @return {Array<Object>} Consolidated array with summed quantities
 */
function consolidateItems(rackParts) {
  var consolidated = {};

  rackParts.forEach(function(part) {
    var key = part.itemNumber;

    if (consolidated[key]) {
      // Item already exists, add quantity
      consolidated[key].quantity += part.quantity;
    } else {
      // New item
      consolidated[key] = {
        quantity: part.quantity,
        itemNumber: part.itemNumber,
        itemName: part.itemName,
        itemCategory: part.itemCategory
      };
    }
  });

  // Convert back to array
  var result = [];
  for (var key in consolidated) {
    result.push(consolidated[key]);
  }

  return result;
}

/**
 * Sorts rack parts by category then by item number
 * @param {Array<Object>} rackParts - Array of rack parts
 * @return {Array<Object>} Sorted array
 */
function sortRackParts(rackParts) {
  return rackParts.sort(function(a, b) {
    // First sort by category
    if (a.itemCategory < b.itemCategory) return -1;
    if (a.itemCategory > b.itemCategory) return 1;

    // Then by item number
    if (a.itemNumber < b.itemNumber) return -1;
    if (a.itemNumber > b.itemNumber) return 1;

    return 0;
  });
}

/**
 * Converts rack parts to 2D array for sheet population
 * @param {Array<Object>} rackParts - Array of rack parts
 * @return {Array<Array>} 2D array ready for sheet.setValues()
 */
function convertToSheetData(rackParts) {
  return rackParts.map(function(part) {
    return [
      part.quantity,
      part.itemNumber,
      part.itemName,
      part.itemCategory
    ];
  });
}

/**
 * Processes Arena items for a specific rack
 * Consolidates, sorts, and prepares for sheet insertion
 * @param {Array<Object>} arenaItems - Raw Arena items for this rack
 * @return {Array<Array>} 2D array ready for insertion
 */
function processRackItems(arenaItems) {
  // Map to rack parts
  var rackParts = mapArenaItemsToRackParts(arenaItems);

  // Consolidate duplicates
  var consolidated = consolidateItems(rackParts);

  // Sort
  var sorted = sortRackParts(consolidated);

  // Convert to 2D array
  return convertToSheetData(sorted);
}

/**
 * Validates Arena item structure
 * @param {Object} arenaItem - Arena item to validate
 * @return {Object} Validation result
 */
function validateArenaItem(arenaItem) {
  var errors = [];

  if (!arenaItem) {
    return { isValid: false, errors: ['Item is null or undefined'] };
  }

  // Check for at least one identifier field
  if (!arenaItem.number && !arenaItem.itemNumber && !arenaItem.id && !arenaItem.guid) {
    errors.push('Missing item identifier (number, itemNumber, id, or guid)');
  }

  // Check for at least one name field
  if (!arenaItem.name && !arenaItem.description && !arenaItem.title) {
    errors.push('Missing item name (name, description, or title)');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Filters Arena items by category
 * @param {Array<Object>} arenaItems - Array of Arena items
 * @param {string} category - Category to filter by
 * @return {Array<Object>} Filtered items
 */
function filterItemsByCategory(arenaItems, category) {
  return arenaItems.filter(function(item) {
    var mappedItem = mapArenaItemToRackPart(item);
    return mappedItem && mappedItem.itemCategory === category;
  });
}

/**
 * Gets summary statistics for a set of items
 * @param {Array<Object>} rackParts - Array of rack parts
 * @return {Object} Summary statistics
 */
function getItemsSummary(rackParts) {
  var totalQuantity = 0;
  var categories = {};

  rackParts.forEach(function(part) {
    totalQuantity += part.quantity;

    if (!categories[part.itemCategory]) {
      categories[part.itemCategory] = {
        count: 0,
        quantity: 0
      };
    }

    categories[part.itemCategory].count++;
    categories[part.itemCategory].quantity += part.quantity;
  });

  return {
    totalItems: rackParts.length,
    totalQuantity: totalQuantity,
    categoriesBreakdown: categories
  };
}
