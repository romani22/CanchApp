import ParticipantsMatch from '@/app/(protected)/match/ParticipantsMatch'
import { styles } from '@/assets/styles/MatchCard.styles'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { MatchWithCreator, SkillLevel } from '@/types/database.types'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from 'react'
import { Image, ImageBackground, Modal, Text, TouchableOpacity, View } from 'react-native'

interface MatchCardProps {
	match: MatchWithCreator
	relation?: 'created' | 'joined' | 'history'
	onPress: () => void
	onJoin?: () => void
}

const levelLabels: Record<SkillLevel, string> = {
	principiante: 'Principiante',
	intermedio: 'Intermedio',
	avanzado: 'Avanzado',
}

export function MatchCardComponent({ match, relation, onPress, onJoin }: MatchCardProps) {
	const { user } = useAuth()
	const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
	const matchDate = parseISO(match.starts_at)

	const formatMatchDate = () => {
		if (isToday(matchDate)) return 'Hoy'
		if (isTomorrow(matchDate)) return 'Mañana'
		return format(matchDate, 'EEEE d', { locale: es })
	}

	const formatMatchTime = () => {
		return format(matchDate, 'HH:mm')
	}
	const isAlreadyJoined = match.participants?.some((p) => p.user_id === user?.id)
	const playersNeeded = match.total_players - (match.current_players || 0)
	// const confirmedPlayers = match.participants?.length || 1

	return (
		<>
			<TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
				{/* Image Header */}
				<ImageBackground source={getSportImage(match.sport)} style={styles.imageContainer} imageStyle={styles.image}>
					<View style={styles.imageOverlay} />
					<View style={styles.badgeContainer}>
						<View style={[styles.levelBadge, match.skill_level === 'intermedio' && styles.levelBadgeIntermediate, match.skill_level === 'avanzado' && styles.levelBadgeAdvanced]}>
							<Text style={[styles.levelText, match.skill_level === 'intermedio' && styles.levelTextDark, match.skill_level === 'avanzado' && styles.levelTextDark]}>{levelLabels[match.skill_level]}</Text>
						</View>
						<View style={styles.topRightBadgeContainer}>
							{relation === 'created' && (
								<View style={styles.createdBadge}>
									<Ionicons name='star' size={12} color={colors.backgroundDark} />
									<Text style={styles.relationText}>Creador</Text>
								</View>
							)}

							{relation === 'joined' && (
								<View style={styles.joinedBadge}>
									<Ionicons name='people' size={12} color={colors.backgroundDark} />
									<Text style={styles.relationText}>Unido</Text>
								</View>
							)}
						</View>
					</View>
				</ImageBackground>

				{/* Content */}
				<View style={styles.content}>
					<View style={styles.header}>
						<View style={styles.titleContainer}>
							<Text style={styles.title} numberOfLines={1}>
								{match.title}
							</Text>
							<View style={styles.locationRow}>
								<Ionicons name='location' size={16} color={colors.textSecondaryDark} />
								<Text style={styles.location} numberOfLines={1}>
									{match.venue_name}
								</Text>
							</View>
						</View>
						<View style={styles.dateContainer}>
							<Text style={styles.dateText}>
								{formatMatchDate()}, {formatMatchTime()}
							</Text>
						</View>
					</View>

					{/* Footer */}
					<View style={styles.footer}>
						<View style={styles.playersInfo}>
							{/* Avatar Stack */}
							<View style={styles.avatarStack}>
								<ParticipantsMatch match={match} card={true} />
							</View>
							<Text style={styles.playersText}>{playersNeeded > 0 ? `Faltan ${playersNeeded} jugadores` : 'Completo'}</Text>
						</View>
					</View>
					<View style={styles.footer}>
						{onJoin && !isAlreadyJoined && playersNeeded > 0 && (
							<TouchableOpacity style={styles.joinButton} onPress={onJoin}>
								<Text style={styles.joinButtonText}>Unirme</Text>
							</TouchableOpacity>
						)}
						{isAlreadyJoined && (
							<View style={styles.joinButton}>
								<Text style={styles.joinButtonText}>Estás unido</Text>
							</View>
						)}
					</View>
				</View>
			</TouchableOpacity>
			<Modal visible={!!selectedParticipant} transparent animationType='fade' onRequestClose={() => setSelectedParticipant(null)}>
				<TouchableOpacity
					style={{
						flex: 1,
						backgroundColor: 'rgba(0,0,0,0.6)',
						justifyContent: 'center',
						alignItems: 'center',
					}}
					activeOpacity={1}
					onPress={() => setSelectedParticipant(null)}
				>
					<View
						style={{
							width: 280,
							backgroundColor: '#1E1E1E',
							borderRadius: 16,
							padding: 20,
							alignItems: 'center',
						}}
					>
						{selectedParticipant?.user?.avatar_url && (
							<Image
								source={{ uri: selectedParticipant.user.avatar_url }}
								style={{
									width: 80,
									height: 80,
									borderRadius: 40,
									marginBottom: 12,
								}}
							/>
						)}

						<Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{selectedParticipant?.guest_name || selectedParticipant?.user?.full_name || 'Invitado'}</Text>

						<Text style={{ color: '#aaa', marginTop: 4 }}>Jugador del partido</Text>
					</View>
				</TouchableOpacity>
			</Modal>
		</>
	)
}
