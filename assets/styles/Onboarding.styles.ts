import { colors } from '@/theme/colors'
import { avatarSize, borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},

	/* ---------- Progreso ---------- */
	progressWrapper: {
		paddingHorizontal: spacing.xl,
		paddingTop: spacing.md,
		paddingBottom: spacing.lg,
		gap: spacing.sm,
	},
	progressTrack: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	progressSegment: {
		flex: 1,
		height: 4,
		borderRadius: borderRadius.full,
		backgroundColor: colors.borderDark,
	},
	progressSegmentActive: {
		backgroundColor: colors.primary,
	},
	progressLabel: {
		...typography.labelSmall,
		color: colors.textSecondaryDark,
	},

	/* ---------- Contenido ---------- */
	scrollContent: {
		paddingHorizontal: spacing.xl,
		paddingBottom: spacing['3xl'],
	},
	stepTitle: {
		...typography.h2,
		color: colors.textPrimaryDark,
		marginBottom: spacing.sm,
	},
	stepSubtitle: {
		...typography.body,
		color: colors.textSecondaryDark,
		marginBottom: spacing['2xl'],
	},

	/* ---------- Avatar ---------- */
	avatarSection: {
		alignItems: 'center',
		marginBottom: spacing['2xl'],
	},
	avatarWrapper: {
		width: avatarSize['3xl'],
		height: avatarSize['3xl'],
		borderRadius: avatarSize['3xl'] / 2,
		borderWidth: 3,
		borderColor: colors.primary,
		overflow: 'hidden',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: colors.surfaceDark,
	},
	avatar: {
		width: '100%',
		height: '100%',
	},
	avatarOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	avatarBadge: {
		position: 'absolute',
		bottom: 0,
		right: 0,
		backgroundColor: colors.primary,
		width: 34,
		height: 34,
		borderRadius: 17,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 3,
		borderColor: colors.backgroundDark,
	},
	avatarHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.md,
	},

	/* ---------- Inputs ---------- */
	fieldLabel: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
		marginBottom: spacing.sm,
	},
	fieldOptional: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		textTransform: 'none',
	},
	input: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.md,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		color: colors.textPrimaryDark,
		...typography.bodyLarge,
		marginBottom: spacing.xl,
	},
	inputRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginBottom: spacing.xl,
	},
	inputFlex: {
		flex: 1,
		marginBottom: 0,
	},

	/* ---------- Chips de deportes ---------- */
	chipsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.xl,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		borderColor: colors.borderDark,
		backgroundColor: colors.surfaceDark,
	},
	chipActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipText: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
	},
	chipTextActive: {
		color: colors.backgroundDark,
	},

	/* Nivel por deporte: los estilos viven en components/ui/SportLevelEditor.tsx,
	   compartidos con la edición de perfil.

	   Zona: la resuelve components/ui/VenueZoneInput.tsx, el mismo buscador de
	   localidades que usa el alta de partidos. */

	/* ---------- Errores ---------- */
	errorText: {
		...typography.bodySmall,
		color: colors.error,
		marginBottom: spacing.lg,
	},

	/* ---------- Footer ---------- */
	footer: {
		flexDirection: 'row',
		gap: spacing.md,
		paddingHorizontal: spacing.xl,
		paddingTop: spacing.lg,
		paddingBottom: spacing.xl,
		borderTopWidth: 1,
		borderTopColor: colors.borderDark,
		backgroundColor: colors.backgroundDark,
	},
	backButton: {
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.lg,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.borderDark,
		justifyContent: 'center',
		alignItems: 'center',
	},
	backButtonText: {
		...typography.button,
		color: colors.textSecondaryDark,
	},
	nextButton: {
		flex: 1,
		flexDirection: 'row',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		paddingVertical: spacing.lg,
		borderRadius: borderRadius.md,
		justifyContent: 'center',
		alignItems: 'center',
	},
	nextButtonDisabled: {
		opacity: 0.4,
	},
	nextButtonText: {
		...typography.buttonLarge,
		color: colors.backgroundDark,
	},
})
