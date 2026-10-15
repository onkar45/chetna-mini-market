import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';
import AppLogo from '../components/AppLogo';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { API_BASE_URL } from '../constants/config';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  // Redirect to products if user is already authenticated
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/products');
    }
  }, [isLoading, isAuthenticated, router]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleLogin = async (loginUsername = username, loginPassword = password) => {
    if (!loginUsername.trim()) {
      setErrorMessage(t('auth.username_required'));
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMessage(t('auth.password_required'));
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(loginUsername.trim(), loginPassword);
      router.replace('/products');
    } catch (error) {
      setErrorMessage(error.friendlyMessage || t('auth.login_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrefillAdmin = () => {
    setUsername('admin');
    setPassword('AdminSecurePassword123!');
    setErrorMessage(null);
  };

  const handlePrefillUser = () => {
    setUsername('user');
    setPassword('UserSecurePassword123!');
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Language Selector at Top */}
          <View style={styles.langSelectorWrap}>
            <LanguageSelector />
          </View>

          {/* Header Branding */}
          <View style={styles.header}>
            <AppLogo size={96} style={styles.logoWrap} />
            <Text style={styles.title}>{t('app.name')}</Text>
            <Text style={styles.tagline}>{t('app.tagline')}</Text>
            <Text style={styles.subtitle}>{t('app.login_subtitle')}</Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Card */}
          <View style={styles.card}>
            {/* Username Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.username')}</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t('auth.username_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={t('auth.password_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => handleLogin()}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => handleLogin()}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth.sign_in')}</Text>
              )}
            </TouchableOpacity>

            {/* Quick Demo Fill Options */}
            <View style={styles.demoSection}>
              <Text style={styles.demoHeading}>{t('auth.quick_test_logins')}</Text>
              <View style={styles.demoRow}>
                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={handlePrefillAdmin}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="shield-account" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.demoButtonText}>{t('auth.fill_admin')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoButton, styles.demoButtonUser]}
                  onPress={handlePrefillUser}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="account" size={15} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.demoButtonText, styles.demoButtonUserText]}>{t('auth.fill_user')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Server Connection Info */}
          <View style={styles.serverInfo}>
            <MaterialCommunityIcons name="server-network" size={13} color={COLORS.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.serverInfoText}>{t('app.server_api', { url: API_BASE_URL })}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  langSelectorWrap: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoWrap: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginTop: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
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
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  demoHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  demoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  demoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  demoButtonUser: {
    backgroundColor: '#F1F5F9',
  },
  demoButtonUserText: {
    color: COLORS.textSecondary,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  serverInfoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
