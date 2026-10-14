import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { productsService } from '../services/products';
import { resolveImageUrl } from '../constants/config';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const COMMON_UNITS = ['kg', 'gram', 'litre', 'ml', 'packet', 'piece'];
const SUGGESTED_CATEGORIES = ['Grocery', 'Dairy', 'Grains', 'Beverages', 'Spices', 'Snacks'];

export default function ProductForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting = false,
  errorMessage = null,
}) {
  const { t } = useTranslation();

  const [name, setName] = useState(initialValues?.name || '');
  const [category, setCategory] = useState(initialValues?.category || '');
  const [rate, setRate] = useState(
    initialValues?.rate !== undefined ? String(initialValues.rate) : ''
  );
  const [unit, setUnit] = useState(initialValues?.unit || 'kg');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true);

  // Photo state
  const [imageUrl, setImageUrl] = useState(initialValues?.image_url || null);
  const [imagePublicId, setImagePublicId] = useState(initialValues?.image_public_id || null);
  const [localUri, setLocalUri] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = t('form.product_name_required');
    }

    if (!rate.trim()) {
      newErrors.rate = t('form.rate_required');
    } else {
      const parsedRate = parseFloat(rate);
      if (isNaN(parsedRate) || parsedRate < 0) {
        newErrors.rate = t('form.rate_invalid');
      }
    }

    if (!unit.trim()) {
      newErrors.unit = t('form.unit_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUploadPhoto = async (uri) => {
    setLocalUri(uri);
    setIsUploadingPhoto(true);
    setPhotoError(null);
    try {
      const data = await productsService.uploadProductImage(uri);
      setImageUrl(data.image_url);
      setImagePublicId(data.image_public_id);
    } catch (err) {
      console.warn('Upload photo error:', err);
      const msg = err.friendlyMessage || t('photo.upload_failed');
      setPhotoError(msg);
      Alert.alert(t('photo.label'), msg);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('photo.camera_permission_title'),
          t('photo.camera_permission_msg') + '\n\n' + t('photo.permission_denied')
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Camera launch failed:', err);
      Alert.alert(t('photo.label'), t('photo.upload_failed'));
    }
  };

  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('photo.gallery_permission_title'),
          t('photo.gallery_permission_msg') + '\n\n' + t('photo.permission_denied')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Gallery launch failed:', err);
      Alert.alert(t('photo.label'), t('photo.upload_failed'));
    }
  };

  const handleRemovePhoto = () => {
    setImageUrl(null);
    setImagePublicId(null);
    setLocalUri(null);
    setPhotoError(null);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    let finalImageUrl = imageUrl;
    let finalImagePublicId = imagePublicId;

    // If a photo was chosen but hasn't uploaded yet, attempt upload now
    if (localUri && !finalImageUrl) {
      setIsUploadingPhoto(true);
      try {
        const data = await productsService.uploadProductImage(localUri);
        finalImageUrl = data.image_url;
        finalImagePublicId = data.image_public_id;
        setImageUrl(data.image_url);
        setImagePublicId(data.image_public_id);
      } catch (err) {
        setIsUploadingPhoto(false);
        Alert.alert(t('photo.label'), err.friendlyMessage || t('photo.upload_failed'));
        return;
      }
      setIsUploadingPhoto(false);
    }

    onSubmit({
      name: name.trim(),
      category: category.trim() || null,
      rate: parseFloat(rate),
      unit: unit.trim(),
      description: description.trim() || null,
      image_url: finalImageUrl || null,
      image_public_id: finalImagePublicId || null,
      is_active: isActive,
    });
  };

  const resolvedPreviewUrl = localUri || resolveImageUrl(imageUrl);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Product Photo Section */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('photo.label')}</Text>

          {resolvedPreviewUrl ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: resolvedPreviewUrl }} style={styles.previewImage} resizeMode="cover" />
              {isUploadingPhoto && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.uploadingText}>{t('photo.uploading')}</Text>
                </View>
              )}
              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  style={[styles.photoActionButton, styles.retakeButton]}
                  onPress={handleTakePhoto}
                  disabled={isUploadingPhoto}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="camera-retake-outline" size={16} color={COLORS.primaryDark} style={{ marginRight: 4 }} />
                  <Text style={styles.retakeButtonText}>{t('photo.retake_photo')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoActionButton, styles.removePhotoButton]}
                  onPress={handleRemovePhoto}
                  disabled={isUploadingPhoto}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
                  <Text style={styles.removePhotoButtonText}>{t('photo.remove_photo')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoCaptureCard}>
              {isUploadingPhoto ? (
                <View style={styles.uploadingBox}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                  <Text style={styles.uploadingBoxText}>{t('photo.uploading')}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.photoPlaceholderIconWrap}>
                    <MaterialCommunityIcons name="camera-plus-outline" size={36} color={COLORS.primary} />
                  </View>
                  <View style={styles.photoButtonRow}>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={handleTakePhoto}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.captureButtonText}>{t('photo.take_photo')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.galleryButton}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="image-plus" size={18} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.galleryButtonText}>{t('photo.choose_gallery')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {photoError && (
            <View style={styles.photoErrorBox}>
              <Text style={styles.photoErrorText}>{photoError}</Text>
              {localUri && (
                <TouchableOpacity
                  style={styles.retryUploadBtn}
                  onPress={() => handleUploadPhoto(localUri)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="reload" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.retryUploadBtnText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Product Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('form.product_name')}</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
            }}
            placeholder={t('form.product_name_placeholder')}
            placeholderTextColor={COLORS.textMuted}
          />
          {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('form.category')}</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder={t('form.category_placeholder')}
            placeholderTextColor={COLORS.textMuted}
          />
          <View style={styles.chipsRow}>
            {SUGGESTED_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rate (Price) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('form.rate')}</Text>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              style={[styles.input, styles.priceInput, errors.rate && styles.inputError]}
              value={rate}
              onChangeText={(text) => {
                setRate(text);
                if (errors.rate) setErrors((prev) => ({ ...prev, rate: null }));
              }}
              placeholder={t('form.rate_placeholder')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          {errors.rate ? <Text style={styles.fieldError}>{errors.rate}</Text> : null}
        </View>

        {/* Unit */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('form.unit')}</Text>
          <TextInput
            style={[styles.input, errors.unit && styles.inputError]}
            value={unit}
            onChangeText={(text) => {
              setUnit(text);
              if (errors.unit) setErrors((prev) => ({ ...prev, unit: null }));
            }}
            placeholder={t('form.unit_placeholder')}
            placeholderTextColor={COLORS.textMuted}
          />
          <View style={styles.chipsRow}>
            {COMMON_UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.chip, unit === u && styles.chipActive]}
                onPress={() => {
                  setUnit(u);
                  if (errors.unit) setErrors((prev) => ({ ...prev, unit: null }));
                }}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.unit ? <Text style={styles.fieldError}>{errors.unit}</Text> : null}
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{t('form.description_optional')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('form.description_placeholder')}
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Active Status */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: SPACING.md }}>
            <Text style={styles.switchLabel}>{t('products.active_in_inventory')}</Text>
            <Text style={styles.switchHelp}>{t('products.active_help')}</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: '#CBD5E1', true: COLORS.primaryLight }}
            thumbColor={isActive ? COLORS.primary : '#94A3B8'}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          {onCancel ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isSubmitting || isUploadingPhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>{t('form.cancel')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isUploadingPhoto) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || isUploadingPhoto}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>{submitLabel || t('form.save_product')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  errorBanner: {
    backgroundColor: COLORS.dangerLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingLeft: SPACING.md,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
  },
  textArea: {
    height: 80,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  switchHelp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Photo Styles
  photoCaptureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: SPACING.md,
    alignItems: 'center',
  },
  photoPlaceholderIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  galleryButtonText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  previewContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F1F5F9',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    margin: SPACING.sm,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  photoActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  retakeButton: {
    backgroundColor: COLORS.primaryLight,
  },
  retakeButtonText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  removePhotoButton: {
    backgroundColor: COLORS.dangerLight,
  },
  removePhotoButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadingBox: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  uploadingBoxText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  photoErrorBox: {
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  photoErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  retryUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  retryUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
