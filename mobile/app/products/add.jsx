import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { productsService } from '../../services/products';
import ProductForm from '../../components/ProductForm';
import { COLORS } from '../../constants/theme';

export default function AddProductScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Guard: Admin only
  if (!isAdmin) {
    router.replace('/products');
    return null;
  }

  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await productsService.createProduct(formData);
      router.replace('/products');
    } catch (err) {
      setErrorMessage(err.friendlyMessage || t('products.create_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ProductForm
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel={t('form.add_to_store')}
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
});
