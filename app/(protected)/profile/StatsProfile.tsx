import { styles } from '@/assets/styles/Profile.styles'
import { sports as sportOptions, sportsFromLevels } from '@/constants/matches'
import { buildMetricRows, buildStatCards } from '@/constants/stats'
import { matchResultsService } from '@/services/matchResults.service'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { SportLevels, SportStats, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Props = {
	userId: string
	/** Totales de todos los deportes (vista user_stats, mezclada en el perfil). */
	totalMatches: number
	totalWins: number
	rating: number
	/** Deportes que juega: definen las opciones del selector. */
	sportLevels: SportLevels
}

/** 'all' = todos los deportes juntos. */
type Selection = SportType | 'all'

/**
 * Estadísticas del perfil, con selector de deporte.
 *
 * Los números salen de partidos finalizados con resultado cargado (vista
 * user_sport_stats). Antes esta grilla leía profiles.total_matches y total_wins,
 * que nadie escribía nunca: mostraba 0 partidos y 0% de victorias para todo el
 * mundo. Un deporte sin partidos con resultado ahora lo dice en vez de fingir un 0.
 */
function StatsProfile({ userId, totalMatches, totalWins, rating, sportLevels }: Props) {
	const [statsBySport, setStatsBySport] = useState<Record<string, SportStats>>({})
	const [loading, setLoading] = useState(true)
	const [selected, setSelected] = useState<Selection>('all')

	useEffect(() => {
		let active = true

		matchResultsService
			.getUserSportStats(userId)
			.then((rows) => {
				if (!active) return
				setStatsBySport(Object.fromEntries(rows.map((row) => [row.sport, row])))
			})
			.catch((err) => console.warn('[StatsProfile] No se pudieron cargar las estadísticas:', err))
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [userId])

	// Los deportes del perfil, más cualquiera en el que tenga partidos jugados
	// (puede haber jugado uno que después sacó de su lista). Orden canónico.
	const played = new Set([...sportsFromLevels(sportLevels), ...(Object.keys(statsBySport) as SportType[])])
	const availableSports = sportOptions.filter((s) => played.has(s.key))

	const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0
	const sportStats = selected === 'all' ? null : (statsBySport[selected] ?? null)

	const cards =
		selected === 'all'
			? [
					{ key: 'played', value: String(totalMatches), label: totalMatches === 1 ? 'Partido' : 'Partidos' },
					{ key: 'wins', value: String(totalWins), label: 'Victorias' },
					{ key: 'win_rate', value: `${winRate}%`, label: '% Victorias' },
					{ key: 'rating', value: rating.toFixed(1), label: 'Rating' },
				]
			: buildStatCards(sportStats)

	const metricRows = selected === 'all' ? [] : buildMetricRows(sportStats, selected)

	return (
		<View style={local.wrapper}>
			{availableSports.length > 0 && (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.selectorRow}>
					<SelectorChip label='Todos' active={selected === 'all'} onPress={() => setSelected('all')} />
					{availableSports.map((sport) => (
						<SelectorChip key={sport.key} label={sport.label} icon={sport.icon} active={selected === sport.key} onPress={() => setSelected(sport.key)} />
					))}
				</ScrollView>
			)}

			{loading ? (
				<View style={local.placeholder}>
					<ActivityIndicator color={colors.primary} />
				</View>
			) : cards.length === 0 ? (
				<View style={local.placeholder}>
					<Ionicons name='stats-chart-outline' size={22} color={colors.textSecondaryDark} />
					<Text style={local.placeholderText}>Todavía no hay partidos de {sportOptions.find((s) => s.key === selected)?.label ?? 'este deporte'} con resultado cargado.</Text>
				</View>
			) : (
				<>
					<View style={local.grid}>
						{cards.map((card) => (
							<View key={card.key} style={[styles.statCard, local.gridCard]}>
								<Text style={styles.statValue}>{card.value}</Text>
								<Text style={styles.statLabel}>{card.label}</Text>
							</View>
						))}
					</View>

					{metricRows.length > 0 && (
						<View style={local.metrics}>
							{metricRows.map((row) => (
								<View key={row.key} style={local.metricRow}>
									<Text style={local.metricLabel}>{row.label}</Text>
									<Text style={local.metricTotal}>{row.total}</Text>
									{row.perMatch != null && <Text style={local.metricAvg}>{row.perMatch.toFixed(1)} por partido</Text>}
								</View>
							))}
						</View>
					)}
				</>
			)}
		</View>
	)
}

function SelectorChip({ label, icon, active, onPress }: { label: string; icon?: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
	return (
		<TouchableOpacity style={[local.chip, active && local.chipActive]} onPress={onPress} activeOpacity={0.8}>
			{icon && <Ionicons name={icon} size={14} color={active ? colors.backgroundDark : colors.textSecondaryDark} />}
			<Text style={[local.chipText, active && local.chipTextActive]}>{label}</Text>
		</TouchableOpacity>
	)
}

const local = StyleSheet.create({
	wrapper: {
		marginBottom: spacing.xl,
		gap: spacing.md,
	},
	selectorRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		paddingRight: spacing.md,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		height: 32,
		paddingHorizontal: spacing.md,
		borderRadius: borderRadius.full,
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	chipActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontWeight: '600',
	},
	chipTextActive: {
		color: colors.backgroundDark,
	},
	// flexBasis en vez de flex: 1 para que la grilla pueda tener 3 o 4 cards y
	// pase a la fila siguiente en vez de apretarlas.
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.md,
	},
	gridCard: {
		flexGrow: 1,
		flexBasis: '20%',
		minWidth: 74,
	},
	metrics: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.lg,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
	},
	metricRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
	},
	metricLabel: {
		...typography.body,
		color: colors.textPrimaryDark,
		flex: 1,
	},
	metricTotal: {
		...typography.body,
		color: colors.primary,
		fontWeight: '700',
	},
	metricAvg: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		minWidth: 108,
		textAlign: 'right',
	},
	placeholder: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
	},
	placeholderText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		flex: 1,
	},
})

export default StatsProfile
