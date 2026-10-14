import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import '../services/i18n';
import { AuthProvider } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor={COLORS.background} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: COLORS.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="products/index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="products/[id]"
          options={{
            title: t('products.product_details'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="products/add"
          options={{
            title: t('products.add_product_title'),
            headerBackTitle: t('common.back'),
          }}
        />
        <Stack.Screen
          name="products/edit/[id]"
          options={{
            title: t('products.edit_product'),
            headerBackTitle: t('common.back'),
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
