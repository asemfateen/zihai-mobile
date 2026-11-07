/**
 * Zihai Theme Tokens
 * Matches the parent web project's botanical dark jade / emerald palette.
 */

import { Platform } from 'react-native';

export const Colors = {
  dark: {
    background: '#1a1c1a',
    surface: '#222622',
    card: '#2a2f2a',
    cardHover: '#323832',
    border: '#3a413a',
    borderLight: '#464f46',
    primary: '#4ade80',
    primaryHover: '#22c55e',
    primaryGlow: 'rgba(74, 222, 128, 0.15)',
    textPrimary: '#f0fdf4',
    textSecondary: '#bbf7d0',
    textMuted: '#8b948b',
    accentRose: '#f43f5e',
    accentOrange: '#f97316',
    // Compatibility aliases for template components
    text: '#f0fdf4',
    backgroundElement: '#222622',
    backgroundSelected: '#2a2f2a',
  },
  light: {
    background: '#fdfcf8',
    surface: '#f5f3eb',
    card: '#ffffff',
    cardHover: '#faf8f2',
    border: '#e6e2d3',
    borderLight: '#dcd6c3',
    primary: '#16a34a',
    primaryHover: '#15803d',
    primaryGlow: 'rgba(22, 163, 74, 0.12)',
    textPrimary: '#2f332f',
    textSecondary: '#6b726b',
    textMuted: '#9ca3af',
    accentRose: '#e11d48',
    accentOrange: '#ea580c',
    // Compatibility aliases for template components
    text: '#2f332f',
    backgroundElement: '#f5f3eb',
    backgroundSelected: '#e6e2d3',
  },
} as const;

export type ThemeColors = typeof Colors.dark;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    rounded: '"SF Pro Rounded", "Hiragino Maru Gothic ProN", sans-serif',
    mono: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
  },
});
