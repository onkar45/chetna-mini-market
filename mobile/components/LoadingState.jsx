import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING } from '../constants/theme';

export default function LoadingState({ message }) {
  const { t } = useTranslation();
  const resolvedMessage = message || t('common.loading');

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>{resolvedMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  text: {
    marginTop: SPACING.md,
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
