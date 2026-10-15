import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

export default function AdminUsersScreen() {
  const router = useRouter();
  const { isAdmin, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'mr';

  // User List State
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState(null);

  // Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Authorization Guard: Only Admins can access this screen
  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!isAdmin) {
        Alert.alert(t('common.close'), t('users.access_denied'));
        router.replace('/products');
      }
    }
  }, [isAuthLoading, isAuthenticated, isAdmin, router, t]);

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoadingUsers(true);
    setListError(null);
    try {
      const data = await authService.getUsers();
      setUsers(data);
    } catch (err) {
      setListError(err.friendlyMessage || t('users.load_failed'));
    } finally {
      setIsLoadingUsers(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers(true);
  };

  const handleCreateUser = async () => {
    setFormError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setFormError(t('users.username_required'));
      return;
    }

    if (!password || password.length < 6) {
      setFormError(t('users.password_required'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('users.passwords_must_match'));
      return;
    }

    setIsSubmitting(true);
    try {
      const createdUser = await authService.createUser({
        username: cleanUsername,
        password,
        role,
      });

      // Clear sensitive form state immediately
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('user');
      setShowCreateForm(false);
      setSuccessMessage(t('users.user_created_success', { username: createdUser.username }));

      // Refresh users list
      fetchUsers(true);
    } catch (err) {
      const status = err.response ? err.response.status : null;
      if (status === 409) {
        setFormError(t('users.duplicate_username'));
      } else {
        setFormError(err.friendlyMessage || t('users.load_failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin && !isAuthLoading) {
    return null;
  }

  const locale = currentLang === 'mr' ? 'mr-IN' : 'en-IN';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('users.management_title')}</Text>
            <Text style={styles.headerSub}>{t('users.create_user_sub')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleFormBtn, showCreateForm && styles.toggleFormBtnActive]}
            onPress={() => {
              setShowCreateForm(!showCreateForm);
              setFormError(null);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={showCreateForm ? 'close' : 'account-plus'}
              size={18}
              color={showCreateForm ? COLORS.danger : COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Success Message Banner */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} style={{ marginRight: 6 }} />
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity onPress={() => setSuccessMessage(null)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <MaterialCommunityIcons name="close" size={16} color={COLORS.success} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Collapsible Create User Form Card */}
        {showCreateForm ? (
          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <MaterialCommunityIcons name="account-plus-outline" size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.formTitle}>{t('users.create_user_title')}</Text>
            </View>

            {formError ? (
              <View style={styles.formErrorBox}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('users.username')} *</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="account-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t('users.username_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('users.password')} *</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t('users.password_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('users.confirm_password')} *</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock-check-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t('users.confirm_password_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <MaterialCommunityIcons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Role Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('users.role')}</Text>
              <View style={styles.roleToggleGroup}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'user' && styles.roleOptionActive]}
                  onPress={() => setRole('user')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="account"
                    size={16}
                    color={role === 'user' ? '#FFFFFF' : COLORS.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.roleOptionText, role === 'user' && styles.roleOptionTextActive]}>
                    {t('users.role_user')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleOption, role === 'admin' && styles.roleOptionActiveAdmin]}
                  onPress={() => setRole('admin')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="shield-account"
                    size={16}
                    color={role === 'admin' ? '#FFFFFF' : COLORS.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.roleOptionText, role === 'admin' && styles.roleOptionTextActive]}>
                    {t('users.role_admin')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.formButtonRow}>
              <TouchableOpacity
                style={styles.cancelFormBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  setFormError(null);
                }}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelFormBtnText}>{t('form.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitFormBtn, isSubmitting && styles.buttonDisabled]}
                onPress={handleCreateUser}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitFormBtnText}>{t('users.create_btn')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* User Accounts List */}
        {isLoadingUsers ? (
          <LoadingState message={t('users.loading')} />
        ) : listError ? (
          <ErrorState message={listError} onRetry={() => fetchUsers()} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const isAdminRole = item.role === 'admin';
              const formattedDate = item.created_at
                ? new Date(item.created_at).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : t('common.na');

              return (
                <View style={styles.userCard}>
                  <View style={styles.userCardLeft}>
                    <View style={[styles.avatarCircle, isAdminRole ? styles.avatarAdmin : styles.avatarUser]}>
                      <MaterialCommunityIcons
                        name={isAdminRole ? 'shield-account' : 'account'}
                        size={22}
                        color={isAdminRole ? COLORS.primary : COLORS.textSecondary}
                      />
                    </View>
                    <View>
                      <Text style={styles.cardUsername}>{item.username}</Text>
                      <View style={styles.badgesRow}>
                        <View style={[styles.roleBadge, isAdminRole ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
                          <Text style={[styles.roleBadgeText, isAdminRole ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>
                            {isAdminRole ? t('app.tag_admin') : t('app.tag_user')}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                          <Text style={[styles.statusBadgeText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                            {item.is_active ? t('users.active') : t('users.inactive')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userCardRight}>
                    <Text style={styles.dateLabel}>{t('users.created_at')}</Text>
                    <Text style={styles.dateValue}>{formattedDate}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title={t('users.no_users')}
                subtitle={t('users.no_users_sub')}
                actionLabel={t('users.create_user')}
                onAction={() => setShowCreateForm(true)}
              />
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: {
    padding: 6,
    borderRadius: RADIUS.full,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  toggleFormBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleFormBtnActive: {
    backgroundColor: COLORS.dangerLight,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BEE7D1',
  },
  successText: {
    flex: 1,
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  formErrorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 44,
  },
  inputIcon: {
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  roleToggleGroup: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  roleOptionActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  roleOptionActiveAdmin: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelFormBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelFormBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  submitFormBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  submitFormBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAdmin: {
    backgroundColor: COLORS.primaryLight,
  },
  avatarUser: {
    backgroundColor: '#F1F5F9',
  },
  cardUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  roleBadgeAdmin: {
    backgroundColor: COLORS.primaryLight,
  },
  roleBadgeUser: {
    backgroundColor: '#E2E8F0',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleBadgeTextAdmin: {
    color: COLORS.primaryDark,
  },
  roleBadgeTextUser: {
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  statusActive: {
    backgroundColor: COLORS.successLight,
  },
  statusInactive: {
    backgroundColor: COLORS.dangerLight,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: COLORS.success,
  },
  statusTextInactive: {
    color: COLORS.danger,
  },
  userCardRight: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
});
