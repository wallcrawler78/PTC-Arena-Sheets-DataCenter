# Session Management Pattern

## 🤖 AI Agent Instructions

**WHEN**: User requests ANY API operation(s)
**THEN**: Apply session management pattern based on operation count
**PATTERN**: Login Once → Reuse Session → Logout Once

---

## 🎯 Decision Tree

```
ANALYZE user_request:
  ↓
COUNT number_of_operations:
  ↓
IF single_operation:
  → APPLY Pattern A (Single Operation)
ELSE IF multiple_operations:
  → APPLY Pattern B (Series of Operations)
ELSE IF concurrent_operations:
  → APPLY Pattern C (Multi-threaded)
```

---

## Overview

For Arena PLM API integration, follow the **Login Once, Reuse Session, Logout Once** pattern.

## ✅ Correct Pattern: Series of Operations

```
Login (once)
    ↓
Operation 1
    ↓
Operation 2
    ↓
Operation 3
    ↓
...
    ↓
Logout (once)
```

### Implementation

```java
SessionManager sessionManager = new SessionManager(email, password, workspaceId);
ApiClient apiClient = new ApiClient(sessionManager);
DomainApi domainApi = new DomainApi(apiClient);

try {
    // Login happens automatically on first API call
    String result1 = domainApi.operation1();    // Triggers login
    String result2 = domainApi.operation2();    // Reuses session
    String result3 = domainApi.operation3();    // Reuses session
    
} finally {
    // Logout once at the end
    apiClient.logout();
}
```

## ❌ Wrong Pattern: Multiple Login/Logout Cycles

```
Login → Operation 1 → Logout → Login → Operation 2 → Logout (WRONG!)
```

### Why This Is Wrong

```java
// ❌ BAD: Multiple login/logout cycles
SessionManager sm1 = new SessionManager(email, password, workspaceId);
ApiClient client1 = new ApiClient(sm1);
try {
    client1.operation1();
} finally {
    client1.logout();
}

SessionManager sm2 = new SessionManager(email, password, workspaceId);
ApiClient client2 = new ApiClient(sm2);
try {
    client2.operation2();
} finally {
    client2.logout();
}
```

**Problems**:
- ❌ Unnecessary authentication overhead
- ❌ Poor performance (multiple logins)
- ❌ Potential rate limiting issues
- ❌ Resource waste

## Single Operation Pattern

For **single operations only**, the pattern is simpler:

```java
SessionManager sessionManager = new SessionManager(email, password, workspaceId);
ApiClient apiClient = new ApiClient(sessionManager);
DomainApi domainApi = new DomainApi(apiClient);

try {
    String result = domainApi.someOperation();
} finally {
    apiClient.logout();
}
```

## Multi-threaded Pattern

For **concurrent operations**, share the SessionManager:

```java
// Single SessionManager instance shared across threads
SessionManager sessionManager = new SessionManager(email, password, workspaceId);

// Thread 1
new Thread(() -> {
    ApiClient client1 = new ApiClient(sessionManager);
    DomainApi api1 = new DomainApi(client1);
    api1.operation1(); // Shares session
}).start();

// Thread 2
new Thread(() -> {
    ApiClient client2 = new ApiClient(sessionManager);
    DomainApi api2 = new DomainApi(client2);
    api2.operation2(); // Shares session
}).start();

// Cleanup after all threads complete
allThreads.join();
apiClient.logout();
```

## 📋 Key Rules (MANDATORY)

```
RULE 1: Create SessionManager ONCE per workflow
  - ONE instance for single workflow
  - REUSE same instance for all operations

RULE 2: Do NOT logout between operations
  - Login → Op1 → Op2 → Op3 → Logout ✅
  - Login → Op1 → Logout → Login → Op2 → Logout ❌

RULE 3: Use try-finally for cleanup
  - ALWAYS logout in finally block
  - ENSURES cleanup even if exceptions occur

RULE 4: Thread-safe implementation required
  - Use locks/mutexes for session cache
  - Check expiry before reuse
  - Auto re-authenticate if expired

RULE 5: Session reuse across operations
  - First operation triggers login
  - Subsequent operations reuse cached session
  - No manual login() calls needed
```

---

## 🔧 Thread Safety Requirements

**MUST implement** in SessionManager:

```pseudo
CLASS SessionManager:
    PRIVATE sessionCache = null
    PRIVATE lastLoginTime = null
    PRIVATE lock = new Mutex()
    
    FUNCTION getSession():
        lock.acquire()
        TRY:
            IF sessionCache is not null AND NOT isExpired():
                RETURN sessionCache  // Reuse cached
            
            sessionCache = login()   // New login
            lastLoginTime = now()
            RETURN sessionCache
        FINALLY:
            lock.release()
    
    FUNCTION isExpired():
        IF lastLoginTime is null:
            RETURN true
        RETURN (now() - lastLoginTime) > EXPIRY_THRESHOLD
    
    FUNCTION logout():
        lock.acquire()
        TRY:
            IF sessionCache is not null:
                performLogout(sessionCache)
                sessionCache = null
                lastLoginTime = null
        FINALLY:
            lock.release()
```

---

## ✅ Pattern Selection Guide for AI Agents

```
WHEN generating_code:
    operation_count = COUNT_OPERATIONS(user_request)
    
    IF operation_count == 1:
        USE Pattern A (Single Operation)
        STRUCTURE:
            create SessionManager
            create ApiClient
            try:
                result = operation()
            finally:
                logout()
    
    ELSE IF operation_count > 1:
        USE Pattern B (Series of Operations)
        STRUCTURE:
            create SessionManager  // ONCE
            create ApiClient
            try:
                result1 = operation1()  // Login
                result2 = operation2()  // Reuse
                result3 = operation3()  // Reuse
            finally:
                logout()  // ONCE
    
    ELSE IF concurrent:
        USE Pattern C (Multi-threaded)
        STRUCTURE:
            create SessionManager  // SHARED
            spawn threads:
                each thread creates own ApiClient
                all share SessionManager
            join threads
            logout()  // ONCE at end
```

