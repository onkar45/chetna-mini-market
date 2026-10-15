/**
 * Chetna Mini Market — Design System Tokens
 * Phase 8: Royal Purple & White UI Design System
 */

export const COLORS = {
  // Brand Identity (Royal Purple & White)
  primary: '#6339A6',        // Primary purple: Main buttons, selected tabs, active controls
  primaryDark: '#452477',    // Deep purple: Strong emphasis, dark purple headers, accents
  primaryLight: '#F2ECFA',   // Light lavender: Selected backgrounds, subtle highlights, active chips
  deepPurple: '#452477',     // Alias for strong visual emphasis
  lightLavender: '#F2ECFA',  // Alias for soft tint background

  // Surfaces & Backgrounds
  surface: '#FFFFFF',        // Pure white: Cards, forms, modals, navigation surfaces
  surfaceHighlight: '#F9F7FC',// Extremely subtle purple tint for card alternating sections
  background: '#F8F7FB',     // Clean page background for screens

  // Text & Content Hierarchy
  textPrimary: '#24212B',    // Main text: Headings, high-contrast readable body text
  textSecondary: '#706B78',  // Secondary text: Captions, helper text, labels, metadata
  textMuted: '#A39EAC',      // Muted placeholders, disabled icons, subtle timestamps
  textWhite: '#FFFFFF',      // Contrasting white text on purple/dark backgrounds

  // Dividers & Outlines
  border: '#E7E2ED',         // Card borders, dividers, subtle input outlines
  borderFocus: '#6339A6',    // Input focus border, active selection outline
  borderSubtle: '#F0ECF5',   // Very light hairline dividers

  // Semantic Feedback Colors
  success: '#24845A',        // Successful operations, active status
  successLight: '#E9F6F0',   // Success badge / confirmation background
  successBorder: '#BFE6D4',  // Success badge outline

  warning: '#B7791F',        // Warnings, pending review, attention needed
  warningLight: '#FDF6EA',   // Warning background banner
  warningBorder: '#F5DEB3',  // Warning outline

  danger: '#C43D4B',         // Destructive actions, delete buttons, form errors
  dangerLight: '#FBECEE',    // Danger banner background
  dangerBorder: '#F5C2C7',   // Danger outline
};

export const TYPOGRAPHY = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#452477',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#452477',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#452477',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const SIZES = {
  inputHeight: 48,
  buttonHeight: 48,
  cardPadding: 16,
};
