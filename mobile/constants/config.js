import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Helper to determine the best default backend URL:
// 1. If explicit EXPO_PUBLIC_API_URL is configured, use it.
// 2. On Android physical devices / emulator via Expo Go, Constants.expoConfig?.hostUri provides the dev machine's LAN IP.
// 3. Fallback to localhost:8000 (web / iOS simulator) or 10.0.2.2:8000 (standard Android emulator).

function getDefaultApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const lanIp = hostUri.split(':')[0];
    return `http://${lanIp}:8000`;
  }

  // If running on a physical Android device on local Wi-Fi or development
  if (Platform.OS === 'android') {
    return 'http://192.168.1.14:8000';
  }

  return 'http://localhost:8000';
}

export const API_BASE_URL = getDefaultApiUrl();

export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}
