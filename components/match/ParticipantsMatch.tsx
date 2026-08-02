import { styles } from '@/assets/styles/Match.styles'
import { ParticipantModal } from '@/components/match/ParticipantModal'

import { SportLevels, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'

type ParticipantRow = {
	id: string
	user_id: string | null
	guest_name: string | null
	joined_at?: string
	user: {
		id: string
		full_name: string
		avatar_url: string | null
		rating?: number
		elo_rating?: number
		sport_levels?: SportLevels
	} | null
}

type MatchForParticipants = {
	total_players: number
	// Necesario para elegir el nivel correcto del jugador entre sus sport_levels.
	sport: SportType
	participants: ParticipantRow[]
}

interface Props {
	match: MatchForParticipants
}

const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A']

const getColorFromString = (text?: string | null) => {
	if (!text) return avatarColors[0]
	return avatarColors[text.charCodeAt(0) % avatarColors.length]
}

function ParticipantsMatch({ match }: Props) {
	const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRow | null>(null)

	const participants = match.participants ?? []
	const emptySlots = Math.max(0, match.total_players - participants.length)

	return (
		<>
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Jugadores</Text>

				<View style={[styles.avatarList, { flexWrap: 'wrap', gap: 6 }]}>
					{participants.map((p) => {
						const name = p.user?.full_name ?? p.guest_name ?? ''

						return (
							<TouchableOpacity key={p.id} onPress={() => setSelectedParticipant(p)} activeOpacity={0.75}>
								{p.user?.avatar_url ? <Image source={{ uri: p.user.avatar_url }} style={[styles.avatar, { marginRight: 0 }]} /> : <View style={[styles.guestAvatar, { marginRight: 0, backgroundColor: getColorFromString(name) }]}>{name ? <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={18} color='white' />}</View>}
							</TouchableOpacity>
						)
					})}

					{/* Slots vacíos — no son presionables */}
					{Array.from({ length: emptySlots }, (_, i) => (
						<View key={`empty-${i}`} style={[styles.guestAvatar, { marginRight: 0, backgroundColor: '#1c2620', borderWidth: 1, borderColor: '#2d3d35', borderStyle: 'dashed' }]}>
							<Ionicons name='person-add-outline' size={16} color='#3d5a4a' />
						</View>
					))}
				</View>
			</View>

			<ParticipantModal participant={selectedParticipant} sport={match.sport} onClose={() => setSelectedParticipant(null)} />
		</>
	)
}

export default ParticipantsMatch
