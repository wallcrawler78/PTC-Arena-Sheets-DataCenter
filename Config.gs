/**
 * Configuration Constants for PTC Arena Sheets Data Center
 * Centralized configuration for sheet structure, colors, and mappings
 */

// Sheet/Tab Names
var SHEET_NAMES = {
  LEGEND_NET: 'Legend-NET',
  OVERHEAD: 'Overhead',
  FULL_RACK_A: 'Full Rack Item A',
  FULL_RACK_B: 'Full Rack Item B',
  FULL_RACK_C: 'Full Rack Item C',
  FULL_RACK_D: 'Full Rack Item D',
  FULL_RACK_E: 'Full Rack Item E',
  FULL_RACK_F: 'Full Rack F',
  FULL_RACK_G: 'Full Rack Item G'
};

// Rack Tab Column Headers
var RACK_COLUMNS = {
  QTY: 'Qty',
  ITEM_NUMBER: 'Item Number',
  ITEM_NAME: 'Item Name',
  ITEM_CATEGORY: 'Item Category'
};

// Column indices (0-based) for rack tabs
var RACK_COLUMN_INDICES = {
  QTY: 0,        // Column A
  ITEM_NUMBER: 1, // Column B
  ITEM_NAME: 2,   // Column C
  ITEM_CATEGORY: 3 // Column D
};

// Color schemes for different rack types (RGB format for Google Sheets)
var RACK_COLORS = {
  FULL_RACK_A: '#00FFFF',    // Cyan
  FULL_RACK_B: '#FFA500',    // Orange
  FULL_RACK_C: '#00FF00',    // Green
  FULL_RACK_D: '#90EE90',    // Light Green
  FULL_RACK_E: '#90EE90',    // Light Green
  FULL_RACK_F: '#0000FF',    // Blue
  FULL_RACK_G: '#000000',    // Black
  ETH: '#FFFF00',            // Yellow
  SPINE: '#FF00FF',          // Purple/Magenta
  GRID_POD: '#00FF00'        // Green
};

// Category definitions for Legend-NET
var LEGEND_CATEGORIES = {
  ETH: {
    name: 'Data center ETH',
    color: RACK_COLORS.ETH,
    prefix: 'ETH'
  },
  SPINE: {
    name: 'Data Center SPINE RACK',
    color: RACK_COLORS.SPINE,
    prefix: 'SPINE'
  },
  GRID_POD: {
    name: 'DATA CENTER GRID-POD',
    color: RACK_COLORS.GRID_POD,
    prefix: 'GRID'
  }
};

// Arena API field mappings
// Maps Arena API response fields to our sheet columns
var ARENA_FIELD_MAPPING = {
  // Arena field name → Sheet column purpose
  NUMBER: 'itemNumber',        // Arena part number
  NAME: 'itemName',            // Arena item name/description
  CATEGORY: 'category',        // Arena category field
  QUANTITY: 'quantity',        // Default quantity (may be overridden)
  DESCRIPTION: 'description',  // Detailed description
  REVISION: 'revisionNumber',  // Revision info
  LIFECYCLE: 'lifecyclePhase'  // Lifecycle status
};

// Rack type classification
// Used to determine which rack tab an item belongs to
var RACK_TYPE_KEYWORDS = {
  FULL_RACK_A: ['rack a', 'type a', 'config a'],
  FULL_RACK_B: ['rack b', 'type b', 'config b'],
  FULL_RACK_C: ['rack c', 'type c', 'config c'],
  FULL_RACK_D: ['rack d', 'type d', 'config d'],
  FULL_RACK_E: ['rack e', 'type e', 'config e'],
  FULL_RACK_F: ['rack f', 'type f', 'config f'],
  FULL_RACK_G: ['rack g', 'type g', 'config g']
};

// Category classification keywords
var CATEGORY_KEYWORDS = {
  ETH: ['ethernet', 'eth', 'network switch', 'nic'],
  SPINE: ['spine', 'backbone', 'core switch'],
  GRID_POD: ['grid', 'pod', 'power distribution'],
  CATEGORY_A: ['server', 'compute', 'cpu'],
  CATEGORY_B: ['storage', 'disk', 'ssd'],
  CATEGORY_C: ['networking', 'switch', 'router'],
  CATEGORY_D: ['power', 'pdu', 'ups'],
  CATEGORY_F: ['cable', 'fiber', 'copper'],
  CATEGORY_L: ['licensing', 'software']
};

