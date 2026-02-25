/**
 * Arena API Authorization Management
 * Handles session-based authentication with Arena API
 */

// Property keys for credential storage
var PROPERTY_KEYS = {
  API_BASE: 'ARENA_API_BASE',
  EMAIL: 'ARENA_EMAIL',
  PASSWORD: 'ARENA_PASSWORD',
  SESSION_ID: 'ARENA_SESSION_ID',
  SESSION_TS: 'ARENA_SESSION_TS',
  WORKSPACE_ID: 'ARENA_WORKSPACE_ID'
};

// Arena API base URL
var ARENA_API_BASE = 'https://api.arenasolutions.com/v1';

/**
 * Saves Arena API credentials to user properties
 * @param {Object} credentials - Object containing email, password, and workspaceId
 * @return {Object} Result object with success status
 */
function saveArenaCredentials(credentials) {
  try {
    var userProperties = PropertiesService.getUserProperties();

    // Validate required fields
    if (!credentials.email || credentials.email.trim() === '') {
      throw new Error('Email is required');
    }
    if (!credentials.password || credentials.password.trim() === '') {
      throw new Error('Password is required');
    }
    if (!credentials.workspaceId || credentials.workspaceId.trim() === '') {
      throw new Error('Workspace ID is required');
    }

    var wsId = credentials.workspaceId.trim();
    if (!/^\d+$/.test(wsId)) {
      throw new Error(
        'Workspace ID must be a number (e.g. 123456789). ' +
        'Find it in Arena under Settings → Workspace. You may have entered the workspace name instead.'
      );
    }

    // Save credentials
    userProperties.setProperty(PROPERTY_KEYS.API_BASE, ARENA_API_BASE);
    userProperties.setProperty(PROPERTY_KEYS.EMAIL, credentials.email.trim());
    userProperties.setProperty(PROPERTY_KEYS.PASSWORD, credentials.password.trim());
    userProperties.setProperty(PROPERTY_KEYS.WORKSPACE_ID, credentials.workspaceId.trim());

    // Clear any existing session (will need to login again)
    userProperties.deleteProperty(PROPERTY_KEYS.SESSION_ID);
    userProperties.deleteProperty(PROPERTY_KEYS.SESSION_TS);

    Logger.log('Arena API credentials saved successfully');
    return { success: true, message: 'Credentials saved successfully' };

  } catch (error) {
    Logger.log('Error saving credentials: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieves the Arena API base URL
 * @return {string} The API base URL
 */
function getApiBase() {
  var base = PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.API_BASE);
  return base || ARENA_API_BASE;
}

/**
 * Retrieves the Arena email
 * @return {string|null} The email or null if not set
 */
function getEmail() {
  return PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.EMAIL);
}

/**
 * Retrieves the Arena password
 * @return {string|null} The password or null if not set
 */
function getPassword() {
  return PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.PASSWORD);
}

/**
 * Retrieves the Arena session ID
 * @return {string|null} The session ID or null if not set
 */
function getSessionId() {
  return PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.SESSION_ID);
}

/**
 * Retrieves the Arena session timestamp
 * @return {string|null} The session timestamp or null if not set
 */
function getSessionTimestamp() {
  return PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.SESSION_TS);
}

/**
 * Retrieves the Arena workspace ID
 * @return {string|null} The workspace ID or null if not set
 */
function getWorkspaceId() {
  return PropertiesService.getUserProperties().getProperty(PROPERTY_KEYS.WORKSPACE_ID);
}

/**
 * Saves the session ID and timestamp after successful login
 * @param {string} sessionId - The arena_session_id from login response
 * @param {number} timestamp - The timestamp when session was created
 */
function saveSession(sessionId, timestamp) {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty(PROPERTY_KEYS.SESSION_ID, sessionId);
  userProperties.setProperty(PROPERTY_KEYS.SESSION_TS, timestamp.toString());
  Logger.log('Arena session saved');
}

/**
 * Clears the current session (forces re-login)
 */
function clearSession() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty(PROPERTY_KEYS.SESSION_ID);
  userProperties.deleteProperty(PROPERTY_KEYS.SESSION_TS);
  Logger.log('Arena session cleared');
}

/**
 * Checks if the current session is still valid
 * Arena sessions expire after 90 minutes of inactivity
 * @return {boolean} True if session is valid
 */
