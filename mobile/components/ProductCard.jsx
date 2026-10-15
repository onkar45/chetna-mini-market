import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { resolveImageUrl } from '../constants/config';
import { formatCurrency } from '../services/i18n';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { formatCategory, formatUnit } from './CategoryFilter';

export default function ProductCard({
  product,
  isAdmin = false,
  onPress,
  onEdit,
  onDelete,
}) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'mr';

  const formattedRate = formatCurrency(product.rate);

  const formattedDate = product.updated_at
    ? new Date(product.updated_at).toLocaleDateString(currentLang === 'mr' ? 'mr-IN' : 'en-IN', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const resolvedImage = resolveImageUrl(product.image_url);

  return (
    <TouchableOpacity
      style={[styles.card, !product.is_active && styles.cardInactive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardMain}>
        {/* Product Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {resolvedImage ? (
            <Image
              source={{ uri: resolvedImage }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <MaterialCommunityIcons name="shopping-outline" size={28} color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Content Info */}
        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>

            {isAdmin ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onEdit?.(product);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onDelete?.(product);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.badgeRow}>
            {product.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{formatCategory(product.category, t)}</Text>
              </View>
            ) : null}

            {!product.is_active ? (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>{t('products.inactive')}</Text>
              </View>
            ) : null}
          </View>

          {product.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {product.description}
            </Text>
          ) : null}

          {/* Pricing & Timestamp */}
          <View style={styles.footerRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.price}>{formattedRate}</Text>
              <Text style={styles.unit}> / {formatUnit(product.unit, t)}</Text>
            </View>

            {formattedDate ? (
              <Text style={styles.dateText}>{t('products.updated')} {formattedDate}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardInactive: {
    opacity: 0.75,
    backgroundColor: COLORS.background,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailContainer: {
    marginRight: SPACING.md,
  },
  thumbnail: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
  },
  thumbnailPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: SPACING.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
  },
  deleteButton: {
    backgroundColor: COLORS.dangerLight,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 3,
  },
  categoryBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  inactiveBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: SPACING.xs,
    paddingTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: 2,
  },
  price: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  unit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
