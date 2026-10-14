import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { productsService } from '../../services/products';
import ProductCard from '../../components/ProductCard';
import SearchBar from '../../components/SearchBar';
import CategoryFilter from '../../components/CategoryFilter';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import LanguageSelector from '../../components/LanguageSelector';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export default function ProductListScreen() {
  const router = useRouter();
  const { user, isAdmin, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Deletion Confirmation State
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Logout Confirmation State
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  // Auth Guard: if logged out, redirect to /login immediately
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await productsService.getProducts({
        search: searchQuery,
        category: selectedCategory,
      });
      setProducts(data);
    } catch (err) {
      setErrorMessage(err.friendlyMessage || t('products.load_failed'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedCategory, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProducts(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await productsService.deleteProduct(productToDelete.id);
      setDeleteDialogVisible(false);
      setProductToDelete(null);
      fetchProducts(true);
    } catch (err) {
      alert(err.friendlyMessage || t('products.delete_failed'));
    }
  };

  const handleExecuteLogout = async () => {
    setLogoutDialogVisible(false);
    await logout();
    router.replace('/login');
  };

  const categories = useMemo(() => {
    const defaultCats = ['All', 'Grocery', 'Dairy', 'Grains', 'Beverages', 'Spices', 'Snacks'];
    const dynamicCats = products
      .map((p) => p.category)
      .filter((cat) => Boolean(cat) && !defaultCats.includes(cat));
    return [...defaultCats, ...new Set(dynamicCats)];
  }, [products]);

  const roleTagLabel = isAdmin ? t('app.tag_admin') : t('app.tag_user');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.storeBranding}>
            <View style={styles.storeIconWrap}>
              <MaterialCommunityIcons name="storefront" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.storeTitle}>{t('app.name')}</Text>
              <Text style={styles.storeTagline}>{t('app.tagline')}</Text>
            </View>
          </View>

          <View style={styles.userControls}>
            <LanguageSelector compact={true} />

            <View style={styles.userBadge}>
              <Text style={styles.usernameText} numberOfLines={1}>{user?.username || 'User'}</Text>
              <View style={[styles.roleTag, isAdmin ? styles.roleTagAdmin : styles.roleTagUser]}>
                <Text style={styles.roleTagText}>{roleTagLabel}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setLogoutDialogVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="logout" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder={t('products.search_placeholder')}
        />
      </View>

      {/* Category Pills Bar */}
      <View style={styles.categoryContainer}>
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </View>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState message={t('products.loading')} />
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={() => fetchProducts()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              isAdmin={isAdmin}
              onPress={() => router.push(`/products/${item.id}`)}
              onEdit={(prod) => router.push(`/products/edit/${prod.id}`)}
              onDelete={(prod) => {
                setProductToDelete(prod);
                setDeleteDialogVisible(true);
              }}
            />
          )}
          contentContainerStyle={products.length === 0 ? styles.emptyContainer : styles.listContent}
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
              title={searchQuery || selectedCategory !== 'All' ? t('products.no_matching') : t('products.no_products')}
              subtitle={
                searchQuery || selectedCategory !== 'All'
                  ? t('products.no_matching_sub')
                  : isAdmin
                  ? t('products.no_products_admin_sub')
                  : t('products.no_products_user_sub')
              }
              actionLabel={searchQuery || selectedCategory !== 'All' ? t('products.reset_filters') : null}
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
            />
          }
        />
      )}

      {/* Floating Add Product Button (Admin Only) */}
      {isAdmin ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/products/add')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>{t('products.add_product')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        visible={deleteDialogVisible}
        title={t('products.delete_confirm_title')}
        message={t('products.delete_confirm_message', { name: productToDelete?.name })}
        confirmLabel={t('form.delete')}
        cancelLabel={t('form.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogVisible(false)}
        isDestructive={true}
      />

      {/* Logout Confirmation Modal */}
      <ConfirmDialog
        visible={logoutDialogVisible}
        title={t('auth.logout_confirm_title')}
        message={t('auth.logout_confirm_message')}
        confirmLabel={t('auth.logout')}
        cancelLabel={t('form.cancel')}
        onConfirm={handleExecuteLogout}
        onCancel={() => setLogoutDialogVisible(false)}
        isDestructive={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  storeBranding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  storeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  storeTagline: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  userControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  userBadge: {
    alignItems: 'flex-end',
    marginRight: 2,
  },
  usernameText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    maxWidth: 80,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.xs,
    marginTop: 1,
  },
  roleTagAdmin: {
    backgroundColor: COLORS.primaryLight,
  },
  roleTagUser: {
    backgroundColor: '#E2E8F0',
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  logoutButton: {
    padding: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  categoryContainer: {
    paddingVertical: SPACING.xs,
  },
  listContent: {
    paddingBottom: 80,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.md,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
