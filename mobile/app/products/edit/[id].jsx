import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { productsService } from '../../../services/products';
import ProductForm from '../../../components/ProductForm';
import LoadingState from '../../../components/LoadingState';
import ErrorState from '../../../components/ErrorState';
import { COLORS } from '../../../constants/theme';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Guard: Admin only
  if (!isAdmin) {
    router.replace('/products');
    return null;
  }

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await productsService.getProductById(id);
      setProduct(data);
    } catch (err) {
      setErrorMessage(err.friendlyMessage || t('products.load_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await productsService.updateProduct(id, formData);
      router.replace(`/products/${id}`);
    } catch (err) {
      setErrorMessage(err.friendlyMessage || t('products.update_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message={t('products.loading_info')} />;
  }

  if (errorMessage && !product) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title={t('products.product_unavailable')}
          message={errorMessage}
          onRetry={fetchProduct}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProductForm
        initialValues={product}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel={t('form.save_changes')}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
});
