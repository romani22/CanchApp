import { Chip } from '@/components/ui/Chip'
import { sports } from '@/constants/matches'
import { spacing } from '@/theme/spacing'
import { SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { ScrollView, StyleSheet } from 'react-native'

interface SportFilterProps {
	selectedSport?: SportType
	onSelectSport: (sport?: SportType) => void
}

interface SportOption {
	key: SportType | 'all'
	label: string
	icon: keyof typeof Ionicons.glyphMap
}

// Derivado de la lista canónica: la copia local que había acá se había quedado
// sin voley, así que no se podía filtrar por ese deporte.
const filterOptions: SportOption[] = [{ key: 'all', label: 'Todos', icon: 'apps' }, ...sports]

export function SportFilter({ selectedSport, onSelectSport }: SportFilterProps) {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
			{filterOptions.map((sport) => (
				<Chip key={sport.key} label={sport.label} icon={sport.icon} selected={sport.key === 'all' ? !selectedSport : selectedSport === sport.key} onPress={() => onSelectSport(sport.key === 'all' ? undefined : (sport.key as SportType))} size='md' />
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		gap: spacing.md,
	},
})
