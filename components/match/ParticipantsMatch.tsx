import { styles } from '@/assets/styles/Match.styles'
import { levelLabels } from '@/constants/matches'
import { colors } from '@/theme/colors'
import { SkillLevel } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Modal, Text, TouchableOpacity, View } from 'react-native'

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
		skill_level?: SkillLevel
	} | null
}

type MatchForParticipants = {
	total_players: number
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

	const selectedName = selectedParticipant?.user?.full_name ?? selectedParticipant?.guest_name ?? 'Invitado'
	const isGuest = !selectedParticipant?.user_id
	const selectedRating = selectedParticipant?.user?.rating
	const selectedLevel = selectedParticipant?.user?.skill_level

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

			{/* Modal de participante — igual al de MatchCard */}
			<Modal visible={!!selectedParticipant} transparent animationType='fade' onRequestClose={() => setSelectedParticipant(null)}>
				<TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setSelectedParticipant(null)}>
					<View
						style={{
							width: 280,
							backgroundColor: colors.surfaceDark,
							borderRadius: 20,
							padding: 24,
							alignItems: 'center',
							borderWidth: 1,
							borderColor: colors.borderDark,
						}}
					>
						{/* Avatar */}
						{selectedParticipant?.user?.avatar_url ? (
							<Image source={{ uri: selectedParticipant.user.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 14, borderWidth: 3, borderColor: colors.primary }} />
						) : (
							<View
								style={{
									width: 80,
									height: 80,
									borderRadius: 40,
									backgroundColor: getColorFromString(selectedName),
									borderWidth: 3,
									borderColor: colors.primary,
									alignItems: 'center',
									justifyContent: 'center',
									marginBottom: 14,
								}}
							>
								{selectedName && selectedName !== 'Invitado' ? <Text style={{ fontSize: 32, fontWeight: '700', color: 'white' }}>{selectedName.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={36} color='white' />}
							</View>
						)}

						{/* Nombre */}
						<Text style={{ color: colors.textPrimaryDark, fontSize: 18, fontWeight: '600' }}>{selectedName}</Text>

						{/* Tipo */}
						<Text style={{ color: colors.textSecondaryDark, marginTop: 4, fontSize: 13 }}>{isGuest ? 'Invitado' : 'Jugador registrado'}</Text>

						{/* Nivel si existe */}
						{selectedLevel && (
							<View style={{ marginTop: 10, backgroundColor: `${colors.primary}20`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
								<Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{levelLabels[selectedLevel]}</Text>
							</View>
						)}

						{/* Rating si existe */}
						{selectedRating != null && selectedRating > 0 && (
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
								<Ionicons name='star' size={14} color='#f59e0b' />
								<Text style={{ color: colors.textSecondaryDark, fontSize: 13 }}>{selectedRating.toFixed(1)}</Text>
							</View>
						)}
					</View>
				</TouchableOpacity>
			</Modal>
		</>
	)
}

export default ParticipantsMatch
