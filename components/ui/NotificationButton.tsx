import { useNotifications } from '@/context/NotificationsContext'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Badge } from 'react-native-paper'

export default function NotificationButton() {
	const { unreadCount } = useNotifications()
	const handlePress = () => {
		router.push('/Notifications')
	}
	return (
		<TouchableOpacity style={styles.container} onPress={handlePress}>
			<Ionicons name='notifications-outline' size={24} color='#fff' />

			{unreadCount > 0 && <Badge style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</Badge>}
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		padding: 8,
	},
	badge: {
		position: 'absolute',
		top: -2,
		right: -2,
	},
})
