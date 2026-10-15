import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const DEFAULT_CATEGORIES = [
  'All',
  'Grocery',
  'Dairy',
  'Grains',
  'Beverages',
  'Spices',
  'Snacks',
  'Personal Care',
  'Household',
];

export const CATEGORY_KEYS = {
  All: 'categories.all',
  Grocery: 'categories.grocery',
  Dairy: 'categories.dairy',
  Grains: 'categories.grains',
  Beverages: 'categories.beverages',
  Spices: 'categories.spices',
  Snacks: 'categories.snacks',
  'Personal Care': 'categories.personal_care',
  Household: 'categories.household',
};

export const formatCategory = (category, t) => {
  if (!category) return '';
  return CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category;
};

export const UNIT_KEYS = {
  kg: 'units.kg',
  gram: 'units.gram',
  litre: 'units.litre',
  ml: 'units.ml',
  packet: 'units.packet',
  piece: 'units.piece',
  box: 'units.box',
  bottle: 'units.bottle',
  dozen: 'units.dozen',
};

export const formatUnit = (unit, t) => {
  if (!unit) return '';
  const key = UNIT_KEYS[unit.toLowerCase()];
  return key ? t(key) : unit;
};

export default function CategoryFilter({
  selectedCategory = 'All',
  onSelectCategory,
  categories = DEFAULT_CATEGORIES,
}) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        const displayLabel = formatCategory(cat, t);

        return (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelectCategory(cat)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={displayLabel}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {displayLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
