import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * In-memory mock storage replicating expo-secure-store / storage service contract.
 */
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  async getToken() {
    return this.store.get('chetna_auth_token') || null;
  }
  async setToken(token) {
    this.store.set('chetna_auth_token', token);
  }
  async removeToken() {
    this.store.delete('chetna_auth_token');
  }
  async getUser() {
    const raw = this.store.get('chetna_user_data');
    return raw ? JSON.parse(raw) : null;
  }
  async setUser(user) {
    this.store.set('chetna_user_data', JSON.stringify(user));
  }
  async removeUser() {
    this.store.delete('chetna_user_data');
  }
  async clearAll() {
    await this.removeToken();
    await this.removeUser();
  }
  async getLanguage() {
    return this.store.get('chetna_language') || 'mr';
  }
  async setLanguage(lang) {
    this.store.set('chetna_language', lang);
  }
}

/**
 * Session restoration engine matching AuthContext state machine.
 */
class AuthSessionEngine {
  constructor(storage, apiService) {
    this.storage = storage;
    this.apiService = apiService;
    this.user = null;
    this.token = null;
    this.isLoading = true;
    this.isValidated = false;
    this.isOffline = false;
    this.authError = null;
    this.inFlightValidation = null;
  }

  get isAuthenticated() {
    return Boolean(this.token && this.user);
  }

  get isAdmin() {
    return this.user?.role === 'admin';
  }

  async validateSessionWithServer(token) {
    if (this.inFlightValidation) {
      return this.inFlightValidation;
    }
    const promise = (async () => {
      try {
        return await this.apiService.getMe(token);
      } finally {
        this.inFlightValidation = null;
      }
    })();
    this.inFlightValidation = promise;
    return promise;
  }

  async restoreSession() {
    this.isLoading = true;
    this.authError = null;

    try {
      const [storedToken, storedUser] = await Promise.all([
        this.storage.getToken(),
        this.storage.getUser(),
      ]);

      if (!storedToken) {
        if (storedUser) {
          await this.storage.removeUser();
        }
        this.user = null;
        this.token = null;
        this.isValidated = false;
        this.isOffline = false;
        this.isLoading = false;
        return;
      }

      // Fast restore cached session
      this.token = storedToken;
      if (storedUser) {
        this.user = storedUser;
      }

      // Validate with server
      try {
        const freshProfile = await this.validateSessionWithServer(storedToken);
        this.user = freshProfile;
        await this.storage.setUser(freshProfile);
        this.isValidated = true;
        this.isOffline = false;
        this.authError = null;
      } catch (err) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          await this.storage.clearAll();
          this.user = null;
          this.token = null;
          this.isValidated = false;
          this.isOffline = false;
        } else {
          this.isOffline = true;
          this.isValidated = false;
          if (!storedUser) {
            this.authError = err.friendlyMessage || 'Unable to connect to server.';
          }
        }
      }
    } catch (err) {
      await this.storage.clearAll();
      this.user = null;
      this.token = null;
      this.isValidated = false;
    } finally {
      this.isLoading = false;
    }
  }

  async login(username, password) {
    const result = await this.apiService.login(username, password);
    this.token = result.access_token;
    this.user = result.user;
    this.isValidated = true;
    this.isOffline = false;
    this.authError = null;
    await this.storage.setToken(result.access_token);
    await this.storage.setUser(result.user);
    return result.user;
  }

  async logout() {
    await this.storage.clearAll();
    this.user = null;
    this.token = null;
    this.isValidated = false;
    this.isOffline = false;
    this.authError = null;
  }

  async retrySessionValidation() {
    const currentToken = this.token || (await this.storage.getToken());
    if (!currentToken) {
      this.user = null;
      this.token = null;
      return;
    }
    try {
      const freshProfile = await this.validateSessionWithServer(currentToken);
      this.user = freshProfile;
      await this.storage.setUser(freshProfile);
      this.isValidated = true;
      this.isOffline = false;
      this.authError = null;
      return freshProfile;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        await this.storage.clearAll();
        this.user = null;
        this.token = null;
        this.isValidated = false;
        this.isOffline = false;
      } else {
        this.isOffline = true;
        this.authError = err.friendlyMessage || 'Connection failed.';
      }
      throw err;
    }
  }
}

