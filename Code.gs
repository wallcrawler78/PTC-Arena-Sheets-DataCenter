/**
 * PTC Arena PLM Integration for Google Sheets
 * Main entry point and menu system
 */

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Arena PLM')
    .addItem('Show Item Browser', 'showSidebar')
    .addSeparator()
    .addSubMenu(ui.createMenu('Configuration')
      .addItem('Configure Login', 'showLoginConfig')
      .addItem('Configure Item Columns', 'showItemColumnsConfig')
      .addItem('Configure Category Colors', 'showCategoryColorsConfig')
      .addItem('Configure BOM Hierarchy', 'showBOMHierarchyConfig'))
    .addSeparator()
    .addSubMenu(ui.createMenu('BOM Actions')
      .addItem('Build BOM Levels', 'buildBOMLevels')
      .addItem('Push BOM to Arena', 'pushBOMToArena')
      .addItem('Pull BOM from Arena', 'pullBOMFromArena'))
    .addToUi();
}

/**
 * Shows the item browser sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Arena Item Browser')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Shows login configuration dialog
 */
function showLoginConfig() {
  const html = HtmlService.createHtmlOutputFromFile('LoginConfig')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configure Arena Login');
}

/**
 * Shows item columns configuration dialog
 */
function showItemColumnsConfig() {
  const html = HtmlService.createHtmlOutputFromFile('ItemColumnsConfig')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configure Item Columns');
}

/**
 * Shows category colors configuration dialog
 */
function showCategoryColorsConfig() {
  const html = HtmlService.createHtmlOutputFromFile('CategoryColorsConfig')
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configure Category Colors');
}

/**
 * Shows BOM hierarchy configuration dialog
 */
function showBOMHierarchyConfig() {
  const html = HtmlService.createHtmlOutputFromFile('BOMHierarchyConfig')
    .setWidth(500)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configure BOM Hierarchy');
}

/**
 * Builds BOM levels based on category hierarchy
 */
function buildBOMLevels() {
  try {
    const result = BOMManager.calculateBOMLevels();
    SpreadsheetApp.getUi().alert('Success', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error', 'Failed to build BOM levels: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Pushes BOM to Arena PLM
 */
function pushBOMToArena() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirm Push', 'This will push the BOM to Arena and update the working revision. Continue?', ui.ButtonSet.YES_NO);

  if (response === ui.Button.YES) {
    try {
      const result = BOMManager.pushBOM();
      ui.alert('Success', result.message, ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('Error', 'Failed to push BOM: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Pulls BOM from Arena PLM
 */
function pullBOMFromArena() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirm Pull', 'This will pull the BOM from Arena and populate the sheet. Any unsaved changes will be lost. Continue?', ui.ButtonSet.YES_NO);

  if (response === ui.Button.YES) {
    try {
      const result = BOMManager.pullBOM();
      ui.alert('Success', result.message, ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('Error', 'Failed to pull BOM: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Inserts an item at the specified cell and populates attributes
 */
function insertItemAtCell(itemNumber, row, col) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const item = ArenaAPI.getItemDetails(itemNumber);

    // Insert item number
    sheet.getRange(row, col).setValue(itemNumber);

    // Apply category color if configured
    const categoryColors = ConfigManager.getCategoryColors();
    if (item.category && categoryColors[item.category]) {
      sheet.getRange(row, col).setBackground(categoryColors[item.category]);
    }

    // Populate configured attributes in adjacent columns
    const columns = ConfigManager.getItemColumns();
    columns.forEach((attr, index) => {
      if (item[attr.apiField]) {
        sheet.getRange(row, col + index + 1).setValue(item[attr.apiField]);
      }
    });

    return { success: true, message: 'Item inserted successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Gets available item categories from Arena
 */
function getCategories() {
  try {
    return ArenaAPI.getCategories();
  } catch (error) {
    Logger.log('Error fetching categories: ' + error.message);
    return [];
  }
}

/**
 * Gets items by category with optional lifecycle filter
 */
function getItemsByCategory(category, lifecycle = 'Production') {
  try {
    return ArenaAPI.getItemsByCategory(category, lifecycle);
  } catch (error) {
    Logger.log('Error fetching items: ' + error.message);
    return [];
  }
}

/**
 * Searches items by query string
 */
function searchItems(query, lifecycle = 'Production') {
  try {
    return ArenaAPI.searchItems(query, lifecycle);
  } catch (error) {
    Logger.log('Error searching items: ' + error.message);
    return [];
  }
}

/**
 * Inserts an item at the active cell
 */
function insertItemAtActiveCell(itemNumber) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const activeCell = sheet.getActiveCell();
    const row = activeCell.getRow();
    const col = activeCell.getColumn();

    return insertItemAtCell(itemNumber, row, col);
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Wrapper functions for ConfigManager (called from HTML dialogs)
 */
function saveLogin(username, password, apiUrl) {
  return ConfigManager.saveLogin(username, password, apiUrl);
}

function getLogin() {
  return ConfigManager.getLogin();
}

function saveItemColumns(columns) {
  return ConfigManager.saveItemColumns(columns);
}

function getItemColumns() {
  return ConfigManager.getItemColumns();
}

function saveCategoryColors(colors) {
  return ConfigManager.saveCategoryColors(colors);
}

function getCategoryColors() {
  return ConfigManager.getCategoryColors();
}

function saveBOMHierarchy(hierarchy) {
  return ConfigManager.saveBOMHierarchy(hierarchy);
}

function getBOMHierarchy() {
  return ConfigManager.getBOMHierarchy();
}

function getAvailableAttributes() {
  return ConfigManager.getAvailableAttributes();
}
