import { styles } from '@/assets/styles/Match.styles'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { Image, Text, View } from 'react-native'

function ParticipantsMatch({ match }: any) {
	const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A']
	const getColorFromString = (text?: string) => {
		if (!text) return avatarColors[0]
		const index = text.charCodeAt(0) % avatarColors.length
		return avatarColors[index]
	}
	console.log(match)
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>Jugadores</Text>

			<View style={styles.avatarList}>
				<View style={styles.avatarList}>
					{match.participants.map((p: any) => {
						const hasUser = !!p.user_id
						const name = p.user?.full_name || p.guest_name || ''
						const backgroundColor = hasUser ? colors.primary : getColorFromString(name)

						return hasUser && p.user?.avatar_url ? (
							<Image key={p.id} source={{ uri: p.user.avatar_url }} style={styles.avatar} />
						) : (
							<View key={p.id} style={[styles.guestAvatar, { backgroundColor }]}>
								{name ? <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={18} color='white' />}
							</View>
						)
					})}
					{Array.from({ length: match.total_players - match.participants.length - match.players_needed }, (_, i) => (
						<View key={`empty-${i}`} style={[styles.guestAvatar, { backgroundColor: '#ccc' }]}>
							<Ionicons name='person' size={18} color='white' />
						</View>
					))}
				</View>
			</View>
		</View>
	)
}

export default ParticipantsMatch
