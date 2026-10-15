import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function AppLogo({ size = 80, style, imageStyle }) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={require('../assets/Chetna Mini Market App Logo.png')}
        style={[{ width: size, height: size }, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
