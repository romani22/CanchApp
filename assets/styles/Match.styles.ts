import { colors } from '@/theme/colors'; // Ajusta la ruta según tu proyecto
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { Platform, StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderDark,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	headerSpacer: {
		width: 40,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 120,
	},
	section: {
		padding: spacing.lg,
	},
	sectionTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
		marginBottom: spacing.md,
	},
	chipsScroll: {
		marginHorizontal: -spacing.lg,
	},
	chipsContainer: {
		flexDirection: 'row',
		gap: spacing.md,
		paddingHorizontal: spacing.lg,
	},
	dateTimeRow: {
		flexDirection: 'row',
		gap: spacing.lg,
	},
	dateTimeInput: {
		flex: 1,
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.lg,
	},
	dateTimeLabel: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginBottom: spacing.xs,
	},
	dateTimeValue: {
		...typography.body,
		color: colors.textPrimaryDark,
	},
	inputWrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		paddingHorizontal: spacing.lg,
		height: 56,
		gap: spacing.md,
	},
	input: {
		flex: 1,
		...typography.body,
		color: colors.textPrimaryDark,
	},
	counterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.lg,
		marginBottom: spacing.md,
	},
	counterInfo: {
		flex: 1,
	},
	counterLabel: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	counterHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	counterControls: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.lg,
	},
	counterButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: `${colors.primary}20`,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
	},
	counterButtonActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	counterValue: {
		...typography.h4,
		color: colors.textPrimaryDark,
		width: 24,
		textAlign: 'center',
	},
	levelSelector: {
		flexDirection: 'row',
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.full,
		padding: 4,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	levelOption: {
		flex: 1,
		paddingVertical: spacing.md,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: borderRadius.full,
	},
	levelOptionFirst: {
		borderTopLeftRadius: borderRadius.full,
		borderBottomLeftRadius: borderRadius.full,
	},
	levelOptionLast: {
		borderTopRightRadius: borderRadius.full,
		borderBottomRightRadius: borderRadius.full,
	},
	levelOptionActive: {
		backgroundColor: colors.primary,
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 3,
	},
	levelText: {
		...typography.labelSmall,
		color: colors.textSecondaryDark,
		fontWeight: '700',
	},
	levelTextActive: {
		color: colors.backgroundDark,
	},
	levelHints: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.sm,
		marginTop: spacing.md,
	},
	levelHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontStyle: 'italic',
	},
	textArea: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.lg,
		...typography.body,
		color: colors.textPrimaryDark,
		minHeight: 120,
	},
	footer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: spacing.lg,
		paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
		backgroundColor: colors.backgroundDark,
	},
	submitButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		height: 64,
		borderRadius: borderRadius.full,
		backgroundColor: colors.primary,
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		...typography.buttonLarge,
		color: colors.backgroundDark,
	},
})
