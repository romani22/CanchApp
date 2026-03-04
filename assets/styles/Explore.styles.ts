import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { StyleSheet } from 'react-native'

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
	},
	headerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
	},
	avatarButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: `${colors.primary}20`,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
	},
	headerTitle: {
		...typography.h3,
		color: colors.textPrimaryDark,
	},
	headerRight: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.surfaceDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
		paddingBottom: spacing.md,
	},
	sectionTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	mapButton: {},
	mapButtonText: {
		...typography.labelSmall,
		color: colors.primary,
	},
	listContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: 100,
	},
	separator: {
		height: spacing.lg,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	errorContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.xl,
	},
	errorText: {
		...typography.body,
		color: colors.error,
		textAlign: 'center',
		marginBottom: spacing.lg,
	},
	retryButton: {
		backgroundColor: colors.surfaceDark,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
	},
	retryButtonText: {
		...typography.button,
		color: colors.textPrimaryDark,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: spacing['5xl'],
		gap: spacing.md,
	},
	emptyTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
		marginTop: spacing.md,
	},
	emptyText: {
		...typography.body,
		color: colors.textSecondaryDark,
		textAlign: 'center',
		maxWidth: 280,
	},
	createButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
		marginTop: spacing.lg,
	},
	createButtonText: {
		...typography.button,
		color: colors.backgroundDark,
	},
	fab: {
		position: 'absolute',
		bottom: 80,
		right: spacing.xl,
		width: 40,
		height: 40,
		borderRadius: 28,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
})
