import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchWithCreator, SkillLevel } from '@/types/database.types'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

interface MatchCardProps {
	match: MatchWithCreator
	relation?: 'created' | 'joined'
	onPress: () => void
	onJoin?: () => void
}

const levelLabels: Record<SkillLevel, string> = {
	principiante: 'Principiante',
	intermedio: 'Intermedio',
	avanzado: 'Avanzado',
}

export function MatchCardComponent({ match, relation, onPress, onJoin }: MatchCardProps) {
	const formatMatchDate = () => {
		const date = parseISO(match.date)
		if (isToday(date)) return 'Hoy'
		if (isTomorrow(date)) return 'Manana'
		return format(date, 'EEEE d', { locale: es })
	}

	const formatTime = (time: string) => {
		return time.substring(0, 5)
	}

	const playersNeeded = match.players_needed
	const confirmedPlayers = match.participants?.length || 1

	return (
		<TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
			{/* Image Header */}
			<ImageBackground source={getSportImage(match.sport)} style={styles.imageContainer} imageStyle={styles.image}>
				<View style={styles.imageOverlay} />
				<View style={styles.badgeContainer}>
					<View style={[styles.levelBadge, match.skill_level === 'intermedio' && styles.levelBadgeIntermediate, match.skill_level === 'avanzado' && styles.levelBadgeAdvanced]}>
						<Text style={[styles.levelText, match.skill_level === 'intermedio' && styles.levelTextDark, match.skill_level === 'avanzado' && styles.levelTextDark]}>{levelLabels[match.skill_level]}</Text>
					</View>
					<View style={styles.topRightBadgeContainer}>
						{relation === 'created' && (
							<View style={styles.createdBadge}>
								<Ionicons name='star' size={12} color={colors.backgroundDark} />
								<Text style={styles.relationText}>Creador</Text>
							</View>
						)}

						{relation === 'joined' && (
							<View style={styles.joinedBadge}>
								<Ionicons name='people' size={12} color={colors.backgroundDark} />
								<Text style={styles.relationText}>Unido</Text>
							</View>
						)}
					</View>
				</View>
			</ImageBackground>

			{/* Content */}
			<View style={styles.content}>
				<View style={styles.header}>
					<View style={styles.titleContainer}>
						<Text style={styles.title} numberOfLines={1}>
							{match.title}
						</Text>
						<View style={styles.locationRow}>
							<Ionicons name='location' size={16} color={colors.textSecondaryDark} />
							<Text style={styles.location} numberOfLines={1}>
								{match.venue_name}
							</Text>
						</View>
					</View>
					<View style={styles.dateContainer}>
						<Text style={styles.dateText}>
							{formatMatchDate()}, {formatTime(match.start_time)}
						</Text>
					</View>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<View style={styles.playersInfo}>
						{/* Avatar Stack */}
						<View style={styles.avatarStack}>
							{match.participants?.slice(0, 3).map((p, index) => (
								<View key={p.id} style={[styles.avatar, { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }]}>
									{p.user?.avatar_url ? (
										<Image source={{ uri: p.user.avatar_url }} style={styles.avatarImage} />
									) : (
										<View style={styles.avatarPlaceholder}>
											<Text style={styles.avatarInitial}>{p.user?.full_name?.[0]?.toUpperCase() || '?'}</Text>
										</View>
									)}
								</View>
							))}
							{confirmedPlayers > 3 && (
								<View style={[styles.avatar, styles.avatarMore, { marginLeft: -8 }]}>
									<Text style={styles.avatarMoreText}>+{confirmedPlayers - 3}</Text>
								</View>
							)}
						</View>
						<Text style={styles.playersText}>{playersNeeded > 0 ? `Faltan ${playersNeeded} jugadores` : 'Completo'}</Text>
					</View>

					{onJoin && playersNeeded > 0 && (
						<TouchableOpacity style={styles.joinButton} onPress={onJoin}>
							<Text style={styles.joinButtonText}>Unirme</Text>
						</TouchableOpacity>
					)}
				</View>
			</View>
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	imageContainer: {
		height: 180,
		justifyContent: 'flex-start',
	},
	image: {
		borderTopLeftRadius: borderRadius.lg,
		borderTopRightRadius: borderRadius.lg,
	},
	imageOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.2)',
	},
	badgeContainer: {
		flexDirection: 'row',
		padding: spacing.md,
	},
	levelBadge: {
		backgroundColor: 'rgba(255,255,255,0.2)',
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.full,
	},
	levelBadgeIntermediate: {
		backgroundColor: `${colors.primary}E6`,
	},
	levelBadgeAdvanced: {
		backgroundColor: colors.warning,
	},
	levelText: {
		...typography.labelSmall,
		color: colors.textPrimaryDark,
		fontWeight: '700',
	},
	levelTextDark: {
		color: colors.backgroundDark,
	},
	content: {
		padding: spacing.lg,
		gap: spacing.md,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	titleContainer: {
		flex: 1,
		marginRight: spacing.md,
	},
	title: {
		...typography.h4,
		color: colors.textPrimaryDark,
		marginBottom: spacing.xs,
	},
	locationRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.xs,
	},
	location: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		flex: 1,
	},
	dateContainer: {
		alignItems: 'flex-end',
	},
	dateText: {
		...typography.labelLarge,
		color: colors.primary,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingTop: spacing.md,
		borderTopWidth: 1,
		borderTopColor: colors.borderDark,
	},
	playersInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	avatarStack: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatar: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: colors.surfaceDark,
		overflow: 'hidden',
	},
	avatarImage: {
		width: '100%',
		height: '100%',
	},
	avatarPlaceholder: {
		width: '100%',
		height: '100%',
		backgroundColor: colors.textSecondaryDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatarInitial: {
		...typography.labelSmall,
		color: colors.textPrimaryDark,
		fontSize: 10,
	},
	avatarMore: {
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatarMoreText: {
		...typography.labelSmall,
		color: colors.backgroundDark,
		fontSize: 9,
		fontWeight: '700',
	},
	playersText: {
		...typography.labelLarge,
		color: colors.primary,
	},
	joinButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	},
	joinButtonText: {
		...typography.button,
		color: colors.backgroundDark,
	},
	topRightBadgeContainer: {
		position: 'absolute',
		top: spacing.md,
		right: spacing.md,
	},

	createdBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: colors.success, // verde
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.full,
	},

	joinedBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: colors.info || colors.primary, // azul
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.full,
	},

	relationText: {
		...typography.labelSmall,
		color: colors.backgroundDark,
		fontWeight: '700',
	},
})
