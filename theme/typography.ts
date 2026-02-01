import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
};

export const typography: Record<string, TextStyle> = {
  // Headings
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.15,
  },
  
  // Body
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  
  // Labels
  labelLarge: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  
  // Button
  button: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  buttonLarge: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
  },
};
