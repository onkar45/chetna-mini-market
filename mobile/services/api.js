import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { storage } from './storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let onUnauthorizedCallback = null;

export const setOnUnauthorizedCallback = (callback) => {
  onUnauthorizedCallback = callback;
};

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to attach bearer token to request:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format error messages and handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response ? error.response.status : null;

    if (status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    // Extract useful error message
    let message = 'Network connection error. Please check your internet connection.';
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors (422)
        message = detail.map((err) => `${err.loc ? err.loc.slice(1).join('.') + ': ' : ''}${err.msg}`).join('\n');
      }
    } else if (error.message) {
      message = error.message;
    }

    error.friendlyMessage = message;
    return Promise.reject(error);
  }
);

export default api;
