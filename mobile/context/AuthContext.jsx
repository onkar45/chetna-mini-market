import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';
import { storage } from '../services/storage';
import { setOnUnauthorizedCallback } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  // Restore session on app start
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await storage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      // Validate token with backend GET /auth/me
      const profile = await authService.getMe();
      setUser(profile);
    } catch (error) {
      console.warn('Session restoration failed:', error.message);
      await storage.clearAll();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Intercept 401s from API client to trigger logout
    setOnUnauthorizedCallback(() => {
      logout();
    });

    restoreSession();
  }, [restoreSession, logout]);

  const login = async (username, password) => {
    const result = await authService.login(username, password);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const refreshProfile = async () => {
    try {
      const profile = await authService.getMe();
      setUser(profile);
      return profile;
    } catch (e) {
      return null;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    refreshProfile,
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
