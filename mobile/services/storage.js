import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'chetna_auth_token';
const USER_KEY = 'chetna_user_data';
const LANGUAGE_KEY = 'chetna_language';

export const storage = {
  async getToken() {
    try {
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (e) {
      console.warn('Error reading token from SecureStore:', e);
      return null;
    }
  },

  async setToken(token) {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
        return;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
      console.warn('Error saving token to SecureStore:', e);
    }
  },

  async removeToken() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
        return;
      }
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (e) {
      console.warn('Error deleting token from SecureStore:', e);
    }
  },

  async getUser() {
    try {
      let raw = null;
      if (Platform.OS === 'web') {
        raw = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  async setUser(user) {
    try {
      const raw = JSON.stringify(user);
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, raw);
        return;
      }
      await SecureStore.setItemAsync(USER_KEY, raw);
    } catch (e) {}
  },

  async removeUser() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.removeItem(USER_KEY);
        return;
      }
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {}
  },

  async clearAll() {
    await this.removeToken();
    await this.removeUser();
  },

  async getLanguage() {
    try {
      if (Platform.OS === 'web') {
        return (typeof window !== 'undefined' && localStorage.getItem(LANGUAGE_KEY)) || 'mr';
      }
      const lang = await SecureStore.getItemAsync(LANGUAGE_KEY);
      return lang || 'mr';
    } catch (e) {
      return 'mr';
    }
  },

  async setLanguage(lang) {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') localStorage.setItem(LANGUAGE_KEY, lang);
        return;
      }
      await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
    } catch (e) {
      console.warn('Error saving language preference:', e);
    }
  }
};
