import { Platform } from 'react-native';
import api from './api';
import { API_BASE_URL } from '../constants/config';
import { storage } from './storage';

export const productsService = {
  /**
   * Fetch products with optional search, category, and pagination.
   */
  async getProducts({ search = '', category = '', skip = 0, limit = 50, is_active } = {}) {
    const params = {};
    if (search && search.trim()) params.search = search.trim();
    if (category && category !== 'All') params.category = category.trim();
    if (typeof is_active === 'boolean') params.is_active = is_active;
    if (skip > 0) params.skip = skip;
    if (limit) params.limit = limit;

    const response = await api.get('/products', { params });
    return response.data;
  },

  /**
   * Fetch single product by ID.
   */
  async getProductById(productId) {
    const response = await api.get(`/products/${productId}`);
    return response.data;
  },

  /**
   * Create a new product (Admin only).
   */
  async createProduct(productData) {
    const payload = {
      name: productData.name.trim(),
      category: productData.category?.trim() || null,
      rate: parseFloat(productData.rate).toFixed(2),
      unit: productData.unit.trim(),
      description: productData.description?.trim() || null,
      image_url: productData.image_url || null,
      image_public_id: productData.image_public_id || null,
      is_active: productData.is_active ?? true,
    };
    const response = await api.post('/products', payload);
    return response.data;
  },

  /**
   * Update an existing product (Admin only).
   */
  async updateProduct(productId, productData) {
    const payload = {};
    if (productData.name !== undefined) payload.name = productData.name.trim();
    if (productData.category !== undefined) payload.category = productData.category?.trim() || null;
    if (productData.rate !== undefined) payload.rate = parseFloat(productData.rate).toFixed(2);
    if (productData.unit !== undefined) payload.unit = productData.unit.trim();
    if (productData.description !== undefined) payload.description = productData.description?.trim() || null;
    if (productData.image_url !== undefined) payload.image_url = productData.image_url;
    if (productData.image_public_id !== undefined) payload.image_public_id = productData.image_public_id;
    if (productData.is_active !== undefined) payload.is_active = productData.is_active;

    const response = await api.put(`/products/${productId}`, payload);
    return response.data;
  },

  /**
   * Upload product image via multipart/form-data (Admin only).
   * Uses React Native's native fetch to guarantee correct multipart boundary generation.
   */
  async uploadProductImage(fileUri) {
    const token = await storage.getToken();
    const uploadUrl = `${API_BASE_URL.replace(/\/+$/, '')}/products/upload-image`;

    const rawFilename = fileUri.split('/').pop()?.split('?')[0] || `product_${Date.now()}.jpg`;
    let ext = 'jpg';
    if (rawFilename.includes('.')) {
      ext = rawFilename.split('.').pop().toLowerCase();
    }
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = rawFilename.includes('.') ? rawFilename : `${rawFilename}.${ext}`;

    const formData = new FormData();

    if (Platform.OS === 'web') {
      try {
        const res = await fetch(fileUri);
        const blob = await res.blob();
        formData.append('file', blob, filename);
      } catch (blobErr) {
        console.warn('Fallback web blob fetch error:', blobErr);
        formData.append('file', { uri: fileUri, name: filename, type });
      }
    } else {
      // React Native Android/iOS native file upload
      formData.append('file', {
        uri: fileUri,
        name: filename,
        type: type,
      });
    }

    const headers = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // CRITICAL: DO NOT set 'Content-Type': 'multipart/form-data'!
    // In React Native, fetch and FormData automatically inject 'multipart/form-data; boundary=...'

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: headers,
    });

    if (!response.ok) {
      let errorMsg = `Upload failed (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' 
            ? errJson.detail 
            : JSON.stringify(errJson.detail);
        }
      } catch (e) {
        const text = await response.text().catch(() => '');
        if (text) errorMsg = text;
      }
      const error = new Error(errorMsg);
      error.friendlyMessage = errorMsg;
      error.status = response.status;
      throw error;
    }

    return await response.json();
  },

  /**
   * Delete a product (Admin only).
   */
  async deleteProduct(productId) {
    const response = await api.delete(`/products/${productId}`);
    return response.data;
  },
};
