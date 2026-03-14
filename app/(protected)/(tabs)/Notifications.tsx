import { styles } from '@/assets/styles/Notification.styles'
import { NotificationItem } from '@/components/NotificationItem'
import { useNotifications } from '@/context/NotificationsContext'
import { supabase } from '@/lib/supabase'
import { colors } from '@/theme/colors'
import { Notification } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
	const { refreshCount } = useNotifications()
	const [notifications, setNotifications] = useState<Notification[]>([])

	useEffect(() => {
		loadNotifications()
	}, [])

	const loadNotifications = async () => {
		const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })

		setNotifications(data || [])
		refreshCount()
	}

	const handlePress = async (notification: Notification) => {
		try {
			const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
			if (error) throw error
			setNotifications(data || [])
		} catch (err) {
			console.error('[Notifications] Error:', err)
		}
	}

	const renderItem = ({ item }: { item: Notification }) => <NotificationItem item={item} onPress={() => handlePress(item)} />

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Notificaciones</Text>
			</View>

			<FlatList
				data={notifications}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Ionicons name='notifications-outline' size={80} color={colors.textSecondaryDark} />
						<Text style={styles.emptyTitle}>Sin notificaciones</Text>
						<Text style={styles.emptyText}>Cuando tengas actividad aparecerá aquí.</Text>
					</View>
				}
			/>
		</SafeAreaView>
	)
}
