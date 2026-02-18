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
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerTitle: {
		...typography.h2,
		color: colors.textPrimaryDark,
	},
	tabsContainer: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	tabs: {
		flexDirection: 'row',
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.full,
		padding: 4,
	},
	tab: {
		flex: 1,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: borderRadius.full,
	},
	tabActive: {
		backgroundColor: colors.backgroundDark,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	tabText: {
		...typography.labelLarge,
		color: colors.textSecondaryDark,
	},
	tabTextActive: {
		color: colors.primary,
	},
	listContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: 100,
		flexGrow: 1,
	},
	separator: {
		height: spacing.lg,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
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
	emptyButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
		marginTop: spacing.lg,
	},
	emptyButtonText: {
		...typography.button,
		color: colors.backgroundDark,
	},
	fab: {
		position: 'absolute',
		bottom: 100,
		right: spacing.xl,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
})
