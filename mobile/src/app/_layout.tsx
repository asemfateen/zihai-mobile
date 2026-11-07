import React, { useEffect } from 'react';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { NavigationBar } from 'expo-navigation-bar';
import { initTts } from '../utils/audio';
import { Colors } from '../constants/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  useEffect(() => {
    // Hide splash screen after root layout mounts
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 500);

    // Pre-warm TTS engine for zero-delay speech playback
    initTts().catch(() => {});

    // Apply dark theme to system UI and hide navigation bar
    SystemUI.setBackgroundColorAsync('#1a1c1a').catch(() => {});
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setStyle('dark');
        NavigationBar.setHidden(true);
      } catch (e) {}
    }

    return () => clearTimeout(timer);
  }, []);

  const customTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: Colors.dark.background,
          card: Colors.dark.surface,
          text: Colors.dark.textPrimary,
          border: Colors.dark.border,
          primary: Colors.dark.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: Colors.light.background,
          card: Colors.light.card,
          text: Colors.light.textPrimary,
          border: Colors.light.border,
          primary: Colors.light.primary,
        },
      };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SQLiteProvider
          databaseName="zihai.db"
          assetSource={{ assetId: require('../../assets/zihai.db') }}
          onError={(err) => {
            if (__DEV__) {
              console.error('[Zihai DB] SQLite Provider initialization error:', err);
            }
            throw err;
          }}
        >
          <ThemeProvider value={customTheme}>
            <StatusBar style="light" />
            <NavigationBar style="dark" hidden={true} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: customTheme.colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
          </ThemeProvider>
        </SQLiteProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
