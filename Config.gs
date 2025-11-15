/**
 * Configuration Manager
 * Handles storage and retrieval of all configuration settings
 */

const ConfigManager = {

  /**
   * Saves Arena login credentials
   */
  saveLogin: function(username, password, apiUrl) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ARENA_USERNAME', username);
    props.setProperty('ARENA_PASSWORD', password);
    props.setProperty('ARENA_API_URL', apiUrl);
    return { success: true, message: 'Login credentials saved successfully' };
  },

  /**
   * Gets Arena login credentials
   */
  getLogin: function() {
    const props = PropertiesService.getScriptProperties();
    return {
      username: props.getProperty('ARENA_USERNAME') || '',
      password: props.getProperty('ARENA_PASSWORD') || '',
      apiUrl: props.getProperty('ARENA_API_URL') || 'https://api.arenasolutions.com/v1'
    };
  },

  /**
   * Saves item column configuration
   */
  saveItemColumns: function(columns) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ITEM_COLUMNS', JSON.stringify(columns));
    return { success: true, message: 'Item columns saved successfully' };
  },

  /**
   * Gets item column configuration
   */
  getItemColumns: function() {
    const props = PropertiesService.getScriptProperties();
    const columnsJson = props.getProperty('ITEM_COLUMNS');
    if (columnsJson) {
      return JSON.parse(columnsJson);
    }
    // Default columns
    return [
      { name: 'Description', apiField: 'description' },
      { name: 'Revision', apiField: 'revisionNumber' },
      { name: 'Lifecycle', apiField: 'lifecyclePhase' }
    ];
  },

  /**
   * Saves category color configuration
   */
  saveCategoryColors: function(colors) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('CATEGORY_COLORS', JSON.stringify(colors));
    return { success: true, message: 'Category colors saved successfully' };
  },

  /**
   * Gets category color configuration
   */
  getCategoryColors: function() {
    const props = PropertiesService.getScriptProperties();
    const colorsJson = props.getProperty('CATEGORY_COLORS');
    if (colorsJson) {
      return JSON.parse(colorsJson);
    }
    // Default colors
    return {
      'Hall': '#E8F5E9',
      'Pod': '#E3F2FD',
      'Rack': '#FFF3E0',
      'Server': '#F3E5F5',
      'Component': '#FFFFFF'
    };
  },

  /**
   * Saves BOM hierarchy configuration
   */
  saveBOMHierarchy: function(hierarchy) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BOM_HIERARCHY', JSON.stringify(hierarchy));
    return { success: true, message: 'BOM hierarchy saved successfully' };
  },

  /**
   * Gets BOM hierarchy configuration
   */
  getBOMHierarchy: function() {
    const props = PropertiesService.getScriptProperties();
    const hierarchyJson = props.getProperty('BOM_HIERARCHY');
    if (hierarchyJson) {
      return JSON.parse(hierarchyJson);
    }
    // Default hierarchy (level order)
    return [
      { level: 0, category: 'Hall' },
      { level: 1, category: 'Pod' },
      { level: 2, category: 'Rack' },
      { level: 3, category: 'Server' },
      { level: 4, category: 'Component' }
    ];
  },

  /**
   * Gets all available lifecycles
   */
  getLifecycles: function() {
    return [
      'Production',
      'Prototype',
      'Engineering',
      'Pre-Production',
      'Obsolete',
      'All'
    ];
  },

  /**
   * Gets all available item attributes for column configuration
   */
  getAvailableAttributes: function() {
    return [
      { name: 'Description', apiField: 'description' },
      { name: 'Revision', apiField: 'revisionNumber' },
      { name: 'Lifecycle', apiField: 'lifecyclePhase' },
      { name: 'Category', apiField: 'category' },
      { name: 'Power Consumption', apiField: 'powerConsumption' },
      { name: 'Weight', apiField: 'weight' },
      { name: 'Rack Units', apiField: 'rackUnits' },
      { name: 'Manufacturer', apiField: 'manufacturer' },
      { name: 'Vendor', apiField: 'vendor' },
      { name: 'Cost', apiField: 'unitCost' },
      { name: 'Lead Time', apiField: 'leadTime' }
    ];
  }
};
