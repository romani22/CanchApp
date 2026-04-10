import { styles } from '@/assets/styles/Notification.styles'
import { NotificationItem } from '@/components/NotificationItem'
import { useNotifications } from '@/context/NotificationsContext'
import { supabase } from '@/lib/supabase'
import { colors } from '@/theme/colors'
import { Notification } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
	const { refreshCount } = useNotifications()
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const loadNotifications = useCallback(async () => {
		try {
			const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
			if (error) throw error
			setNotifications(data || [])
			refreshCount()
		} catch (err) {
			console.error('[Notifications] Error cargando:', err)
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [refreshCount])

	// Recarga cada vez que la tab de notificaciones queda en foco
	useFocusEffect(
		useCallback(() => {
			loadNotifications()
		}, [loadNotifications]),
	)

	const handleRefresh = () => {
		setRefreshing(true)
		loadNotifications()
	}

	const handlePress = async (notification: Notification) => {
		if (!notification.is_read) {
			setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))
			supabase
				.from('notifications')
				.update({ is_read: true })
				.eq('id', notification.id)
				.then(({ error }) => {
					if (error) console.error('[Notifications] Error marcando leída:', error)
					else refreshCount()
				})
		}
		if ((notification.data as any)?.match_id) {
			router.push(`/match/${(notification.data as any).match_id}`)
		}
	}

	const renderItem = ({ item }: { item: Notification }) => <NotificationItem item={item} onPress={() => handlePress(item)} />

	return (
		<SafeAreaView style={styles.screenContainer} edges={['top']}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Notificaciones</Text>
			</View>
			<FlatList
				data={notifications}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
				ListEmptyComponent={
					!loading ? (
						<View style={styles.emptyContainer}>
							<Ionicons name='notifications-outline' size={80} color={colors.textSecondaryDark} />
							<Text style={styles.emptyTitle}>Sin notificaciones</Text>
							<Text style={styles.emptyText}>Cuando tengas actividad aparecerá aquí.</Text>
						</View>
					) : null
				}
			/>
		</SafeAreaView>
	)
}
