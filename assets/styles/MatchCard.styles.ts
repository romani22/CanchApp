import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
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
