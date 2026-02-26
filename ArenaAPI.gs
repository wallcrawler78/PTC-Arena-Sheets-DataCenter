/**
 * Arena API Client
 * Handles communication with the Arena API using session-based authentication
 */

// Shared cache constants - used by ALL features (Item Picker, BOM Push, POD Create)
var ITEM_CACHE_KEY = 'arena_items_cache';
var ITEM_CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds (max recommended)

// Singleton accessor — new code should use getArenaClient() instead of new ArenaAPIClient()
var _arenaClientInstance = null;
function getArenaClient() {
  if (!_arenaClientInstance) { _arenaClientInstance = new ArenaAPIClient(); }
  return _arenaClientInstance;
}

/**
 * Normalizes an Arena API item response to consistent lowercase field names.
 * Arena API can return fields as either camelCase or PascalCase depending on
 * the endpoint and API version. This ensures consistent access patterns.
 * @param {Object} item - Raw item object from Arena API
 * @return {Object} Normalized item with consistent field names, or null if input is null/undefined
 */
function normalizeArenaItem(item) {
  if (!item) return null;
  return {
    guid:          item.guid          || item.Guid          || '',
    number:        item.number        || item.Number        || '',
    name:          item.name          || item.Name          || '',
    description:   item.description   || item.Description   || '',
    lifecyclePhase:item.lifecyclePhase|| item.LifecyclePhase|| '',
    category:      item.category      || item.Category      || null,
    revisionNumber:item.revisionNumber|| item.RevisionNumber|| '',
    // Preserve all original fields for callers that need them
    _raw:          item
  };
}

// SEC-01: Gate verbose request/response logging behind a script property
var DEBUG_MODE = PropertiesService.getScriptProperties().getProperty('DEBUG_MODE') === 'true';

/**
 * Arena API Client Class
 */
var ArenaAPIClient = function() {
  var credentials = getArenaCredentials();

  if (!credentials) {
    throw new Error('Arena API credentials not configured. Please configure the connection first.');
  }

  this.apiBase = credentials.apiBase;
  this.workspaceId = credentials.workspaceId;

  // Get a valid session ID (will login if necessary)
  this.sessionId = getValidSessionId();
  this._sessionRetryAttempted = false;
};

/**
 * Makes an authenticated request to the Arena API
 * @param {string} endpoint - The API endpoint path (will be appended to base URL)
 * @param {Object} options - Request options (method, payload, etc.)
 * @return {Object} Parsed JSON response
 */
ArenaAPIClient.prototype.makeRequest = function(endpoint, options) {
  options = options || {};

  var url = this.apiBase + endpoint;

  // Build headers with session-based authentication
  var headers = {
    'arena_session_id': this.sessionId,
    'Content-Type': 'application/json'
  };

  // Add any custom headers from options
  if (options.headers) {
    for (var key in options.headers) {
      headers[key] = options.headers[key];
    }
  }

  // Build request options
  var requestOptions = {
    method: options.method || 'GET',
    headers: headers,
    muteHttpExceptions: true
  };

  // Add payload for POST/PUT requests
  if (options.payload) {
    requestOptions.payload = JSON.stringify(options.payload);
  }

  try {
    if (DEBUG_MODE) { Logger.log('Making request to: ' + url); }
    var response = UrlFetchApp.fetch(url, requestOptions);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (DEBUG_MODE) { Logger.log('Response code: ' + responseCode); }

    // Check if session expired (401 unauthorized)
    if (responseCode === 401) {
      if (!this._sessionRetryAttempted) {
        this._sessionRetryAttempted = true;
        Logger.log('Session expired, attempting to re-login...');
        clearSession();
        this.sessionId = getValidSessionId();

        // Retry the request with new session
        headers['arena_session_id'] = this.sessionId;
        requestOptions.headers = headers;

        response = UrlFetchApp.fetch(url, requestOptions);
        responseCode = response.getResponseCode();
        responseText = response.getContentText();
      } else {
        throw new Error('Session expired and re-login failed. Please re-authenticate via the Arena menu.');
      }
    }

    if (responseCode === 429) {
      var retryAfterSec = parseInt((response.getHeaders()['Retry-After'] || response.getHeaders()['retry-after'] || '10'), 10);
      Logger.log('Rate limited by Arena API. Waiting ' + retryAfterSec + 's before retry.');
      Utilities.sleep(retryAfterSec * 1000);
      response = UrlFetchApp.fetch(url, requestOptions);
      responseCode = response.getResponseCode();
      responseText = response.getContentText();
    }

    if (responseCode >= 200 && responseCode < 300) {
      // Success - parse and return JSON
      if (responseText) {
        return JSON.parse(responseText);
      }
      return { success: true };
    } else {
      // Error response
      var errorMessage = 'HTTP ' + responseCode;
      try {
        var errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage += ': ' + errorData.message;
        } else if (errorData.error) {
          errorMessage += ': ' + errorData.error;
        } else if (errorData.errors) {
          errorMessage += ': ' + JSON.stringify(errorData.errors);
        } else {
          errorMessage += ': ' + JSON.stringify(errorData);
        }
      } catch (e) {
        if (responseText && responseText.length < 500) {
          errorMessage += ': ' + responseText;
        } else if (responseText) {
          errorMessage += ': ' + responseText.substring(0, 500) + '...';
        }
      }

      Logger.log('API Error - URL: ' + url);
      Logger.log('API Error - Code: ' + responseCode);
      Logger.log('API Error - Response: ' + responseText);

      throw new Error(errorMessage);
    }
  } catch (error) {
    Logger.log('API request error: ' + error.message);
    throw error;
  }
};