// Header row styling
var HEADER_STYLE = {
  BACKGROUND_COLOR: '#4A86E8',  // Blue
  FONT_COLOR: '#FFFFFF',         // White
  FONT_WEIGHT: 'bold',
  FONT_SIZE: 11,
  HORIZONTAL_ALIGNMENT: 'center',
  VERTICAL_ALIGNMENT: 'middle'
};

// Legend-NET header styling
var LEGEND_HEADER_STYLE = {
  BACKGROUND_COLOR: '#0000FF',  // Blue
  FONT_COLOR: '#FFFFFF',         // White
  FONT_WEIGHT: 'bold',
  FONT_SIZE: 12,
  HORIZONTAL_ALIGNMENT: 'center'
};

// Totals row styling
var TOTALS_STYLE = {
  BACKGROUND_COLOR: '#0000FF',  // Blue
  FONT_COLOR: '#FFFFFF',         // White
  FONT_WEIGHT: 'bold',
  HORIZONTAL_ALIGNMENT: 'center'
};

// Overhead grid configuration
var OVERHEAD_CONFIG = {
  START_ROW: 2,              // Row where grid starts
  START_COL: 2,              // Column where grid starts (B)
  ROWS_PER_AISLE: 2,         // Number of rows per aisle
  POSITIONS_PER_ROW: 10,     // Number of rack positions per row
  CELL_HEIGHT: 25,           // Height of each cell
  CELL_WIDTH: 120            // Width of each cell
};

/**
 * Gets the color for a given rack type
 * @param {string} rackType - The rack type name
 * @return {string} Color hex code
 */
function getRackColor(rackType) {
  var normalizedType = rackType.toUpperCase().replace(/\s+/g, '_');
  return RACK_COLORS[normalizedType] || '#CCCCCC'; // Default to gray
}

/**
 * Gets the category for an item based on keywords
 * @param {string} itemName - The item name or description
 * @param {string} itemCategory - The Arena category field
 * @return {string} Matched category
 */
function getCategoryFromItem(itemName, itemCategory) {
  var searchText = (itemName + ' ' + itemCategory).toLowerCase();

  // Check each category's keywords
  for (var category in CATEGORY_KEYWORDS) {
    var keywords = CATEGORY_KEYWORDS[category];
    for (var i = 0; i < keywords.length; i++) {
      if (searchText.indexOf(keywords[i].toLowerCase()) !== -1) {
        return category.replace('_', ' '); // Return formatted category name
      }
    }
  }

  return 'Uncategorized';
}

/**
 * Determines which rack tab an item belongs to
 * @param {Object} arenaItem - The Arena API item object
 * @return {string} The rack tab name, or null if no match
 */
function determineRackType(arenaItem) {
  var searchText = '';

  // Build search text from various fields
  if (arenaItem.name) searchText += arenaItem.name.toLowerCase() + ' ';
  if (arenaItem.category) searchText += arenaItem.category.toLowerCase() + ' ';
  if (arenaItem.description) searchText += arenaItem.description.toLowerCase() + ' ';

  // Check against rack type keywords
  for (var rackType in RACK_TYPE_KEYWORDS) {
    var keywords = RACK_TYPE_KEYWORDS[rackType];
    for (var i = 0; i < keywords.length; i++) {
      if (searchText.indexOf(keywords[i]) !== -1) {
        return SHEET_NAMES[rackType];
      }
    }
  }

  return null; // No rack type match found
}

/**
 * Gets all rack tab names as an array
 * @return {Array<string>} Array of rack tab names
 */
function getAllRackTabNames() {
  return [
    SHEET_NAMES.FULL_RACK_A,
    SHEET_NAMES.FULL_RACK_B,
    SHEET_NAMES.FULL_RACK_C,
    SHEET_NAMES.FULL_RACK_D,
    SHEET_NAMES.FULL_RACK_E,
    SHEET_NAMES.FULL_RACK_F,
    SHEET_NAMES.FULL_RACK_G
  ];
}
