import { styles } from '@/assets/styles/Notification.styles'
import { NotificationItem } from '@/components/NotificationItem'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationsContext'
import { notificationsService } from '@/services/notifications.service'
import { colors } from '@/theme/colors'
import { NotificationWithData } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function NotificationsScreen() {
	const { user } = useAuth()
	const { refreshCount } = useNotifications()
	const [notifications, setNotifications] = useState<NotificationWithData[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const loadNotifications = useCallback(async () => {
		if (!user?.id) return
		try {
			const data = await notificationsService.list(user.id)
			setNotifications(data)
			refreshCount()
		} catch (err) {
			console.error('[Notifications] Error cargando:', err)
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [user?.id, refreshCount])

	useFocusEffect(
		useCallback(() => {
			loadNotifications()
		}, [loadNotifications]),
	)

	// Estando parado en esta pantalla las notificaciones nuevas tienen que aparecer
	// solas: antes había que salir y volver. Se usa la suscripción de sólo INSERT
	// para no pisar el canal que NotificationsContext ya tiene abierto para el badge.
	useEffect(() => {
		if (!user?.id) return
		const subscription = notificationsService.subscribe(user.id, () => loadNotifications())
		return () => subscription.unsubscribe()
	}, [user?.id, loadNotifications])

	const handleRefresh = () => {
		setRefreshing(true)
		loadNotifications()
	}

	const handlePress = async (notification: NotificationWithData) => {
		if (!notification.is_read) {
			setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))
			notificationsService.markAsRead(notification.id).then(() => refreshCount()).catch((err) => console.error('[Notifications] Error marcando leída:', err))
		}
		if ((notification.data as any)?.match_id) {
			router.push(`/match/${(notification.data as any).match_id}`)
		}
	}

	// Borrar una: los cambios se pintan de una y se revierten si el server falla, así
	// la lista nunca miente sobre lo que quedó guardado.
	const handleLongPress = (notification: NotificationWithData) => {
		Alert.alert('Borrar notificación', '¿Sacarla del listado?', [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Borrar',
				style: 'destructive',
				onPress: () => {
					const previous = notifications
					setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
					notificationsService
						.delete(notification.id)
						.then(() => refreshCount())
						.catch((err) => {
							console.error('[Notifications] Error borrando:', err)
							setNotifications(previous)
							Alert.alert('Error', 'No se pudo borrar la notificación.')
						})
				},
			},
		])
	}

	const handleMarkAllRead = () => {
		if (!user?.id) return
		const previous = notifications
		setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
		notificationsService
			.markAllAsRead(user.id)
			.then(() => refreshCount())
			.catch((err) => {
				console.error('[Notifications] Error marcando todas:', err)
				setNotifications(previous)
			})
	}

	const handleDeleteAll = () => {
		if (!user?.id) return
		Alert.alert('Borrar todas', 'Se van a borrar todas tus notificaciones. No se puede deshacer.', [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Borrar todas',
				style: 'destructive',
				onPress: () => {
					const previous = notifications
					setNotifications([])
					notificationsService
						.deleteAll(user.id)
						.then(() => refreshCount())
						.catch((err) => {
							console.error('[Notifications] Error borrando todas:', err)
							setNotifications(previous)
							Alert.alert('Error', 'No se pudieron borrar las notificaciones.')
						})
				},
			},
		])
	}

	const hasUnread = notifications.some((n) => !n.is_read)

	const renderItem = ({ item }: { item: NotificationWithData }) => <NotificationItem item={item} onPress={() => handlePress(item)} onLongPress={() => handleLongPress(item)} />

	return (
		<SafeAreaView style={styles.screenContainer} edges={['top']}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Notificaciones</Text>

				{notifications.length > 0 && (
					<View style={styles.headerActions}>
						{hasUnread && (
							<TouchableOpacity style={styles.headerAction} onPress={handleMarkAllRead} accessibilityLabel='Marcar todas como leídas' hitSlop={8}>
								<Ionicons name='checkmark-done-outline' size={22} color={colors.primary} />
							</TouchableOpacity>
						)}
						<TouchableOpacity style={styles.headerAction} onPress={handleDeleteAll} accessibilityLabel='Borrar todas' hitSlop={8}>
							<Ionicons name='trash-outline' size={20} color={colors.textSecondaryDark} />
						</TouchableOpacity>
					</View>
				)}
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