function isSessionValid() {
  var sessionId = getSessionId();
  var sessionTs = getSessionTimestamp();

  if (!sessionId || !sessionTs) {
    return false;
  }

  // Check if session is older than 80 minutes (safe margin before 90 min timeout)
  var now = new Date().getTime();
  var sessionTime = parseInt(sessionTs, 10);
  var ageInMinutes = (now - sessionTime) / (1000 * 60);

  if (ageInMinutes > 80) {
    Logger.log('Session expired (age: ' + ageInMinutes + ' minutes)');
    return false;
  }

  return true;
}

/**
 * Retrieves all Arena API credentials
 * @return {Object|null} Object containing all credentials or null if not configured
 */
function getArenaCredentials() {
  var email = getEmail();
  var password = getPassword();
  var workspaceId = getWorkspaceId();

  if (!email || !password || !workspaceId) {
    return null;
  }

  return {
    apiBase: getApiBase(),
    email: email,
    password: password,
    workspaceId: workspaceId,
    sessionId: getSessionId(),
    sessionTs: getSessionTimestamp()
  };
}

/**
 * Checks if Arena API credentials are configured
 * @return {boolean} True if all required credentials are set
 */
function isAuthorized() {
  var credentials = getArenaCredentials();
  return credentials !== null;
}

/**
 * Clears all stored Arena API credentials and session
 */
function clearArenaCredentials() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty(PROPERTY_KEYS.API_BASE);
  userProperties.deleteProperty(PROPERTY_KEYS.EMAIL);
  userProperties.deleteProperty(PROPERTY_KEYS.PASSWORD);
  userProperties.deleteProperty(PROPERTY_KEYS.SESSION_ID);
  userProperties.deleteProperty(PROPERTY_KEYS.SESSION_TS);
  userProperties.deleteProperty(PROPERTY_KEYS.WORKSPACE_ID);
  Logger.log('Arena API credentials and session cleared');
}

/**
 * Gets the current authorization status for display
 * @return {Object} Status object with configuration details
 */
function getAuthorizationStatus() {
  var credentials = getArenaCredentials();

  if (!credentials) {
    return {
      isConfigured: false,
      message: 'Not configured'
    };
  }

  return {
    isConfigured: true,
    email: credentials.email,
    workspaceId: credentials.workspaceId,
    hasPassword: true,
    hasSession: isSessionValid()
  };
}

/**
 * Performs login to Arena API and saves session
 * @return {Object} Login result with session info
 */
function loginToArena() {
  var credentials = getArenaCredentials();

  if (!credentials) {
    throw new Error('Credentials not configured');
  }

  var url = credentials.apiBase + '/login';

  var payload = {
    email: credentials.email,
    password: credentials.password,
    workspaceId: credentials.workspaceId
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log('Attempting login to Arena API...');
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode === 200) {
      var data = JSON.parse(responseText);

      // Save session ID and current timestamp
      // Arena returns 'arenaSessionId' (camelCase)
      var sessionId = data.arenaSessionId || data.arena_session_id;
      if (sessionId) {
        if (data.workspaceId !== undefined && data.workspaceId.toString() !== credentials.workspaceId.toString()) {
          throw new Error(
            'Workspace ID mismatch: you configured "' + credentials.workspaceId +
            '" but Arena returned "' + data.workspaceId + '". ' +
            'Please re-enter the correct Workspace ID in Arena → Settings.'
          );
        }

        saveSession(sessionId, new Date().getTime());

        Logger.log('Login successful - session created');
        return {
          success: true,
          sessionId: sessionId,
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          requestLimit: data.workspaceRequestLimit
        };
      } else {
        throw new Error('No session ID in response');
      }

    } else {
      var errorMessage = 'Login failed (HTTP ' + responseCode + ')';
      try {
        var errorData = JSON.parse(responseText);
        if (errorData.message || errorData.error) {
          errorMessage += ': ' + (errorData.message || errorData.error);
        }
      } catch (e) {
        errorMessage += ': ' + responseText;
      }

      throw new Error(errorMessage);
    }

  } catch (error) {
    Logger.log('Login error: ' + error.message);
    throw error;
  }
}

/**
 * Gets a valid session ID, logging in if necessary
 * @return {string} Valid session ID
 */
function getValidSessionId() {
  // Check if we have a valid session
  if (isSessionValid()) {
    return getSessionId();
  }

  // Session expired or doesn't exist, need to login
  Logger.log('No valid session, logging in...');
  var loginResult = loginToArena();

  if (loginResult.success) {
    return loginResult.sessionId;
  }

  throw new Error('Failed to obtain valid session');
}
