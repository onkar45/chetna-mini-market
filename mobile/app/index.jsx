import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export default function IndexScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, authError, retrySessionValidation, logout } = useAuth();
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/products');
      } else if (!authError) {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated, authError, router]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retrySessionValidation();
    } catch (e) {
      // Error is caught and surfaced in AuthContext
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGoToLogin = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <AppLogo size={108} style={styles.logoWrap} />
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      {authError && !isAuthenticated ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={COLORS.danger} style={{ marginBottom: 8 }} />
          <Text style={styles.errorTitle}>{t('common.connection_timeout')}</Text>
          <Text style={styles.errorDescription}>{authError}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={isRetrying}
            activeOpacity={0.8}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="reload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginFallbackButton}
            onPress={handleGoToLogin}
            activeOpacity={0.7}
          >
            <Text style={styles.loginFallbackText}>{t('common.login_other_account')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('products.loading')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 1.5,
  },
  logoWrap: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },
  loaderContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  errorDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    width: '100%',
    marginBottom: SPACING.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  loginFallbackButton: {
    paddingVertical: 6,
  },
  loginFallbackText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
