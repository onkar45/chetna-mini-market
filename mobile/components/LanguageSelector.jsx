import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { switchLanguage } from '../services/i18n';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'mr';

  const handleSelect = (lang) => {
    if (currentLang !== lang) {
      switchLanguage(lang);
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {!compact && (
        <View style={styles.labelRow}>
          <MaterialCommunityIcons name="translate" size={16} color={COLORS.textSecondary} />
          <Text style={styles.headerLabel}>{t('common.select_language')}</Text>
        </View>
      )}
      <View style={styles.toggleGroup}>
        <TouchableOpacity
          style={[styles.optionBtn, currentLang === 'mr' && styles.optionBtnActive]}
          onPress={() => handleSelect('mr')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, currentLang === 'mr' && styles.optionTextActive]}>
            मराठी
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionBtn, currentLang === 'en' && styles.optionBtnActive]}
          onPress={() => handleSelect('en')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionText, currentLang === 'en' && styles.optionTextActive]}>
            English
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: SPACING.xs,
  },
  containerCompact: {
    marginVertical: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    padding: 3,
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  optionBtnActive: {
    backgroundColor: COLORS.primaryDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
