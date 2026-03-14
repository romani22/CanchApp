import { colors } from '@/theme/colors'
import { spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderDark,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerTitle: {
		...typography.h2,
		color: colors.textPrimaryDark,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.backgroundDark,
		padding: spacing.xl,
	},
	emptyTitle: {
		...typography.h3,
		color: colors.textPrimaryDark,
		marginTop: spacing.xl,
	},
	emptyText: {
		...typography.body,
		color: colors.textSecondaryDark,
		textAlign: 'center',
		marginTop: spacing.md,
		maxWidth: 280,
	},
	unreadContainer: {
		backgroundColor: 'rgba(255,255,255,0.03)',
	},
	textContainer: {
		flex: 1,
		marginLeft: spacing.md,
	},
	title: {
		...typography.bodyBold,
		color: colors.textPrimaryDark,
	},
	body: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 2,
	},
	unreadDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.primary,
	},
})
