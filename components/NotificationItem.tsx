import { styles } from '@/assets/styles/Notification.styles'
import { colors } from '@/theme/colors'
import { Notification } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { differenceInSeconds, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Text, TouchableOpacity, View } from 'react-native'

interface Props {
	item: Notification
	onPress: () => void
	onLongPress?: () => void
}

const iconMap: Record<string, string> = {
	new_match: 'football-outline',
	join_request: 'person-add-outline',
	request_accepted: 'checkmark-circle-outline',
	request_rejected: 'close-circle-outline',
	match_cancelled: 'alert-circle-outline',
	match_reminder: 'alarm-outline',
	match_result: 'stats-chart-outline',
	tournament_invitation: 'trophy-outline',
	new_message: 'chatbubble-ellipses-outline',
}

/** "ahora", "hace 5 min", "hace 3 h", "hace 2 d". */
const relativeTime = (createdAt: string): string => {
	try {
		const date = parseISO(createdAt)
		if (differenceInSeconds(new Date(), date) < 60) return 'ahora'
		return `hace ${formatDistanceToNowStrict(date, { locale: es })}`
	} catch {
		return ''
	}
}

export const NotificationItem = ({ item, onPress, onLongPress }: Props) => {
	return (
		<TouchableOpacity style={[styles.container, !item.is_read && styles.unreadContainer]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
			<Ionicons name={(iconMap[item.type] || 'notifications-outline') as any} size={24} color={item.is_read ? colors.textSecondaryDark : colors.primary} />

			<View style={styles.textContainer}>
				<View style={styles.titleRow}>
					<Text style={[styles.title, styles.titleText]}>{item.title}</Text>
					<Text style={styles.time}>{relativeTime(item.created_at)}</Text>
				</View>
				<Text style={styles.body}>{item.body}</Text>
			</View>

			{!item.is_read && <View style={styles.unreadDot} />}
		</TouchableOpacity>
	)
}
