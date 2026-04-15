import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { StyleSheet } from 'react-native'

export const notificationSettingsStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},

	// ── Header ─────────────────────────────────────────────────────────────
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.surfaceDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	savingSlot: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},

	// ── Scroll ─────────────────────────────────────────────────────────────
	scrollContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: 48,
	},

	// ── Section label ──────────────────────────────────────────────────────
	sectionLabel: {
		...typography.label,
		color: colors.textSecondaryDark,
		marginBottom: spacing.md,
		marginTop: spacing.xl,
	},

	// ── Permission banner ──────────────────────────────────────────────────
	permissionBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: `${colors.warning}18`,
		borderWidth: 1,
		borderColor: `${colors.warning}40`,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		marginTop: spacing.xl,
		gap: spacing.md,
	},
	permissionText: {
		flex: 1,
	},
	permissionTitle: {
		...typography.labelLarge,
		color: colors.warning,
	},
	permissionDescription: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.xs,
	},
	permissionButton: {
		backgroundColor: colors.warning,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
	},
	permissionButtonText: {
		...typography.button,
		color: '#000',
		fontSize: 12,
	},

	// ── Card ───────────────────────────────────────────────────────────────
	card: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		overflow: 'hidden',
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.lg,
	},
	cardRowBordered: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderDark,
	},

	// ── Row content ────────────────────────────────────────────────────────
	rowLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		marginRight: spacing.md,
	},
	rowIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: spacing.md,
	},
	rowText: {
		flex: 1,
	},
	rowTitle: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
	},
	rowTitleDisabled: {
		color: colors.textSecondaryDark,
	},
	rowDescription: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 2,
	},

	// ── Radius selector ────────────────────────────────────────────────────
	radiusHeader: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.lg,
		paddingBottom: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderDark,
	},
	radiusTitle: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
	},
	radiusDescription: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 2,
	},
	radiusOptions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		padding: spacing.md,
		gap: spacing.sm,
	},
	radiusChip: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	radiusChipActive: {
		borderColor: colors.primary,
		backgroundColor: `${colors.primary}20`,
	},
	radiusChipDisabled: {
		opacity: 0.35,
	},
	radiusChipText: {
		...typography.labelLarge,
		color: colors.textSecondaryDark,
	},
	radiusChipTextActive: {
		color: colors.primary,
	},

	// ── Info box ───────────────────────────────────────────────────────────
	infoBox: {
		flexDirection: 'row',
		backgroundColor: `${colors.info}12`,
		borderWidth: 1,
		borderColor: `${colors.info}30`,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		marginTop: spacing.xl,
		gap: spacing.md,
	},
	infoText: {
		flex: 1,
	},
	infoTitle: {
		...typography.labelLarge,
		color: colors.info,
	},
	infoDescription: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.xs,
	},

	// ── Error banner ───────────────────────────────────────────────────────
	errorBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: `${colors.error}15`,
		borderWidth: 1,
		borderColor: `${colors.error}30`,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		marginTop: spacing.xl,
		gap: spacing.sm,
	},
	errorText: {
		...typography.bodySmall,
		color: colors.error,
		flex: 1,
	},
})