/**
 * Tests the connection to the Arena API
 * @return {Object} Result object with success status and metrics
 */
ArenaAPIClient.prototype.testConnection = function() {
  try {
    // If we got this far, the connection is working (constructor already logged in)
    // Now gather some metrics
    Logger.log('Testing connection and gathering metrics...');

    // Get all items to calculate metrics
    var items = this.getAllItems(400);

    // Count unique categories
    var categorySet = {};
    items.forEach(function(item) {
      var categoryObj = item.category || item.Category || {};
      var categoryName = categoryObj.name || categoryObj.Name || 'Uncategorized';
      categorySet[categoryName] = true;
    });

    var categoryCount = Object.keys(categorySet).length;

    Logger.log('Connection test successful - ' + items.length + ' items, ' + categoryCount + ' categories');

    return {
      success: true,
      message: 'Successfully connected to Arena API',
      workspaceId: this.workspaceId,
      totalItems: items.length,
      categoryCount: categoryCount
    };
  } catch (error) {
    Logger.log('Connection test failed: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Gets items from Arena API with workspace context
 * @param {Object} options - Query options (filters, pagination, etc.)
 * @return {Object} Items data from Arena
 */
ArenaAPIClient.prototype.getItems = function(options) {
  options = options || {};

  var endpoint = '/items';

  // Add query parameters if provided
  var queryParams = [];

  // Add responseview=full to get complete item details including file counts, etc.
  queryParams.push('responseview=full');

  if (options.category) {
    queryParams.push('category=' + encodeURIComponent(options.category));
  }
  if (options.offset) {
    queryParams.push('offset=' + options.offset);
  }
  if (options.limit) {
    queryParams.push('limit=' + options.limit);
  }

  if (queryParams.length > 0) {
    endpoint += '?' + queryParams.join('&');
  }

  return this.makeRequest(endpoint, { method: 'GET' });
};

/**
 * Gets a specific item by ID from Arena API
 * @param {string} itemId - The item identifier
 * @return {Object} Item data
 */
ArenaAPIClient.prototype.getItem = function(itemId) {
  // SEC-04: Validate item identifier before constructing API URL
  if (!itemId || typeof itemId !== 'string' || itemId.trim().length === 0) {
    throw new Error('Invalid item identifier: must be a non-empty string');
  }
  var endpoint = '/items/' + encodeURIComponent(itemId) + '?responseview=full';
  return normalizeArenaItem(this.makeRequest(endpoint, { method: 'GET' }));
};

/**
 * Creates a new item in Arena
 * @param {Object} itemData - The item data to create
 * @return {Object} Created item data
 */
ArenaAPIClient.prototype.createItem = function(itemData) {
  var endpoint = '/items';
  var newItem = this.makeRequest(endpoint, {
    method: 'POST',
    payload: itemData
  });

  // Add newly created item to cache for immediate use
  this.addItemToCache(newItem);

  return newItem;
};

/**
 * Updates an existing item in Arena
 * @param {string} itemId - The item identifier
 * @param {Object} itemData - The updated item data
 * @return {Object} Updated item data
 */
ArenaAPIClient.prototype.updateItem = function(itemId, itemData) {
  var endpoint = '/items/' + encodeURIComponent(itemId);
  var updatedItem = this.makeRequest(endpoint, {
    method: 'PUT',
    payload: itemData
  });

  // Remove updated item from cache so next lookup fetches fresh data
  var itemNumber = updatedItem.number || updatedItem.Number;
  if (itemNumber) {
    var itemCache = this._loadItemCache();
    if (itemCache && itemCache[itemNumber]) {
      delete itemCache[itemNumber];
      this._saveItemCache(itemCache);
      Logger.log('Removed ' + itemNumber + ' from shared cache after update');
    }
  }

  return updatedItem;
};

/**
 * Sets a custom attribute value on an item in Arena
 * @param {string} itemId - The item identifier (GUID)
 * @param {string} attributeGuid - The attribute GUID
 * @param {string} value - The value to set
 * @return {Object} Updated item data
 */
ArenaAPIClient.prototype.setItemAttribute = function(itemId, attributeGuid, value) {
  var endpoint = '/items/' + encodeURIComponent(itemId);

  Logger.log('Setting attribute on item: ' + itemId);
  Logger.log('Attribute GUID: ' + attributeGuid);
  Logger.log('Value: ' + value);

  // Arena API uses "additionalAttributes" not "attributes"
  var payload = {
    additionalAttributes: [
      {
        guid: attributeGuid,
        value: value
      }
    ]
  };

  Logger.log('setItemAttribute payload: ' + JSON.stringify(payload));

  return this.makeRequest(endpoint, {
    method: 'PUT',
    payload: payload
  });
};

/**
 * Gets workspace information
 * @return {Object} Workspace data
 */
ArenaAPIClient.prototype.getWorkspaceInfo = function() {
  var endpoint = '/settings/workspace';
  return this.makeRequest(endpoint, { method: 'GET' });
};

/**
 * Gets items filtered by category
 * @param {string} category - Category to filter by
 * @return {Object} Filtered items data
 */
ArenaAPIClient.prototype.getItemsByCategory = function(category) {
  return this.getItems({ category: category });
};

/**
 * Searches for items matching a query
 * @param {string} query - Search query string
 * @param {Object} options - Additional search options
 * @return {Object} Search results
 */
ArenaAPIClient.prototype.searchItems = function(query, options) {
  options = options || {};

  var endpoint = '/items/searches';

  // SEC-08: Sanitize and encode user-provided search query
  var safeQuery = encodeURIComponent((query || '').toString().trim().substring(0, 200));

  var queryParams = [];
  queryParams.push('searchQuery=' + safeQuery);

  if (options.limit) {
    queryParams.push('limit=' + options.limit);
  }
  if (options.offset) {
    queryParams.push('offset=' + options.offset);
  }

  endpoint += '?' + queryParams.join('&');

  var response = this.makeRequest(endpoint, { method: 'GET' });
  // Normalize items in the results array
  var key = response.results ? 'results' : (response.Results ? 'Results' : null);
  if (key && Array.isArray(response[key])) {
    response[key] = response[key].map(normalizeArenaItem);
  }
  return response;
};

/**
 * Gets an item by its item number (with shared caching to reduce API calls)
 * Cache is shared across Item Picker, BOM Push, POD Create - 6 hour TTL
 * @param {string} itemNumber - The item number to search for
 * @return {Object} The item object, or null if not found
 */
ArenaAPIClient.prototype.getItemByNumber = function(itemNumber) {
  try {
    var itemCache = this._loadItemCache();
    if (itemCache) {
      Logger.log('Using shared cache (' + Object.keys(itemCache).length + ' items)');
    } else {
      // Cache miss — refresh
      itemCache = this.refreshItemCache();
    }

    // Lookup in cache
    var item = itemCache[itemNumber];

    if (!item) {
      Logger.log('Item not found in cache: ' + itemNumber);
      // Force cache refresh and try again
      itemCache = this.refreshItemCache();
      item = itemCache[itemNumber];

      if (!item) {
        Logger.log('Item not found after cache refresh: ' + itemNumber);
        return null;
      }
    }

    Logger.log('✓ Found item in cache: ' + itemNumber);
    return normalizeArenaItem(item);

  } catch (error) {
    Logger.log('Error getting item by number: ' + error.message);
    throw error;
  }
};

/**
 * Loads the item cache from CacheService.
 * Handles both the legacy single-key format and the sharded format written by _saveItemCache.
 * @return {Object|null} The merged item cache keyed by item number, or null on miss/error.
 */
ArenaAPIClient.prototype._loadItemCache = function() {
  var cache = CacheService.getScriptCache();
  var metaJson = cache.get(ITEM_CACHE_KEY);
  if (!metaJson) return null;

  try {
    var data = JSON.parse(metaJson);

    // Sharded format: main key stores {"shards": N, "count": M}
    if (data && typeof data.shards === 'number' && data.shards > 0) {
      var shardKeys = [];
      for (var s = 0; s < data.shards; s++) {
        shardKeys.push(ITEM_CACHE_KEY + '_' + s);
      }
      var shardValues = cache.getAll(shardKeys);
      var merged = {};
      for (var ms = 0; ms < shardKeys.length; ms++) {
        var shardJson = shardValues[shardKeys[ms]];
        if (shardJson) {
          var shard = JSON.parse(shardJson);
          for (var k in shard) merged[k] = shard[k];
        }
      }
      return Object.keys(merged).length > 0 ? merged : null;
    }

    // Legacy single-key format: main key stores the full cache object directly
    if (typeof data === 'object' && !Array.isArray(data) && !data.shards) {
      return data;
    }
    return null;
  } catch (e) {
    Logger.log('_loadItemCache: parse error: ' + e.message);
    return null;
  }
};

/**
 * Saves the item cache to CacheService, automatically sharding if the payload
 * exceeds 90KB (CacheService enforces a 100KB-per-key hard limit).
 * Writes shard keys as ITEM_CACHE_KEY_0, _1, … and overwrites ITEM_CACHE_KEY
 * with a manifest object {shards: N, count: M}.
 * @param {Object} itemCache - The item cache object keyed by item number.
 */
ArenaAPIClient.prototype._saveItemCache = function(itemCache) {
  var cache = CacheService.getScriptCache();
  var MAX_SHARD_BYTES = 90000; // Leaves 10KB headroom under CacheService's 100KB limit

  var keys = Object.keys(itemCache);
  var shards = [];
  var currentShard = {};
  var currentSize = 2; // opening/closing braces of {}

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    // Estimate serialized size of this entry: "key":value,
    var entrySize = k.length + JSON.stringify(itemCache[k]).length + 4;

    if (currentSize + entrySize > MAX_SHARD_BYTES && Object.keys(currentShard).length > 0) {
      shards.push(currentShard);
      currentShard = {};
      currentSize = 2;
    }
    currentShard[k] = itemCache[k];
    currentSize += entrySize;
  }
  if (Object.keys(currentShard).length > 0) shards.push(currentShard);

  // Write each shard
  for (var s = 0; s < shards.length; s++) {
    cache.put(ITEM_CACHE_KEY + '_' + s, JSON.stringify(shards[s]), ITEM_CACHE_TTL);
  }

  // Manifest key (overwrites legacy single-key cache)
  cache.put(ITEM_CACHE_KEY, JSON.stringify({ shards: shards.length, count: keys.length }), ITEM_CACHE_TTL);

  var totalKB = Math.round(JSON.stringify(itemCache).length / 1024);
  Logger.log('✓ Item cache saved: ' + keys.length + ' items, ' + totalKB + 'KB across ' + shards.length + ' shard(s)');
};

/**
 * Refreshes the shared item cache by fetching all items from Arena
 * Cache is stored in CacheService for 6 hours and shared across all features
 * @return {Object} The item cache object (keyed by item number)
 */
ArenaAPIClient.prototype.refreshItemCache = function() {
  Logger.log('Refreshing shared item cache...');
  var startTime = Date.now();

  var allItems = this.getAllItems();

  // Build cache object keyed by item number
  // Only store essential fields to stay under 100KB CacheService limit
  var itemCache = {};
  for (var i = 0; i < allItems.length; i++) {
    var item = allItems[i];
    var itemNumber = item.number || item.Number;
    if (itemNumber) {
      // Trim to essential fields for BOM/POD operations
      var categoryObj = item.category || item.Category || {};
      var lifecycleObj = item.lifecyclePhase || item.LifecyclePhase || {};

      // url omitted — never read by callers, saves ~60KB on large workspaces
      // category.guid / lifecyclePhase.guid omitted — only names used by display code
      itemCache[itemNumber] = {
        guid: item.guid || item.Guid,
        number: itemNumber,
        name: item.name || item.Name || '',
        description: item.description || item.Description || '',
        revisionNumber: item.revisionNumber || item.RevisionNumber || '',
        assemblyType: item.assemblyType || item.AssemblyType || '',
        isAssembly: item.isAssembly || item.IsAssembly || false,
        category: {
          name: categoryObj.name || categoryObj.Name || ''
        },
        lifecyclePhase: {
          name: lifecycleObj.name || lifecycleObj.Name || ''
        }
      };
    }
  }

  // Store via _saveItemCache — automatically shards across multiple keys if payload > 90KB
  var elapsed = Date.now() - startTime;
  try {
    this._saveItemCache(itemCache);
    Logger.log('refreshItemCache: ' + allItems.length + ' items fetched in ' + elapsed + 'ms');
  } catch (cacheError) {
    Logger.log('⚠️ Could not cache items: ' + cacheError.message);
  }

  return itemCache;
};

/**
 * Invalidates the shared item cache
 * Call this after bulk operations to force a fresh fetch
 */
ArenaAPIClient.prototype.invalidateCache = function() {
  var cache = CacheService.getScriptCache();
  // Read manifest to discover how many shards to clear
  var metaJson = cache.get(ITEM_CACHE_KEY);
  if (metaJson) {
    try {
      var meta = JSON.parse(metaJson);
      if (meta && typeof meta.shards === 'number') {
        for (var s = 0; s < meta.shards; s++) {
          cache.remove(ITEM_CACHE_KEY + '_' + s);
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }
  cache.remove(ITEM_CACHE_KEY);
  Logger.log('Shared item cache invalidated');
};

/**
 * Adds a newly created item to the shared cache
 * This allows immediate use without waiting for cache refresh
 * @param {Object} item - The item object to add to cache
 */
ArenaAPIClient.prototype.addItemToCache = function(item) {
  var itemCache = this._loadItemCache();
  if (!itemCache) return; // Nothing cached yet — skip; next access will refresh

  var itemNumber = item.number || item.Number;
  if (!itemNumber) return;

  var categoryObj = item.category || item.Category || {};
  var lifecycleObj = item.lifecyclePhase || item.LifecyclePhase || {};

  itemCache[itemNumber] = {
    guid: item.guid || item.Guid,
    number: itemNumber,
    name: item.name || item.Name || '',
    description: item.description || item.Description || '',
    revisionNumber: item.revisionNumber || item.RevisionNumber || '',
    assemblyType: item.assemblyType || item.AssemblyType || '',
    isAssembly: item.isAssembly || item.IsAssembly || false,
    category: {
      name: categoryObj.name || categoryObj.Name || ''
    },
    lifecyclePhase: {
      name: lifecycleObj.name || lifecycleObj.Name || ''
    }
  };

  this._saveItemCache(itemCache);
  Logger.log('Added ' + itemNumber + ' to shared cache');
};

/**
 * Gets all items from the shared cache
 * Used by Item Picker for pagination - returns full list for client-side filtering
 * @return {Array} Array of all cached item objects
 */
ArenaAPIClient.prototype.getAllCachedItems = function() {
  var itemCache = this._loadItemCache();
  if (!itemCache) {
    // Cache miss — refresh
    itemCache = this.refreshItemCache();
  }
  Logger.log('Returning ' + Object.keys(itemCache).length + ' items from shared cache');
  return Object.values(itemCache);
};

/**
 * Gets detailed attributes for a specific item
 * @param {string} itemId - The item identifier
 * @return {Object} Detailed item attributes
 */
ArenaAPIClient.prototype.getItemAttributes = function(itemId) {
  var endpoint = '/items/' + encodeURIComponent(itemId) + '/attributes';
  return this.makeRequest(endpoint, { method: 'GET' });
};

/**
 * Gets multiple items by their IDs in bulk
 * @param {Array<string>} itemIds - Array of item identifiers
 * @return {Array<Object>} Array of item data
 */
ArenaAPIClient.prototype.getBulkItems = function(itemIds) {
  if (!itemIds || itemIds.length === 0) {
    return [];
  }

  // Arena API typically doesn't have a bulk endpoint, fetch individually
  var results = [];

  itemIds.forEach(function(itemId) {
    try {
      var item = this.getItem(itemId);
      results.push(item);
    } catch (itemError) {
      Logger.log('Error fetching item ' + itemId + ': ' + itemError.message);
    }
  }.bind(this));

  return results;
};

/**
 * Gets all items with pagination support
 * @param {number} batchSize - Number of items per request (default 100)
 * @return {Array<Object>} All items from the workspace
 */
ArenaAPIClient.prototype.getAllItems = function(batchSize) {
  batchSize = batchSize || 400; // Use max batch size (400) for better performance

  var allItems = [];
  var offset = 0;
  var hasMore = true;

  while (hasMore) {
    try {
      var response = this.getItems({ limit: batchSize, offset: offset });

      // Handle different possible response structures (Arena uses capital R)
      var items = response.results || response.Results || response.items || response.data || [];

      if (Array.isArray(response)) {
        items = response;
      }

      if (items.length > 0) {
        allItems = allItems.concat(items);
        offset += items.length;

        Logger.log('Fetched ' + items.length + ' items (total: ' + allItems.length + ')');

        // Check if there are more items
        if (items.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

    } catch (error) {
      Logger.log('Error fetching items at offset ' + offset + ': ' + error.message);
      hasMore = false;
    }
  }

  Logger.log('Fetched ' + allItems.length + ' total items from Arena');
  return allItems;
};

/**
 * Gets items filtered by multiple criteria
 * @param {Object} filters - Filter criteria (category, status, etc.)
 * @return {Array<Object>} Filtered items
 */
ArenaAPIClient.prototype.getFilteredItems = function(filters) {
  var response = this.getItems(filters);

  // Extract items from response
  return response.results || response.items || response.data || response;
};

/**
 * Exports data from Arena to the current spreadsheet
 * This is a helper function that demonstrates workspace-scoped data retrieval
 * @param {string} dataType - Type of data to export
 */
ArenaAPIClient.prototype.exportToSheet = function(dataType) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  try {
    var data;

    switch (dataType) {
      case 'items':
        data = this.getItems();
        break;
      case 'workspace':
        data = this.getWorkspaceInfo();
        break;
      default:
        throw new Error('Unknown data type: ' + dataType);
    }

    // Clear existing content
    sheet.clear();

    // Add workspace ID header
    sheet.getRange(1, 1).setValue('Workspace ID:');
    sheet.getRange(1, 2).setValue(this.workspaceId);

    // Add data (implementation depends on actual API response structure)
    // This is a placeholder that would need to be customized
    sheet.getRange(3, 1).setValue('Data:');
    sheet.getRange(4, 1).setValue(JSON.stringify(data, null, 2));

    return { success: true, message: 'Data exported successfully' };

  } catch (error) {
    Logger.log('Export error: ' + error.message);
    throw error;
  }
};

/**
 * Gets future change orders (ECOs) for an item
 * @param {string} itemGuid - The item GUID
 * @return {Array<Object>} Array of future changes, or empty array if none
 */
ArenaAPIClient.prototype.getItemFutureChanges = function(itemGuid) {
  try {
    var endpoint = '/items/' + encodeURIComponent(itemGuid) + '/futurechanges';
    var response = this.makeRequest(endpoint, { method: 'GET' });

    // Extract results array
    var changes = response.results || response.Results || response.data || [];

    if (Array.isArray(response)) {
      changes = response;
    }

    Logger.log('Item ' + itemGuid + ' has ' + changes.length + ' future change(s)');
    return changes;

  } catch (error) {
    Logger.log('Error fetching future changes for item ' + itemGuid + ': ' + error.message);
    // Return empty array on error (graceful degradation)
    return [];
  }
};

/**
 * Gets file attachments for an item
 * @param {string} itemGuid - The item GUID
 * @return {Array<Object>} Array of files, or empty array if none
 */
ArenaAPIClient.prototype.getItemFiles = function(itemGuid) {
  try {
    var endpoint = '/items/' + encodeURIComponent(itemGuid) + '/files';
    var response = this.makeRequest(endpoint, { method: 'GET' });

    // Extract results array
    var files = response.results || response.Results || response.data || [];

    if (Array.isArray(response)) {
      files = response;
    }

    Logger.log('Item ' + itemGuid + ' has ' + files.length + ' file(s)');
    return files;

  } catch (error) {
    Logger.log('Error fetching files for item ' + itemGuid + ': ' + error.message);
    // Return empty array on error (graceful degradation)
    return [];
  }
};

/**
 * Builds Arena web UI URL for an item
 * @param {Object} item - The item object
 * @param {string} itemNumber - The item number (fallback for search)
 * @return {string} Arena web UI URL
 */
ArenaAPIClient.prototype.buildArenaWebURL = function(item, itemNumber) {
  try {
    // Extract item_id and version_id from Arena item
    var itemId = item.itemId || item.ItemId || item.id || item.Id;
    var versionId = item.versionId || item.VersionId;

    // If we don't have the specific IDs, use search URL as fallback
    if (!itemId || !versionId) {
      Logger.log('WARNING: Missing itemId or versionId for ' + itemNumber + ', using search URL');
      return 'https://app.bom.com/search?query=' + encodeURIComponent(itemNumber);
    }

    // Build the proper Arena web UI URL
    var arenaUrl = 'https://app.bom.com/items/detail-spec?item_id=' + itemId + '&version_id=' + versionId;

    return arenaUrl;
  } catch (error) {
    Logger.log('Error building Arena URL for ' + itemNumber + ': ' + error.message);
    // Fallback to search URL on error
    return 'https://app.bom.com/search?query=' + encodeURIComponent(itemNumber);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL BOM FETCH — UrlFetchApp.fetchAll() fast path
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds a UrlFetchApp-compatible request object for fetching one item's BOM.
 * Used with UrlFetchApp.fetchAll() to fetch an entire BOM level in one batch.
 * @param {string} itemGuid - Item GUID
 * @return {Object} Request object compatible with UrlFetchApp.fetchAll
 */
ArenaAPIClient.prototype.bomFetchRequest = function(itemGuid) {
  return {
    url: this.apiBase + '/items/' + encodeURIComponent(itemGuid) + '/bom',
    method: 'GET',
    headers: {
      'arena_session_id': this.sessionId,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT API — Multi-level BOM fast path (alternative, kept for reference)
// Uses POST /exports + run + poll + download ZIP instead of N recursive calls.
// For a 151-item tree this reduces ~152 API calls (~70s) to ~5-8 calls (~5-12s).
// ═══════════════════════════════════════════════════════════════════════════

var EXPORT_DEF_PROP_KEY = 'ARENA_BOM_EXPORT_DEF_GUID';

/**
 * Gets the cached BOM export definition GUID, or creates a new one.
 * The definition is generic (no criteria) and reused across all BOM loads.
 * GUID is persisted in PropertiesService so it survives across sessions.
 * @return {string} Export definition GUID
 */
ArenaAPIClient.prototype._getOrCreateBOMExportDef = function() {
  var props = PropertiesService.getScriptProperties();
  var cachedGuid = props.getProperty(EXPORT_DEF_PROP_KEY);

  if (cachedGuid) {
    // Quick verify — Arena returns 404 if the def was deleted
    try {
      this.makeRequest('/exports/' + cachedGuid, { method: 'GET' });
      Logger.log('BOM export def: using cached ' + cachedGuid);
      return cachedGuid;
    } catch (e) {
      Logger.log('Cached export def gone, recreating: ' + e.message);
      props.deleteProperty(EXPORT_DEF_PROP_KEY);
    }
  }

  Logger.log('Creating BOM export definition...');
  var defResponse = this.makeRequest('/exports', {
    method: 'POST',
    payload: {
      name: 'BOM Tree Loader - Arena Sheets',
      description: 'Auto-created by PTC Arena Sheets. Safe to delete — will be recreated on next use.',
      world: 'ITEMS',
      options: {
        exportViews: ['BOM'],
        bomLevels: 'FULL',
        header: 'apiName',
        revisionStatus: 'WORKING',
        format: 'json'
      }
    }
  });

  var defGuid = defResponse.guid || defResponse.Guid;
  if (!defGuid) {
    throw new Error('Export def creation returned no GUID: ' + JSON.stringify(defResponse));
  }

  props.setProperty(EXPORT_DEF_PROP_KEY, defGuid);
  Logger.log('BOM export def created: ' + defGuid);
  return defGuid;
};

/**
 * Downloads a binary blob from Arena (used for ZIP export files).
 * Unlike makeRequest() which always JSON-parses, this returns the raw Blob.
 * @param {string} url - Full URL to fetch
 * @return {Blob} Response blob
 */
ArenaAPIClient.prototype._fetchBlob = function(url) {
  var response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: {
      'arena_session_id': this.sessionId,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Export download failed: HTTP ' + code + ' from ' + url);
  }
  return response.getBlob();
};

/**
 * Runs a full multi-level BOM export for a single root item and returns
 * the parsed JSON content from the ZIP result.
 *
 * Flow: create/cache def → POST run → poll until COMPLETE → download ZIP → parse JSON
 *
 * @param {string} itemNumber - Arena item number (used for logging only)
 * @param {string} itemGuid   - Arena item GUID (used as run criteria)
 * @return {*} Parsed export JSON (structure varies by Arena version — handled by callers)
 */
ArenaAPIClient.prototype.runBOMExport = function(itemNumber, itemGuid) {
  var defGuid = this._getOrCreateBOMExportDef();

  // POST the export run scoped to just this one item
  Logger.log('Starting BOM export run for ' + itemNumber + ' (' + itemGuid + ')...');
  var runResponse = this.makeRequest('/exports/' + defGuid + '/runs', {
    method: 'POST',
    payload: {
      // Arena requires criteria wrapped in a criterion group (double array = OR[AND[...]])
      criteria: [[{
        attribute: 'guid',
        operator: 'IS_EQUAL_TO',
        value: itemGuid
      }]]
    }
  });

  var runGuid = runResponse.guid || runResponse.Guid;
  if (!runGuid) {
    throw new Error('Export run returned no GUID: ' + JSON.stringify(runResponse));
  }

  Logger.log('Export run ' + runGuid + ' started, polling for completion...');

  // Poll until COMPLETE / FAILED / ABORTED (max 40 × 2s = 80s)
  var status = runResponse.status || runResponse.Status || 'CREATED';
  var runData = runResponse;
  var maxPolls = 40;

  for (var i = 0; i < maxPolls && status !== 'COMPLETE' && status !== 'FAILED' && status !== 'ABORTED'; i++) {
    Utilities.sleep(2000);
    runData = this.makeRequest('/exports/' + defGuid + '/runs/' + runGuid, { method: 'GET' });
    status = runData.status || runData.Status || '';
    Logger.log('Export poll ' + (i + 1) + '/40: status = ' + status);
  }

  if (status !== 'COMPLETE') {
    throw new Error('Export run ended with status "' + status + '" — not COMPLETE');
  }

  // Extract file GUID from the completed run
  var files = runData.files || runData.Files || [];
  if (!files.length) {
    throw new Error('Export COMPLETE but returned no files');
  }

  var fileGuid = files[0].guid || files[0].Guid;
  if (!fileGuid) {
    throw new Error('Export file entry has no GUID: ' + JSON.stringify(files[0]));
  }

  Logger.log('Downloading export ZIP (file ' + fileGuid + ')...');
  var downloadUrl = this.apiBase + '/exports/' + defGuid + '/runs/' + runGuid + '/files/' + fileGuid + '/content';
  var zipBlob = this._fetchBlob(downloadUrl);

  // Unzip and find the JSON file
  var zipFiles = Utilities.unzip(zipBlob);
  Logger.log('Export ZIP contains ' + zipFiles.length + ' file(s)');

  for (var j = 0; j < zipFiles.length; j++) {
    var name = zipFiles[j].getName();
    Logger.log('ZIP entry: ' + name);
    if (name.toLowerCase().indexOf('.json') !== -1) {
      var content = zipFiles[j].getDataAsString();
      Logger.log('Parsing JSON export (' + Math.round(content.length / 1024) + ' KB)...');
      return JSON.parse(content);
    }
  }

  throw new Error('No .json file found inside export ZIP (' + zipFiles.length + ' entries)');
};
