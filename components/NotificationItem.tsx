import { styles } from '@/assets/styles/Notification.styles'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'

interface Props {
	item: any
	onPress: () => void
}

export const NotificationItem = ({ item, onPress }: Props) => {
	const iconMap: Record<string, string> = {
		new_match: 'football-outline',
		join_request: 'person-add-outline',
		request_accepted: 'checkmark-circle-outline',
		request_rejected: 'close-circle-outline',
		match_cancelled: 'alert-circle-outline',
		tournament_invitation: 'trophy-outline',
		new_message: 'chatbubble-ellipses-outline',
	}

	return (
		<TouchableOpacity style={[styles.container, !item.is_read && styles.unreadContainer]} onPress={onPress}>
			<Ionicons name={(iconMap[item.type] || 'notifications-outline') as any} size={24} color={colors.primary} />

			<View style={styles.textContainer}>
				<Text style={styles.title}>{item.title}</Text>
				<Text style={styles.body}>{item.body}</Text>
			</View>

			{!item.is_read && <View style={styles.unreadDot} />}
		</TouchableOpacity>
	)
}
