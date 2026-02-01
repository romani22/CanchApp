import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { SportType } from '@/types/database.types';
import { spacing } from '@/theme/spacing';
import { Ionicons } from '@expo/vector-icons';

interface SportFilterProps {
  selectedSport?: SportType;
  onSelectSport: (sport?: SportType) => void;
}

interface SportOption {
  key: SportType | 'all';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const sports: SportOption[] = [
  { key: 'all', label: 'Todos', icon: 'apps' },
  { key: 'futbol', label: 'Futbol', icon: 'football' },
  { key: 'tenis', label: 'Tenis', icon: 'tennisball' },
  { key: 'padel', label: 'Padel', icon: 'tennisball' },
  { key: 'basquet', label: 'Basquet', icon: 'basketball' },
];

export function SportFilter({ selectedSport, onSelectSport }: SportFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {sports.map((sport) => (
        <Chip
          key={sport.key}
          label={sport.label}
          icon={sport.icon}
          selected={sport.key === 'all' ? !selectedSport : selectedSport === sport.key}
          onPress={() => onSelectSport(sport.key === 'all' ? undefined : (sport.key as SportType))}
          size="md"
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
});
