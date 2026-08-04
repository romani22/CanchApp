import { TEAM_CONFIG } from '@/constants/matches'
import { METRICS, SPORT_METRICS, formatScore } from '@/constants/stats'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchPlayerStat, MatchResultVote, MatchResultWithPlayers, SportType, TeamMode } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Props = {
	result: MatchResultWithPlayers
	sport: SportType
	teamMode: TeamMode
	/** Para saber si el que mira puede votar y qué votó. */
	currentUserId?: string
	/**
	 * Jugadores registrados que podrían votar (todos menos quien cargó el resultado).
	 * Es el denominador de "5 de 8 confirmaron".
	 */
	voterCount?: number
	/** Sólo un jugador del partido que no cargó el resultado puede votar. */
	canVote?: boolean
	onVote?: (vote: MatchResultVote) => void
	onClearVote?: () => void
	voting?: boolean
}

/**
 * Resultado de un partido finalizado, tal como lo cargó el creador.
 *
 * Los jugadores se agrupan por resultado y no por equipo: es la única agrupación
 * que existe siempre, porque el resultado se guarda por jugador y un partido
 * puede no haber usado el modo equipos.
 */
export function MatchResultCard({ result, sport, teamMode, currentUserId, voterCount = 0, canVote = false, onVote, onClearVote, voting = false }: Props) {
	const score = formatScore(result)
	const winners = result.players.filter((p) => p.outcome === 'win')
	const losers = result.players.filter((p) => p.outcome === 'loss')
	const draws = result.players.filter((p) => p.outcome === 'draw')
	const isDraw = draws.length > 0 && winners.length === 0

	const confirmations = result.confirmations ?? []
	const confirmCount = confirmations.filter((c) => c.vote === 'confirm').length
	const disputes = confirmations.filter((c) => c.vote === 'dispute')
	const myVote = currentUserId ? confirmations.find((c) => c.user_id === currentUserId)?.vote : undefined

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

			{/* Objeciones: es lo único que frena un resultado. Sin objeciones vale, aunque
			    no lo haya confirmado nadie. */}
			{result.has_dispute && (
				<View style={styles.disputeBox}>
					<View style={styles.disputeHeader}>
						<Ionicons name='alert-circle' size={16} color={colors.warning} />
						<Text style={styles.disputeTitle}>En revisión</Text>
					</View>
					<Text style={styles.disputeText}>Este resultado no cuenta para las estadísticas hasta que quien lo cargó lo corrija.</Text>
					{disputes.map((dispute) => (
						<Text key={dispute.id} style={styles.disputeWho}>
							{dispute.user?.full_name ?? 'Un jugador'}
							{dispute.comment ? `: “${dispute.comment}”` : ' dice que no es así'}
						</Text>
					))}
				</View>
			)}

			{/* Confirmaciones — señal social, no requisito */}
			{voterCount > 0 && !result.has_dispute && (
				<Text style={styles.confirmCount}>
					{confirmCount === 0 ? 'Todavía nadie lo confirmó' : `${confirmCount} de ${voterCount} ${confirmCount === 1 ? 'jugador confirmó' : 'jugadores confirmaron'}`}
				</Text>
			)}

			{canVote && (
				<View style={styles.voteRow}>
					{myVote ? (
						<>
							<Text style={[styles.myVote, { color: myVote === 'confirm' ? colors.success : colors.warning }]}>{myVote === 'confirm' ? '✓ Lo confirmaste' : '⚠ Lo objetaste'}</Text>
							<TouchableOpacity onPress={onClearVote} disabled={voting} style={styles.voteLink}>
								<Text style={styles.voteLinkText}>Cambiar</Text>
							</TouchableOpacity>
						</>
					) : voting ? (
						<ActivityIndicator color={colors.primary} size='small' />
					) : (
						<>
							<TouchableOpacity style={[styles.voteButton, { borderColor: `${colors.success}60`, backgroundColor: `${colors.success}15` }]} onPress={() => onVote?.('confirm')}>
								<Ionicons name='checkmark' size={16} color={colors.success} />
								<Text style={[styles.voteButtonText, { color: colors.success }]}>Está bien</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.voteButton, { borderColor: `${colors.warning}60`, backgroundColor: `${colors.warning}15` }]} onPress={() => onVote?.('dispute')}>
								<Ionicons name='close' size={16} color={colors.warning} />
								<Text style={[styles.voteButtonText, { color: colors.warning }]}>No es así</Text>
							</TouchableOpacity>
						</>
					)}
				</View>
			)}
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
	disputeBox: {
		marginTop: spacing.md,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		backgroundColor: `${colors.warning}12`,
		borderWidth: 1,
		borderColor: `${colors.warning}40`,
		gap: 4,
	},
	disputeHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	disputeTitle: {
		...typography.bodySmall,
		color: colors.warning,
		fontWeight: '700',
	},
	disputeText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	disputeWho: {
		...typography.bodySmall,
		color: colors.textPrimaryDark,
	},
	confirmCount: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.md,
	},
	voteRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	voteButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
	},
	voteButtonText: {
		...typography.bodySmall,
		fontWeight: '700',
	},
	myVote: {
		...typography.bodySmall,
		fontWeight: '700',
		flex: 1,
	},
	voteLink: {
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
	},
	voteLinkText: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '600',
	},
})
