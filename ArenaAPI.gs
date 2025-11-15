/**
 * Arena PLM API Integration
 * Handles all communication with PTC Arena
 */

const ArenaAPI = {

  /**
   * Gets base URL and credentials for API calls
   */
  getCredentials: function() {
    const config = ConfigManager.getLogin();
    if (!config.username || !config.password) {
      throw new Error('Arena credentials not configured. Please configure login first.');
    }
    return config;
  },

  /**
   * Makes authenticated API request to Arena
   */
  makeRequest: function(endpoint, method = 'GET', payload = null) {
    const creds = this.getCredentials();
    const url = creds.apiUrl + endpoint;

    const options = {
      method: method,
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(creds.username + ':' + creds.password),
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    if (payload) {
      options.payload = JSON.stringify(payload);
    }

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error('Arena API error: ' + statusCode + ' - ' + response.getContentText());
    }

    return JSON.parse(response.getContentText());
  },

  /**
   * Gets all item categories
   */
  getCategories: function() {
    try {
      const response = this.makeRequest('/categories');
      return response.results || [];
    } catch (error) {
      Logger.log('Error fetching categories: ' + error.message);
      // Return default categories if API fails
      return [
        { guid: '1', name: 'Hall' },
        { guid: '2', name: 'Pod' },
        { guid: '3', name: 'Rack' },
        { guid: '4', name: 'Server' },
        { guid: '5', name: 'Component' }
      ];
    }
  },

  /**
   * Gets items by category with lifecycle filter
   */
  getItemsByCategory: function(categoryName, lifecycle = 'Production') {
    try {
      let endpoint = '/items?category=' + encodeURIComponent(categoryName);

      if (lifecycle && lifecycle !== 'All') {
        endpoint += '&lifecyclePhase=' + encodeURIComponent(lifecycle);
      }

      const response = this.makeRequest(endpoint);
      return this.formatItems(response.results || []);
    } catch (error) {
      Logger.log('Error fetching items by category: ' + error.message);
      return [];
    }
  },

  /**
   * Searches items by query string
   */
  searchItems: function(query, lifecycle = 'Production') {
    try {
      let endpoint = '/items?search=' + encodeURIComponent(query);

      if (lifecycle && lifecycle !== 'All') {
        endpoint += '&lifecyclePhase=' + encodeURIComponent(lifecycle);
      }

      const response = this.makeRequest(endpoint);
      return this.formatItems(response.results || []);
    } catch (error) {
      Logger.log('Error searching items: ' + error.message);
      return [];
    }
  },

  /**
   * Gets detailed information for a specific item
   */
  getItemDetails: function(itemNumber) {
    try {
      const endpoint = '/items/' + encodeURIComponent(itemNumber);
      const response = this.makeRequest(endpoint);
      return this.formatItem(response);
    } catch (error) {
      Logger.log('Error fetching item details: ' + error.message);
      throw error;
    }
  },

  /**
   * Gets BOM for a specific item
   */
  getBOM: function(itemNumber) {
    try {
      const endpoint = '/items/' + encodeURIComponent(itemNumber) + '/bom';
      const response = this.makeRequest(endpoint);
      return response.results || [];
    } catch (error) {
      Logger.log('Error fetching BOM: ' + error.message);
      throw error;
    }
  },

  /**
   * Updates BOM for a specific item
   */
  updateBOM: function(itemNumber, bomLines) {
    try {
      const endpoint = '/items/' + encodeURIComponent(itemNumber) + '/bom';
      const payload = {
        bomLines: bomLines
      };
      const response = this.makeRequest(endpoint, 'PUT', payload);
      return response;
    } catch (error) {
      Logger.log('Error updating BOM: ' + error.message);
      throw error;
    }
  },

  /**
   * Formats multiple items for display
   */
  formatItems: function(items) {
    return items.map(item => this.formatItem(item));
  },

  /**
   * Formats a single item for display
   */
  formatItem: function(item) {
    return {
      guid: item.guid || '',
      number: item.number || '',
      name: item.name || '',
      description: item.description || '',
      revisionNumber: item.revisionNumber || '',
      lifecyclePhase: item.lifecyclePhase?.name || '',
      category: item.category?.name || '',
      powerConsumption: item.additionalAttributes?.powerConsumption || '',
      weight: item.additionalAttributes?.weight || '',
      rackUnits: item.additionalAttributes?.rackUnits || '',
      manufacturer: item.additionalAttributes?.manufacturer || '',
      vendor: item.additionalAttributes?.vendor || '',
      unitCost: item.additionalAttributes?.unitCost || '',
      leadTime: item.additionalAttributes?.leadTime || ''
    };
  }
};
