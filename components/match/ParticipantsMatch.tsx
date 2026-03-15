import { styles } from '@/assets/styles/Match.styles'
import { colors } from '@/theme/colors'
import { MatchParticipant, MatchWithCreator, Profile } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image, Text, View } from 'react-native'

type ParticipantWithUser = MatchParticipant & { user: Profile | null; guest_name?: string | null }

interface Props {
	match: MatchWithCreator
	card?: boolean
}

const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A']

const getColorFromString = (text?: string) => {
	if (!text) return avatarColors[0]
	return avatarColors[text.charCodeAt(0) % avatarColors.length]
}

function ParticipantsMatch({ match, card = false }: Props) {
	const participants = match.participants as unknown as ParticipantWithUser[]
	const emptySlots = Math.max(0, match.total_players - participants.length - (match.players_needed || 0))

	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>Jugadores</Text>

			<View style={styles.avatarList}>
				{participants.map((p) => {
					const hasUser = !!p.user_id
					const name = p.user?.full_name || p.guest_name || ''

					// En modo card, ocultar slots sin nombre
					if (card && !name) return null

					const backgroundColor = hasUser ? colors.primary : getColorFromString(name)

					return hasUser && p.user?.avatar_url ? (
						<Image key={p.id} source={{ uri: p.user.avatar_url }} style={styles.avatar} />
					) : (
						<View key={p.id} style={[card ? styles.guestAvatarCard : styles.guestAvatar, { backgroundColor }]}>
							{name ? <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={18} color='white' />}
						</View>
					)
				})}

				{/* Slots vacíos — solo en vista de detalle, no en card */}
				{!card &&
					Array.from({ length: emptySlots }, (_, i) => (
						<View key={`empty-${i}`} style={[styles.guestAvatar, { backgroundColor: '#555' }]}>
							<Ionicons name='person' size={18} color='#888' />
						</View>
					))}
			</View>
		</View>
	)
}

export default ParticipantsMatch
