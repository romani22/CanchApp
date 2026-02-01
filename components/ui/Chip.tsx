import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

interface ChipProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Chip({
  label,
  icon,
  selected = false,
  onPress,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: ChipProps) {
  const getContainerStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.container, styles[`container_${size}`]];
    
    if (selected || variant === 'primary') {
      baseStyle.push(styles.containerSelected);
    } else if (variant === 'outline') {
      baseStyle.push(styles.containerOutline);
    } else {
      baseStyle.push(styles.containerDefault);
    }
    
    if (style) baseStyle.push(style);
    return baseStyle;
  };

  const getTextStyle = (): TextStyle[] => {
    const baseStyle: TextStyle[] = [styles.label, styles[`label_${size}`]];
    
    if (selected || variant === 'primary') {
      baseStyle.push(styles.labelSelected);
    } else {
      baseStyle.push(styles.labelDefault);
    }
    
    if (textStyle) baseStyle.push(textStyle);
    return baseStyle;
  };

  const iconColor = selected || variant === 'primary' 
    ? colors.backgroundDark 
    : colors.textPrimaryDark;
  
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  return (
    <TouchableOpacity
      style={getContainerStyle()}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {icon && (
        <Ionicons 
          name={icon} 
          size={iconSize} 
          color={iconColor}
          style={styles.icon}
        />
      )}
      <Text style={getTextStyle()}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  container_sm: {
    height: 32,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  container_md: {
    height: 40,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  container_lg: {
    height: 48,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  containerDefault: {
    backgroundColor: colors.surfaceDark,
  },
  containerSelected: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  containerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    ...typography.labelLarge,
  },
  label_sm: {
    fontSize: 12,
  },
  label_md: {
    fontSize: 14,
  },
  label_lg: {
    fontSize: 16,
  },
  labelDefault: {
    color: colors.textPrimaryDark,
  },
  labelSelected: {
    color: colors.backgroundDark,
  },
});
