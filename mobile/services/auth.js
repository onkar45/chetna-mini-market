import api from './api';
import { storage } from './storage';

export const authService = {
  /**
   * Authenticate user with username and password.
   */
  async login(username, password) {
    const response = await api.post('/auth/login', {
      username: username.trim(),
      password,
    });
    const { access_token, user } = response.data;
    await storage.setToken(access_token);
    await storage.setUser(user);
    return { token: access_token, user };
  },

  /**
   * Fetch current authenticated user profile.
   */
  async getMe() {
    const response = await api.get('/auth/me');
    const user = response.data;
    await storage.setUser(user);
    return user;
  },

  /**
   * Clear stored authentication session.
   */
  async logout() {
    await storage.clearAll();
  },
};