describe('Phase 2 — Persistent Authentication & Session Restoration', () => {
  let mockStorage;
  let mockApi;
  let engine;

  beforeEach(() => {
    mockStorage = new MockStorage();
    mockApi = {
      calls: { getMe: 0, login: 0 },
      getMeResponse: null,
      getMeError: null,
      async getMe(token) {
        this.calls.getMe++;
        if (this.getMeError) throw this.getMeError;
        return this.getMeResponse;
      },
      async login(username, password) {
        this.calls.login++;
        return {
          access_token: 'valid_jwt_token_123',
          user: { id: 1, username, role: username === 'admin' ? 'admin' : 'user' },
        };
      },
    };
    engine = new AuthSessionEngine(mockStorage, mockApi);
  });

  it('1. Fresh install with no stored token initializes as logged out', async () => {
    assert.equal(engine.isLoading, true);
    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, false);
    assert.equal(engine.token, null);
    assert.equal(engine.user, null);
    assert.equal(engine.isValidated, false);
    assert.equal(mockApi.calls.getMe, 0);
  });

  it('2. Valid stored token and successful /auth/me restores verified session', async () => {
    const cachedUser = { id: 1, username: 'admin', role: 'admin' };
    await mockStorage.setToken('valid_jwt_abc');
    await mockStorage.setUser(cachedUser);

    mockApi.getMeResponse = { id: 1, username: 'admin', role: 'admin', verified: true };

    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, true);
    assert.equal(engine.isAdmin, true);
    assert.equal(engine.token, 'valid_jwt_abc');
    assert.equal(engine.isValidated, true);
    assert.equal(engine.isOffline, false);
    assert.equal(mockApi.calls.getMe, 1);

    const savedUser = await mockStorage.getUser();
    assert.equal(savedUser.verified, true);
  });

  it('3. App restart with a valid regular User session sets isAdmin to false', async () => {
    const regularUser = { id: 2, username: 'shopkeeper', role: 'user' };
    await mockStorage.setToken('user_jwt_456');
    await mockStorage.setUser(regularUser);

    mockApi.getMeResponse = regularUser;

    await engine.restoreSession();

    assert.equal(engine.isAuthenticated, true);
    assert.equal(engine.isAdmin, false);
    assert.equal(engine.user.username, 'shopkeeper');
  });

  it('4. HTTP 401 invalid or expired token cleans up session and logs out', async () => {
    await mockStorage.setToken('expired_token_789');
    await mockStorage.setUser({ id: 1, username: 'old_admin', role: 'admin' });

    mockApi.getMeError = { response: { status: 401, data: { detail: 'Token has expired' } } };

    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, false);
    assert.equal(engine.token, null);
    assert.equal(engine.user, null);
    assert.equal(engine.isValidated, false);

    assert.equal(await mockStorage.getToken(), null);
    assert.equal(await mockStorage.getUser(), null);
  });

  it('5. Network failure or timeout keeps token and cached user in offline mode', async () => {
    const cachedAdmin = { id: 1, username: 'admin', role: 'admin' };
    await mockStorage.setToken('token_network_fail');
    await mockStorage.setUser(cachedAdmin);

    // Network timeout / connection error has no response object or status is 0 / undefined
    mockApi.getMeError = new Error('Network timeout (30000ms)');

    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, true); // Provisional session active
    assert.equal(engine.token, 'token_network_fail');
    assert.equal(engine.user.username, 'admin');
    assert.equal(engine.isOffline, true);
    assert.equal(engine.isValidated, false);

    // Stored token must NOT be deleted
    assert.equal(await mockStorage.getToken(), 'token_network_fail');
  });

  it('6. HTTP 500 server error during startup does not wipe the stored session', async () => {
    await mockStorage.setToken('valid_token_500');
    await mockStorage.setUser({ id: 1, username: 'admin', role: 'admin' });

    mockApi.getMeError = { response: { status: 500, data: { detail: 'Internal Server Error' } } };

    await engine.restoreSession();

    assert.equal(engine.isAuthenticated, true);
    assert.equal(engine.isOffline, true);
    assert.equal(engine.token, 'valid_token_500');
    assert.equal(await mockStorage.getToken(), 'valid_token_500');
  });

  it('7. Token present but cached user absent with network failure sets authError with retry', async () => {
    await mockStorage.setToken('token_only');
    // No cached user
    mockApi.getMeError = new Error('Connection refused');

    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, false);
    assert.equal(engine.token, 'token_only'); // Token retained
    assert.notEqual(engine.authError, null);

    // When connection recovers, retrySessionValidation succeeds
    mockApi.getMeError = null;
    mockApi.getMeResponse = { id: 1, username: 'admin', role: 'admin' };

    await engine.retrySessionValidation();
    assert.equal(engine.isAuthenticated, true);
    assert.equal(engine.isValidated, true);
    assert.equal(engine.authError, null);
  });

  it('8. Cached user present but token absent purges stale user and marks logged out', async () => {
    // Inconsistent storage state: user data exists without token
    await mockStorage.setUser({ id: 99, username: 'ghost', role: 'user' });

    await engine.restoreSession();

    assert.equal(engine.isLoading, false);
    assert.equal(engine.isAuthenticated, false);
    assert.equal(engine.user, null);
    assert.equal(await mockStorage.getUser(), null);
  });

  it('9. Logout clears storage and resets in-memory state cleanly', async () => {
    await engine.login('admin', 'password123');
    assert.equal(engine.isAuthenticated, true);

    await engine.logout();

    assert.equal(engine.isAuthenticated, false);
    assert.equal(engine.token, null);
    assert.equal(engine.user, null);
    assert.equal(engine.isValidated, false);
    assert.equal(await mockStorage.getToken(), null);
    assert.equal(await mockStorage.getUser(), null);
  });

  it('10. Prevents duplicate /auth/me calls during concurrent validation calls', async () => {
    await mockStorage.setToken('dedup_token');
    mockApi.getMeResponse = { id: 1, username: 'admin', role: 'admin' };

    // Fire 3 simultaneous validations
    const [p1, p2, p3] = await Promise.all([
      engine.validateSessionWithServer('dedup_token'),
      engine.validateSessionWithServer('dedup_token'),
      engine.validateSessionWithServer('dedup_token'),
    ]);

    assert.deepEqual(p1, p2);
    assert.deepEqual(p2, p3);
    assert.equal(mockApi.calls.getMe, 1); // Exact single flight!
  });
});
