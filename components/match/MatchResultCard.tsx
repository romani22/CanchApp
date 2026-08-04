import { TEAM_CONFIG } from '@/constants/matches'
import { METRICS, SPORT_METRICS, formatScore } from '@/constants/stats'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchPlayerStat, MatchResultWithPlayers, SportType, TeamMode } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

type Props = {
	result: MatchResultWithPlayers
	sport: SportType
	teamMode: TeamMode
}

/**
 * Resultado de un partido finalizado, tal como lo cargó el creador.
 *
 * Los jugadores se agrupan por resultado y no por equipo: es la única agrupación
 * que existe siempre, porque el resultado se guarda por jugador y un partido
 * puede no haber usado el modo equipos.
 */
export function MatchResultCard({ result, sport, teamMode }: Props) {
	const score = formatScore(result)
	const winners = result.players.filter((p) => p.outcome === 'win')
	const losers = result.players.filter((p) => p.outcome === 'loss')
	const draws = result.players.filter((p) => p.outcome === 'draw')
	const isDraw = draws.length > 0 && winners.length === 0

	// Con equipos el marcador es A vs B; sin equipos, ganador vs perdedor.
	const sideLabels = teamMode === 'two_teams' ? [TEAM_CONFIG.A.label, TEAM_CONFIG.B.label] : isDraw ? ['Empate', ''] : ['Ganadores', 'Perdedores']

	return (
		<View style={styles.card}>
			<View style={styles.header}>
				<Ionicons name='trophy' size={18} color={colors.primary} />
				<Text style={styles.headerText}>Resultado final</Text>
			</View>

			{score ? (
				<>
					<Text style={styles.score}>{score}</Text>
					{teamMode === 'two_teams' && (
						<Text style={styles.sides}>
							{sideLabels[0]} · {sideLabels[1]}
						</Text>
					)}
				</>
			) : (
				<Text style={styles.score}>{isDraw ? 'Empate' : 'Sin marcador'}</Text>
			)}

			{isDraw && score && <Text style={styles.drawBadge}>Empataron</Text>}

			<PlayerGroup title={isDraw ? 'Empataron' : 'Ganaron'} players={isDraw ? draws : winners} sport={sport} tint={isDraw ? colors.warning : colors.success} />
			<PlayerGroup title='Perdieron' players={losers} sport={sport} tint={colors.error} />

			{result.notes ? <Text style={styles.notes}>&quot;{result.notes}&quot;</Text> : null}
		</View>
	)
}

function PlayerGroup({ title, players, sport, tint }: { title: string; players: MatchPlayerStat[]; sport: SportType; tint: string }) {
	if (players.length === 0) return null

	return (
		<View style={styles.group}>
			<Text style={[styles.groupTitle, { color: tint }]}>{title}</Text>
			{players.map((player) => (
				<View key={player.id} style={styles.playerRow}>
					<View style={[styles.dot, { backgroundColor: tint }]} />
					<Text style={styles.playerName} numberOfLines={1}>
						{player.display_name}
					</Text>
					<Text style={styles.playerMetrics}>{describeMetrics(player, sport)}</Text>
				</View>
			))}
		</View>
	)
}

/** "2 Goles · 1 Asist." — sólo las métricas que se cargaron para ese jugador. */
function describeMetrics(player: MatchPlayerStat, sport: SportType): string {
	return SPORT_METRICS[sport]
		.map((metric) => {
			const value = player[metric]
			// null es "no se cargó"; un 0 cargado a mano tampoco aporta nada acá.
			return value == null || value === 0 ? null : `${value} ${METRICS[metric].short}`
		})
		.filter(Boolean)
		.join(' · ')
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
		padding: spacing.lg,
		marginTop: spacing.xl,
		gap: spacing.xs,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	headerText: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	score: {
		...typography.h2,
		color: colors.textPrimaryDark,
		textAlign: 'center',
		marginVertical: spacing.sm,
	},
	sides: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		textAlign: 'center',
		marginTop: -spacing.sm,
		marginBottom: spacing.sm,
	},
	drawBadge: {
		...typography.bodySmall,
		color: colors.warning,
		textAlign: 'center',
		fontWeight: '600',
	},
	group: {
		marginTop: spacing.md,
		gap: 6,
	},
	groupTitle: {
		...typography.bodySmall,
		fontWeight: '700',
	},
	playerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	playerName: {
		...typography.body,
		color: colors.textPrimaryDark,
		flexShrink: 1,
	},
	playerMetrics: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginLeft: 'auto',
	},
	notes: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontStyle: 'italic',
		marginTop: spacing.md,
	},
})
