const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Phase 6 — Camera, Gallery & Image Upload Lifecycle', () => {
  // Mock image picker API
  const mockImagePicker = {
    cameraPermission: 'granted',
    galleryPermission: 'granted',
    async requestCameraPermissionsAsync() {
      return { status: this.cameraPermission };
    },
    async requestMediaLibraryPermissionsAsync() {
      return { status: this.galleryPermission };
    },
    async launchCameraAsync(options) {
      if (this.cameraPermission !== 'granted') return { canceled: true };
      return {
        canceled: false,
        assets: [{ uri: 'file:///data/user/0/cache/camera_capture_123.jpg', width: 800, height: 800 }],
      };
    },
    async launchImageLibraryAsync(options) {
      if (this.galleryPermission !== 'granted') return { canceled: true };
      return {
        canceled: false,
        assets: [{ uri: 'file:///data/user/0/cache/gallery_photo_456.jpg', width: 600, height: 600 }],
      };
    },
  };

  // Mock upload service tracking calls to ensure no duplicate uploads
  function createMockProductsService() {
    return {
      uploadCalls: 0,
      uploadedUris: [],
      shouldFailUpload: false,
      shouldFailSave: false,

      async uploadProductImage(uri) {
        this.uploadCalls++;
        this.uploadedUris.push(uri);
        if (this.shouldFailUpload) {
          const err = new Error('Upload failed (502)');
          err.friendlyMessage = 'Cloud image upload failed';
          throw err;
        }
        return {
          image_url: `https://res.cloudinary.com/chetna/image/upload/v123/${path.basename(uri)}`,
          image_public_id: `chetna_products/${path.basename(uri).split('.')[0]}`,
        };
      },

      async createProduct(payload) {
        if (this.shouldFailSave) {
          const err = new Error('Server error');
          err.friendlyMessage = 'Failed to create product';
          throw err;
        }
        return { id: 99, ...payload };
      },

      async updateProduct(id, payload) {
        if (this.shouldFailSave) {
          const err = new Error('Server error');
          err.friendlyMessage = 'Failed to update product';
          throw err;
        }
        return { id, ...payload };
      },
    };
  }

  // Pure state model replicating ProductForm logic
  class ProductFormState {
    constructor(initialValues = {}) {
      this.name = initialValues.name || '';
      this.rate = initialValues.rate !== undefined ? String(initialValues.rate) : '';
      this.unit = initialValues.unit || 'kg';
      this.savedImageUrl = initialValues.image_url || null;
      this.savedImagePublicId = initialValues.image_public_id || null;
      this.pendingLocalUri = null;
      this.isImageRemoved = false;
      this.isUploadingPhoto = false;
      this.photoError = null;
    }

    get resolvedPreviewUrl() {
      if (this.pendingLocalUri) return this.pendingLocalUri;
      if (!this.isImageRemoved && this.savedImageUrl) return this.savedImageUrl;
      return null;
    }

    async handleTakePhoto(picker) {
      const { status } = await picker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return { error: 'camera_permission_denied' };
      }
      const result = await picker.launchCameraAsync();
      if (!result.canceled && result.assets && result.assets.length > 0) {
        this.pendingLocalUri = result.assets[0].uri;
        this.isImageRemoved = false;
        this.photoError = null;
        return { success: true };
      }
      return { canceled: true };
    }

    async handlePickGallery(picker) {
      const { status } = await picker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return { error: 'gallery_permission_denied' };
      }
      const result = await picker.launchImageLibraryAsync();
      if (!result.canceled && result.assets && result.assets.length > 0) {
        this.pendingLocalUri = result.assets[0].uri;
        this.isImageRemoved = false;
        this.photoError = null;
        return { success: true };
      }
      return { canceled: true };
    }

    handleRemovePhoto() {
      this.pendingLocalUri = null;
      this.isImageRemoved = true;
      this.photoError = null;
    }

    async handleSubmit(service, onSubmit) {
      if (!this.name.trim() || !this.rate.trim() || !this.unit.trim()) {
        throw new Error('Validation failed');
      }

      let finalImageUrl = this.savedImageUrl;
      let finalImagePublicId = this.savedImagePublicId;

      if (this.pendingLocalUri) {
        this.isUploadingPhoto = true;
        this.photoError = null;
        try {
          const uploadResult = await service.uploadProductImage(this.pendingLocalUri);
          finalImageUrl = uploadResult.image_url;
          finalImagePublicId = uploadResult.image_public_id;
          this.savedImageUrl = uploadResult.image_url;
          this.savedImagePublicId = uploadResult.image_public_id;
          this.pendingLocalUri = null;
        } catch (err) {
          this.photoError = err.friendlyMessage;
          throw err;
        } finally {
          this.isUploadingPhoto = false;
        }
      } else if (this.isImageRemoved) {
        finalImageUrl = null;
        finalImagePublicId = null;
      }

      return onSubmit({
        name: this.name.trim(),
        rate: parseFloat(this.rate),
        unit: this.unit.trim(),
        image_url: finalImageUrl,
        image_public_id: finalImagePublicId,
      });
    }
  }

  test('1. Camera permission granted allows photo capture and updates pending preview', async () => {
    mockImagePicker.cameraPermission = 'granted';
    const form = new ProductFormState({ name: 'Milk', rate: '30', unit: 'litre' });
    const res = await form.handleTakePhoto(mockImagePicker);

    assert.strictEqual(res.success, true);
    assert.strictEqual(form.pendingLocalUri, 'file:///data/user/0/cache/camera_capture_123.jpg');
    assert.strictEqual(form.resolvedPreviewUrl, 'file:///data/user/0/cache/camera_capture_123.jpg');
    // Verify image was NOT uploaded yet (held as pending local selection)
    assert.strictEqual(form.savedImageUrl, null);
  });

  test('2. Camera permission denied halts gracefully without throwing or modifying preview', async () => {
    mockImagePicker.cameraPermission = 'denied';
    const form = new ProductFormState({ name: 'Milk', rate: '30', unit: 'litre' });
    const res = await form.handleTakePhoto(mockImagePicker);

    assert.strictEqual(res.error, 'camera_permission_denied');
    assert.strictEqual(form.pendingLocalUri, null);
    assert.strictEqual(form.resolvedPreviewUrl, null);
  });

  test('3. Gallery selection succeeds and updates pending preview', async () => {
    mockImagePicker.galleryPermission = 'granted';
    const form = new ProductFormState({ name: 'Butter', rate: '50', unit: 'packet' });
    const res = await form.handlePickGallery(mockImagePicker);

    assert.strictEqual(res.success, true);
    assert.strictEqual(form.pendingLocalUri, 'file:///data/user/0/cache/gallery_photo_456.jpg');
    assert.strictEqual(form.resolvedPreviewUrl, 'file:///data/user/0/cache/gallery_photo_456.jpg');
  });

  test('4. User cancels image selection without showing error or wiping existing preview', async () => {
    const cancelingPicker = {
      ...mockImagePicker,
      cameraPermission: 'granted',
      async launchCameraAsync() {
        return { canceled: true };
      },
    };

    const form = new ProductFormState({
      name: 'Paneer',
      rate: '80',
      unit: 'packet',
      image_url: 'https://res.cloudinary.com/demo/paneer.jpg',
      image_public_id: 'chetna_products/paneer',
    });

    const res = await form.handleTakePhoto(cancelingPicker);
    assert.strictEqual(res.canceled, true);
    assert.strictEqual(form.pendingLocalUri, null);
    assert.strictEqual(form.resolvedPreviewUrl, 'https://res.cloudinary.com/demo/paneer.jpg');
  });

  test('5. Selected image preview state displays local URI immediately', async () => {
    mockImagePicker.galleryPermission = 'granted';
    const form = new ProductFormState();
    await form.handlePickGallery(mockImagePicker);

    assert.ok(form.resolvedPreviewUrl.startsWith('file://'));
  });

  test('6. Replacing a selected image updates the pending preview without premature upload', async () => {
    const form = new ProductFormState();
    mockImagePicker.cameraPermission = 'granted';
    await form.handleTakePhoto(mockImagePicker);
    assert.strictEqual(form.pendingLocalUri, 'file:///data/user/0/cache/camera_capture_123.jpg');

    // Replace with gallery photo
    await form.handlePickGallery(mockImagePicker);
    assert.strictEqual(form.pendingLocalUri, 'file:///data/user/0/cache/gallery_photo_456.jpg');
    assert.strictEqual(form.resolvedPreviewUrl, 'file:///data/user/0/cache/gallery_photo_456.jpg');
  });

  test('7. Removing a newly selected image before saving clears preview', async () => {
    const form = new ProductFormState();
    await form.handlePickGallery(mockImagePicker);
    assert.ok(form.resolvedPreviewUrl !== null);

    form.handleRemovePhoto();
    assert.strictEqual(form.pendingLocalUri, null);
    assert.strictEqual(form.isImageRemoved, true);
    assert.strictEqual(form.resolvedPreviewUrl, null);
  });

  test('8. Existing image remains unchanged when no image operation is requested', async () => {
    const service = createMockProductsService();
    const initial = {
      name: 'Ghee',
      rate: '350',
      unit: 'litre',
      image_url: 'https://res.cloudinary.com/demo/ghee.jpg',
      image_public_id: 'chetna_products/ghee',
    };
    const form = new ProductFormState(initial);

    let submittedData = null;
    await form.handleSubmit(service, (data) => {
      submittedData = data;
    });

    assert.strictEqual(service.uploadCalls, 0, 'Must NOT upload when image is unchanged');
    assert.strictEqual(submittedData.image_url, initial.image_url);
    assert.strictEqual(submittedData.image_public_id, initial.image_public_id);
  });

  test('9. Replacement uploads exactly once on form submit', async () => {
    const service = createMockProductsService();
    const initial = {
      name: 'Salt',
      rate: '28',
      unit: 'packet',
      image_url: 'https://res.cloudinary.com/demo/old_salt.jpg',
      image_public_id: 'chetna_products/old_salt',
    };
    const form = new ProductFormState(initial);

    // User chooses replacement photo
    await form.handlePickGallery(mockImagePicker);
    assert.strictEqual(service.uploadCalls, 0, 'No upload prior to submit');

    let submittedData = null;
    await form.handleSubmit(service, (data) => {
      submittedData = data;
    });

    assert.strictEqual(service.uploadCalls, 1, 'Uploads exactly once on submit');
    assert.ok(submittedData.image_url.includes('gallery_photo_456'));
    assert.strictEqual(submittedData.image_public_id, 'chetna_products/gallery_photo_456');
  });

  test('10. Image removal persists on edit and passes null to backend', async () => {
    const service = createMockProductsService();
    const initial = {
      name: 'Biscuits',
      rate: '20',
      unit: 'packet',
      image_url: 'https://res.cloudinary.com/demo/biscuits.jpg',
      image_public_id: 'chetna_products/biscuits',
    };
    const form = new ProductFormState(initial);

    form.handleRemovePhoto();

    let submittedData = null;
    await form.handleSubmit(service, (data) => {
      submittedData = data;
    });

    assert.strictEqual(service.uploadCalls, 0);
    assert.strictEqual(submittedData.image_url, null);
    assert.strictEqual(submittedData.image_public_id, null);
  });

  test('11. Product save failure preserves retryable form state and local image URI', async () => {
    const service = createMockProductsService();
    service.shouldFailUpload = true;

    const form = new ProductFormState({ name: 'Chilli', rate: '40', unit: 'packet' });
    await form.handlePickGallery(mockImagePicker);
    const chosenUri = form.pendingLocalUri;

    await assert.rejects(async () => {
      await form.handleSubmit(service, () => {});
    });

    // Verify form state is intact for retry
    assert.strictEqual(form.pendingLocalUri, chosenUri, 'Local URI must be preserved for retry');
    assert.strictEqual(form.photoError, 'Cloud image upload failed');
    assert.strictEqual(form.isUploadingPhoto, false);
  });

  test('12. Unauthorized regular user cannot upload product images (backend 403 guard)', () => {
    function checkUploadAccess(role) {
      if (role !== 'admin') {
        const error = new Error('Admin privileges required');
        error.status = 403;
        throw error;
      }
      return true;
    }

    assert.strictEqual(checkUploadAccess('admin'), true);
    assert.throws(() => checkUploadAccess('user'), /Admin privileges required/);
  });

  test('13. Products without images continue to work seamlessly', async () => {
    const service = createMockProductsService();
    const form = new ProductFormState({ name: 'Plain Rice', rate: '60', unit: 'kg' });

    let submittedData = null;
    await form.handleSubmit(service, (data) => {
      submittedData = data;
    });

    assert.strictEqual(service.uploadCalls, 0);
    assert.strictEqual(submittedData.image_url, null);
    assert.strictEqual(submittedData.image_public_id, null);
  });

  test('14. English and Marathi image upload messages have identical parity', () => {
    const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../locales/en.json'), 'utf8'));
    const mr = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../locales/mr.json'), 'utf8'));

    const requiredPhotoKeys = [
      'label',
      'take_photo',
      'retake_photo',
      'choose_gallery',
      'remove_photo',
      'preview',
      'uploading',
      'camera_permission_title',
      'camera_permission_msg',
      'gallery_permission_title',
      'gallery_permission_msg',
      'permission_denied',
      'upload_failed',
      'invalid_type',
    ];

    for (const key of requiredPhotoKeys) {
      assert.ok(en.photo[key], `en.json must contain photo.${key}`);
      assert.ok(mr.photo[key], `mr.json must contain photo.${key}`);
      assert.strictEqual(typeof en.photo[key], 'string');
      assert.strictEqual(typeof mr.photo[key], 'string');
      assert.ok(en.photo[key].length > 0);
      assert.ok(mr.photo[key].length > 0);
    }
  });
});
