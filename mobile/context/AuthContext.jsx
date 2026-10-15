import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { authService } from '../services/auth';
import { storage } from '../services/storage';
import { setOnUnauthorizedCallback } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidated, setIsValidated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Reference to prevent duplicate concurrent in-flight validation requests
  const inFlightValidationRef = useRef(null);
  const lastValidatedAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Logout cleanup error:', e);
    } finally {
      setUser(null);
      setToken(null);
      setIsValidated(false);
      setIsOffline(false);
      setAuthError(null);
      lastValidatedAtRef.current = 0;
    }
  }, []);

  /**
   * Validate token against GET /auth/me with deduplication.
   * Returns authoritative user profile or throws error.
   */
  const validateSessionWithServer = useCallback(async (authToken) => {
    if (inFlightValidationRef.current) {
      return inFlightValidationRef.current;
    }

    const promise = (async () => {
      try {
        const profile = await authService.getMe();
        lastValidatedAtRef.current = Date.now();
        return profile;
      } finally {
        inFlightValidationRef.current = null;
      }
    })();

    inFlightValidationRef.current = promise;
    return promise;
  }, []);

  /**
   * Startup session restoration:
   * 1. Read stored token and cached user from SecureStore / localStorage.
   * 2. If token is absent: clean up stale cached user if any and finish.
   * 3. If token is present: provisionally restore cached user immediately.
   * 4. Validate with /auth/me.
   * 5. If 401: clear invalid session.
   * 6. If network/transient error: keep token and cached user (mark isOffline = true).
   */
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const [storedToken, storedUser] = await Promise.all([
        storage.getToken(),
        storage.getUser(),
      ]);

      // Case 1: No stored token
      if (!storedToken) {
        if (storedUser) {
          // Clean up inconsistent storage state
          await storage.removeUser();
        }
        setUser(null);
        setToken(null);
        setIsValidated(false);
        setIsOffline(false);
        setIsLoading(false);
        return;
      }

      // Case 2: Stored token exists -> Fast provisional restoration
      setToken(storedToken);
      if (storedUser) {
        setUser(storedUser);
      }

      // Validate session with backend
      try {
        const freshProfile = await validateSessionWithServer(storedToken);
        setUser(freshProfile);
        await storage.setUser(freshProfile);
        setIsValidated(true);
        setIsOffline(false);
        setAuthError(null);
      } catch (validationErr) {
        const status = validationErr.response ? validationErr.response.status : null;

        if (status === 401 || status === 403) {
          // Confirmed invalid or expired token
          console.warn('Stored JWT is expired or invalid. Clearing session.');
          await storage.clearAll();
          setUser(null);
          setToken(null);
          setIsValidated(false);
          setIsOffline(false);
        } else {
          // Transient error: network timeout, offline, Render cold start, 5xx
          console.warn('Backend unavailable during session restoration. Preserving credentials.', validationErr.message);
          setIsOffline(true);
          setIsValidated(false);

          if (!storedUser) {
            // Token exists but cached user is missing and server unreachable
            setAuthError(validationErr.friendlyMessage || 'Unable to connect to server. Please check your network.');
          }
        }
      }
    } catch (err) {
      console.warn('Unexpected error during session restore:', err);
      await storage.clearAll();
      setUser(null);
      setToken(null);
      setIsValidated(false);
    } finally {
      setIsLoading(false);
    }
  }, [validateSessionWithServer]);

  /**
   * Explicit retry action for when network returns or user taps Retry.
   */
  const retrySessionValidation = useCallback(async () => {
    const currentToken = token || (await storage.getToken());
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsOffline(false);
      return;
    }

    try {
      const freshProfile = await validateSessionWithServer(currentToken);
      setUser(freshProfile);
      await storage.setUser(freshProfile);
      setIsValidated(true);
      setIsOffline(false);
      setAuthError(null);
      return freshProfile;
    } catch (err) {
      const status = err.response ? err.response.status : null;
      if (status === 401 || status === 403) {
        await storage.clearAll();
        setUser(null);
        setToken(null);
        setIsValidated(false);
        setIsOffline(false);
      } else {
        setIsOffline(true);
        setAuthError(err.friendlyMessage || 'Connection failed. Please try again.');
      }
      throw err;
    }
  }, [token, validateSessionWithServer]);

  useEffect(() => {
    // Intercept 401s from API requests to trigger safe logout
    setOnUnauthorizedCallback(() => {
      logout();
    });

    restoreSession();
  }, [restoreSession, logout]);

  // Handle app foreground / resume events safely without creating request loops
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        const currentToken = await storage.getToken();
        const now = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;

        // Re-validate only if token exists and either session is offline or > 5 mins since last check
        if (currentToken && (isOffline || now - lastValidatedAtRef.current > FIVE_MINUTES)) {
          try {
            const freshProfile = await validateSessionWithServer(currentToken);
            setUser(freshProfile);
            await storage.setUser(freshProfile);
            setIsValidated(true);
            setIsOffline(false);
            setAuthError(null);
          } catch (e) {
            // Safe ignore of background check failures to prevent disrupting active user
            if (e.response?.status === 401) {
              await logout();
            }
          }
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isOffline, validateSessionWithServer, logout]);

  const login = async (username, password) => {
    const result = await authService.login(username, password);
    setToken(result.token);
    setUser(result.user);
    setIsValidated(true);
    setIsOffline(false);
    setAuthError(null);
    lastValidatedAtRef.current = Date.now();
    return result.user;
  };

  const refreshProfile = async () => {
    try {
      const currentToken = token || (await storage.getToken());
      if (!currentToken) return null;
      const profile = await validateSessionWithServer(currentToken);
      setUser(profile);
      await storage.setUser(profile);
      setIsValidated(true);
      setIsOffline(false);
      setAuthError(null);
      return profile;
    } catch (e) {
      if (e.response?.status === 401) {
        await logout();
      }
      return null;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isValidated,
    isOffline,
    authError,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    login,
    logout,
    refreshProfile,
    retrySessionValidation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
