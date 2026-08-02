import { levelForSport, levelLabels } from '@/constants/matches'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { SportLevels, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

/**
 * Forma mínima de un participante para este modal. Cubre tanto a los jugadores
 * registrados como a los invitados, que no tienen user_id ni perfil asociado.
 */
export type ParticipantSummary = {
	user_id: string | null
	guest_name?: string | null
	user: {
		full_name: string
		avatar_url: string | null
		rating?: number
		sport_levels?: SportLevels
	} | null
}

type Props = {
	participant: ParticipantSummary | null
	/** Deporte del partido: define qué nivel del jugador se muestra. */
	sport: SportType
	onClose: () => void
}

const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A']
const colorFromName = (text?: string | null) => (text ? avatarColors[text.charCodeAt(0) % avatarColors.length] : avatarColors[0])

/**
 * Ficha de un participante. Estaba duplicada casi textualmente en MatchCard y en
 * ParticipantsMatch — un comentario en esta última incluso decía "igual al de
 * MatchCard" — así que las dos copias podían divergir sin que nadie lo notara.
 */
export function ParticipantModal({ participant, sport, onClose }: Props) {
	const name = participant?.user?.full_name ?? participant?.guest_name ?? 'Invitado'
	const isGuest = !participant?.user_id
	const rating = participant?.user?.rating
	// Nivel en el deporte de ESTE partido, no un valor genérico.
	const level = levelForSport(participant?.user?.sport_levels, sport)

	return (
		<Modal visible={!!participant} transparent animationType='fade' onRequestClose={onClose}>
			<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
				<View style={styles.card}>
					{participant?.user?.avatar_url ? (
						<Image source={{ uri: participant.user.avatar_url }} style={styles.avatar} />
					) : (
						<View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colorFromName(name) }]}>
							{name && name !== 'Invitado' ? <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={36} color='white' />}
						</View>
					)}

					<Text style={styles.name}>{name}</Text>
					<Text style={styles.kind}>{isGuest ? 'Invitado' : 'Jugador registrado'}</Text>

					{level && (
						<View style={styles.levelBadge}>
							<Text style={styles.levelText}>{levelLabels[level]}</Text>
						</View>
					)}

					{rating != null && rating > 0 && (
						<View style={styles.ratingRow}>
							<Ionicons name='star' size={14} color={colors.warning} />
							<Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
						</View>
					)}
				</View>
			</TouchableOpacity>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.65)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	card: {
		width: 280,
		backgroundColor: colors.surfaceDark,
		borderRadius: 20,
		padding: spacing['2xl'],
		alignItems: 'center',
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	avatar: {
		width: 80,
		height: 80,
		borderRadius: 40,
		marginBottom: 14,
		borderWidth: 3,
		borderColor: colors.primary,
	},
	avatarPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatarInitial: {
		fontSize: 32,
		fontWeight: '700',
		color: 'white',
	},
	name: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	kind: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 4,
	},
	levelBadge: {
		marginTop: spacing.sm,
		backgroundColor: `${colors.primary}20`,
		paddingHorizontal: spacing.md,
		paddingVertical: 4,
		borderRadius: borderRadius.full,
	},
	levelText: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '600',
	},
	ratingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: spacing.sm,
	},
	ratingText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
})
