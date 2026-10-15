import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { productsService } from '../../services/products';
import { resolveImageUrl } from '../../constants/config';
import { formatCurrency } from '../../services/i18n';
import LoadingState from '../../components/LoadingState';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatCategory, formatUnit } from '../../components/CategoryFilter';
import AppLogo from '../../components/AppLogo';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'mr';

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await productsService.getProductById(id);
      setProduct(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setErrorMessage(t('products.not_found_message'));
      } else {
        setErrorMessage(err.friendlyMessage || t('products.load_failed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleDelete = async () => {
    try {
      await productsService.deleteProduct(id);
      setDeleteDialogVisible(false);
      router.replace('/products');
    } catch (err) {
      alert(err.friendlyMessage || t('products.delete_failed'));
    }
  };

  if (isLoading) {
    return <LoadingState message={t('products.loading_details')} />;
  }

  if (errorMessage || !product) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title={t('products.product_unavailable')}
          message={errorMessage || t('products.not_found_message')}
          onRetry={fetchProduct}
        />
      </View>
    );
  }

  const formattedRate = formatCurrency(product.rate);
  const locale = currentLang === 'mr' ? 'mr-IN' : 'en-IN';

  const formattedUpdatedDate = product.updated_at
    ? new Date(product.updated_at).toLocaleString(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('common.na');

  const formattedCreatedDate = product.created_at
    ? new Date(product.created_at).toLocaleDateString(locale, {
        dateStyle: 'medium',
      })
    : t('common.na');

  const resolvedImage = resolveImageUrl(product.image_url);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Product Image Banner */}
      <View style={styles.imageCard}>
        {resolvedImage ? (
          <Image
            source={{ uri: resolvedImage }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderBanner}>
            <AppLogo size={64} style={{ marginBottom: SPACING.xs }} />
            <Text style={styles.placeholderText}>{t('app.name')}</Text>
          </View>
        )}
      </View>

      {/* Main Details Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{product.name}</Text>
          <View style={styles.badgeRow}>
            {product.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{formatCategory(product.category, t)}</Text>
              </View>
            ) : null}

            <View style={[styles.statusBadge, product.is_active ? styles.activeBadge : styles.inactiveBadge]}>
              <Text style={[styles.statusBadgeText, product.is_active ? styles.activeText : styles.inactiveText]}>
                {product.is_active ? t('products.active') : t('products.inactive')}
              </Text>
            </View>
          </View>
        </View>

        {/* Rate Display */}
        <View style={styles.rateBox}>
          <Text style={styles.rateLabel}>{t('products.selling_price')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.rateValue}>{formattedRate}</Text>
            <Text style={styles.unitText}> / {formatUnit(product.unit, t)}</Text>
          </View>
        </View>

        {/* Description Section */}
        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('products.description')}</Text>
            <Text style={styles.descriptionText}>{product.description}</Text>
          </View>
        ) : null}

        {/* Metadata Timestamps */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.metaLabel}>{t('products.last_updated')}</Text>
            <Text style={styles.metaValue}>{formattedUpdatedDate}</Text>
          </View>

          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="calendar-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.metaLabel}>{t('products.added_on')}</Text>
            <Text style={styles.metaValue}>{formattedCreatedDate}</Text>
          </View>
        </View>
      </View>

      {/* Admin Action Buttons */}
      {isAdmin ? (
        <View style={styles.adminActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/products/edit/${product.id}`)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.editButtonText}>{t('products.edit_rate')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setDeleteDialogVisible(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.deleteButtonText}>{t('products.delete_product')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        visible={deleteDialogVisible}
        title={t('products.delete_confirm_title')}
        message={t('products.delete_confirm_message', { name: product.name })}
        confirmLabel={t('form.delete')}
        cancelLabel={t('form.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogVisible(false)}
        isDestructive={true}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  imageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#F1F5F9',
  },
  placeholderBanner: {
    width: '100%',
    height: 150,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: SPACING.lg,
  },
  headerRow: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  categoryBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  activeBadge: {
    backgroundColor: COLORS.successLight,
  },
  inactiveBadge: {
    backgroundColor: COLORS.border,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: COLORS.success,
  },
  inactiveText: {
    color: COLORS.textSecondary,
  },
  rateBox: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  rateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginRight: 2,
  },
  rateValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  unitText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  metaSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  adminActions: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
