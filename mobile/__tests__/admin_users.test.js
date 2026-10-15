import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mobile Form Validation and Submission Engine for Admin User Management
 */
class AdminUserFormEngine {
  constructor(authService, currentUser) {
    this.authService = authService;
    this.currentUser = currentUser; // { username, role }
    this.username = '';
    this.password = '';
    this.confirmPassword = '';
    this.role = 'user';
    this.formError = null;
    this.successMessage = null;
    this.isSubmitting = false;
  }

  get isAuthorized() {
    return this.currentUser?.role === 'admin';
  }

  validate() {
    this.formError = null;
    const cleanUsername = this.username.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      this.formError = 'Username is required (minimum 3 characters).';
      return false;
    }

    if (!this.password || this.password.length < 6) {
      this.formError = 'Password is required (minimum 6 characters).';
      return false;
    }

    if (this.password !== this.confirmPassword) {
      this.formError = 'Passwords do not match.';
      return false;
    }

    return true;
  }

  async submit() {
    if (!this.isAuthorized) {
      this.formError = 'Access Denied: Only administrators can access User Management.';
      throw new Error('Access Denied');
    }

    if (!this.validate()) {
      return false;
    }

    this.isSubmitting = true;
    try {
      const created = await this.authService.createUser({
        username: this.username.trim(),
        password: this.password,
        role: this.role,
      });

      // Clear sensitive form state after success
      this.username = '';
      this.password = '';
      this.confirmPassword = '';
      this.role = 'user';
      this.successMessage = `User account '${created.username}' created successfully.`;
      return created;
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        this.formError = 'Username already exists. Please choose a different username.';
      } else if (status === 403) {
        this.formError = 'Access Denied: Only administrators can access User Management.';
      } else {
        this.formError = err.friendlyMessage || 'Failed to create user.';
      }
      throw err;
    } finally {
      this.isSubmitting = false;
    }
  }
}

describe('Phase 3 — Mobile Admin User Management', () => {
  let mockAuthService;
  let adminUser;
  let regularUser;

  beforeEach(() => {
    adminUser = { id: 1, username: 'admin_store', role: 'admin' };
    regularUser = { id: 2, username: 'cashier_one', role: 'user' };

    mockAuthService = {
      usersDb: [
        { id: 1, username: 'admin_store', role: 'admin', is_active: true, created_at: new Date().toISOString() },
        { id: 2, username: 'cashier_one', role: 'user', is_active: true, created_at: new Date().toISOString() },
      ],
      async createUser(data) {
        if (this.usersDb.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
          const err = new Error('Username already exists');
          err.response = { status: 409, data: { detail: 'Username already exists.' } };
          throw err;
        }
        const newUser = {
          id: this.usersDb.length + 1,
          username: data.username,
          role: data.role || 'user',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        this.usersDb.push(newUser);
        return newUser;
      },
      async getUsers() {
        return this.usersDb.map((u) => ({ ...u }));
      },
    };
  });

  it('1. Role-based authorization: Admin is authorized, regular User is denied', () => {
    const adminEngine = new AdminUserFormEngine(mockAuthService, adminUser);
    const userEngine = new AdminUserFormEngine(mockAuthService, regularUser);

    assert.equal(adminEngine.isAuthorized, true);
    assert.equal(userEngine.isAuthorized, false);
  });

  it('2. Form validation: rejects username with fewer than 3 characters', () => {
    const engine = new AdminUserFormEngine(mockAuthService, adminUser);
    engine.username = 'ab';
    engine.password = 'password123';
    engine.confirmPassword = 'password123';

    const isValid = engine.validate();
    assert.equal(isValid, false);
    assert.equal(engine.formError, 'Username is required (minimum 3 characters).');
  });

  it('3. Form validation: rejects password with fewer than 6 characters', () => {
    const engine = new AdminUserFormEngine(mockAuthService, adminUser);
    engine.username = 'new_clerk';
    engine.password = '12345';
    engine.confirmPassword = '12345';

    const isValid = engine.validate();
    assert.equal(isValid, false);
    assert.equal(engine.formError, 'Password is required (minimum 6 characters).');
  });

  it('4. Form validation: rejects mismatched password confirmation', () => {
    const engine = new AdminUserFormEngine(mockAuthService, adminUser);
    engine.username = 'new_clerk';
    engine.password = 'ValidPassword123!';
    engine.confirmPassword = 'DifferentPassword456!';

    const isValid = engine.validate();
    assert.equal(isValid, false);
    assert.equal(engine.formError, 'Passwords do not match.');
  });

  it('5. Successful creation: creates user, clears sensitive fields, sets success banner', async () => {
    const engine = new AdminUserFormEngine(mockAuthService, adminUser);
    engine.username = 'clerk_maya';
    engine.password = 'MayaPass123!';
    engine.confirmPassword = 'MayaPass123!';
    engine.role = 'user';

    const created = await engine.submit();
    assert.equal(created.username, 'clerk_maya');
    assert.equal(created.role, 'user');
    assert.equal(created.is_active, true);

    // Verify sensitive form fields were reset
    assert.equal(engine.username, '');
    assert.equal(engine.password, '');
    assert.equal(engine.confirmPassword, '');
    assert.equal(engine.successMessage, "User account 'clerk_maya' created successfully.");
    assert.equal(engine.formError, null);
  });

  it('6. Duplicate username: surfaces friendly conflict error message', async () => {
    const engine = new AdminUserFormEngine(mockAuthService, adminUser);
    engine.username = 'cashier_one'; // already exists in mock db
    engine.password = 'SomePassword123!';
    engine.confirmPassword = 'SomePassword123!';

    await assert.rejects(async () => {
      await engine.submit();
    }, /Username already exists/);

    assert.equal(
      engine.formError,
      'Username already exists. Please choose a different username.'
    );
  });

  it('7. Unprivileged user submission attempt is blocked with 403 error', async () => {
    const engine = new AdminUserFormEngine(mockAuthService, regularUser);
    engine.username = 'should_fail';
    engine.password = 'Password123!';
    engine.confirmPassword = 'Password123!';

    await assert.rejects(async () => {
      await engine.submit();
    }, /Access Denied/);

    assert.equal(
      engine.formError,
      'Access Denied: Only administrators can access User Management.'
    );
  });

  it('8. User listing: lists accounts without exposing password hashes', async () => {
    const users = await mockAuthService.getUsers();
    assert.equal(users.length >= 2, true);

    for (const u of users) {
      assert.equal('password' in u, false);
      assert.equal('hashed_password' in u, false);
      assert.notEqual(u.username, undefined);
      assert.notEqual(u.role, undefined);
      assert.notEqual(u.is_active, undefined);
    }
  });
});
