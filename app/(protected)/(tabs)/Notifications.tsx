import { useNotifications } from '@/context/NotificationsContext'
import { colors } from '@/theme/colors'
import { spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { Ionicons } from '@expo/vector-icons'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
	const { refreshCount } = useNotifications()
	useEffect(() => {
		refreshCount()
	})

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Chat</Text>
			</View>

			<View style={styles.emptyContainer}>
				<Ionicons name='chatbubbles-outline' size={80} color={colors.textSecondaryDark} />
				<Text style={styles.emptyTitle}>Proximamente</Text>
				<Text style={styles.emptyText}>Aqui podras chatear con los organizadores y participantes de tus partidos.</Text>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
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
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
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
})
