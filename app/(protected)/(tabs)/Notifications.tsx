import { styles } from '@/assets/styles/Notification.styles'
import { NotificationItem } from '@/components/NotificationItem'
import { useNotifications } from '@/context/NotificationsContext'
import { supabase } from '@/lib/supabase'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type Notification = {
	id: string
	type: string
	title: string
	body: string
	data: any
	is_read: boolean
	created_at: string
}

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
		if (!notification.is_read) {
			await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
		}

		// Navegación según tipo
		if (notification.data?.match_id) {
			router.push(`/match/${notification.data.match_id}`)
		}

		refreshCount()
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
