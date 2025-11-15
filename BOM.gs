/**
 * BOM Manager
 * Handles BOM calculations, push, and pull operations
 */

const BOMManager = {

  /**
   * Calculates BOM levels based on category hierarchy
   */
  calculateBOMLevels: function() {
    const sheet = SpreadsheetApp.getActiveSheet();
    const hierarchy = ConfigManager.getBOMHierarchy();
    const categoryColors = ConfigManager.getCategoryColors();

    // Get all data from the sheet
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error('No data found in sheet');
    }

    const range = sheet.getRange(2, 1, lastRow - 1, 10);
    const values = range.getValues();
    const backgrounds = range.getBackgrounds();

    // Create a map of category to level
    const categoryLevelMap = {};
    hierarchy.forEach(h => {
      categoryLevelMap[h.category] = h.level;
    });

    // Calculate levels based on background colors (which indicate category)
    const levels = [];
    values.forEach((row, index) => {
      const itemNumber = row[0];
      if (itemNumber) {
        const bgColor = backgrounds[index][0];
        const category = this.getCategoryFromColor(bgColor, categoryColors);
        const level = categoryLevelMap[category] || 0;
        levels.push(level);

        // Write level to a "BOM Level" column (assuming column 11)
        sheet.getRange(index + 2, 11).setValue(level);
      }
    });

    return { success: true, message: 'BOM levels calculated successfully. Levels added to column K.' };
  },

  /**
   * Gets category from cell background color
   */
  getCategoryFromColor: function(color, categoryColors) {
    for (const [category, bgColor] of Object.entries(categoryColors)) {
      if (color.toLowerCase() === bgColor.toLowerCase()) {
        return category;
      }
    }
    return 'Component'; // default
  },

  /**
   * Pushes BOM to Arena PLM
   */
  pushBOM: function() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();

    // Ask for parent item number
    const response = ui.prompt('Push BOM', 'Enter the parent item number to update:', ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK) {
      throw new Error('Push cancelled by user');
    }

    const parentItemNumber = response.getResponseText();
    if (!parentItemNumber) {
      throw new Error('Parent item number is required');
    }

    // Get BOM data from sheet
    const bomLines = this.extractBOMFromSheet(sheet);

    // Push to Arena
    ArenaAPI.updateBOM(parentItemNumber, bomLines);

    return { success: true, message: 'BOM pushed successfully to item ' + parentItemNumber };
  },

  /**
   * Pulls BOM from Arena PLM
   */
  pullBOM: function() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();

    // Ask for parent item number
    const response = ui.prompt('Pull BOM', 'Enter the parent item number to pull:', ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() !== ui.Button.OK) {
      throw new Error('Pull cancelled by user');
    }

    const parentItemNumber = response.getResponseText();
    if (!parentItemNumber) {
      throw new Error('Parent item number is required');
    }

    // Pull from Arena
    const bomLines = ArenaAPI.getBOM(parentItemNumber);

    // Clear existing data (keep header row)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
    }

    // Populate sheet with BOM data
    this.populateSheetWithBOM(sheet, bomLines);

    return { success: true, message: 'BOM pulled successfully from item ' + parentItemNumber };
  },

  /**
   * Extracts BOM structure from sheet
   */
  extractBOMFromSheet: function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const bomLines = [];
    const quantityMap = {}; // Track quantities for repeated items

    // Get item numbers and levels
    for (let i = 2; i <= lastRow; i++) {
      const itemNumber = sheet.getRange(i, 1).getValue();
      const level = sheet.getRange(i, 11).getValue() || 0;

      if (itemNumber) {
        // Track quantity
        if (!quantityMap[itemNumber]) {
          quantityMap[itemNumber] = { count: 0, level: level };
        }
        quantityMap[itemNumber].count++;
      }
    }

    // Build BOM lines with quantities
    for (const [itemNumber, data] of Object.entries(quantityMap)) {
      bomLines.push({
        itemNumber: itemNumber,
        quantity: data.count,
        level: data.level,
        refDes: '' // Can be extended later
      });
    }

    // Sort by level to maintain hierarchy
    bomLines.sort((a, b) => a.level - b.level);

    return bomLines;
  },

  /**
   * Populates sheet with BOM data from Arena
   */
  populateSheetWithBOM: function(sheet, bomLines) {
    const categoryColors = ConfigManager.getCategoryColors();

    bomLines.forEach((line, index) => {
      const row = index + 2;

      // Get item details
      try {
        const item = ArenaAPI.getItemDetails(line.itemNumber);

        // Insert item number
        sheet.getRange(row, 1).setValue(item.number);

        // Apply category color
        if (item.category && categoryColors[item.category]) {
          sheet.getRange(row, 1).setBackground(categoryColors[item.category]);
        }

        // Populate attributes
        const columns = ConfigManager.getItemColumns();
        columns.forEach((attr, colIndex) => {
          if (item[attr.apiField]) {
            sheet.getRange(row, colIndex + 2).setValue(item[attr.apiField]);
          }
        });

        // Add quantity and level
        sheet.getRange(row, 10).setValue(line.quantity);
        sheet.getRange(row, 11).setValue(line.level || 0);

      } catch (error) {
        Logger.log('Error fetching details for item ' + line.itemNumber + ': ' + error.message);
        // Still add the item number even if details fail
        sheet.getRange(row, 1).setValue(line.itemNumber);
        sheet.getRange(row, 10).setValue(line.quantity);
        sheet.getRange(row, 11).setValue(line.level || 0);
      }
    });
  }
};
