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

const MAX_VISIBLE_AVATARS = 4

export function MatchCardComponent({ match, relation, onPress, onJoin }: MatchCardProps) {
	const { user } = useAuth()
	const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
	const matchDate = parseISO(match.starts_at)

	const formatMatchDate = () => {
		if (isToday(matchDate)) return 'Hoy'
		if (isTomorrow(matchDate)) return 'Mañana'
		return format(matchDate, 'EEEE d', { locale: es })
	}

	const isAlreadyJoined = match.participants?.some((p) => p.user_id === user?.id)

	// Usar players_needed de la DB — valor real guardado al crear/actualizar el partido
	const playersNeeded = match.players_needed ?? Math.max(0, match.total_players - (match.current_players || 0))
	const isFull = playersNeeded === 0

	// Participantes reales con datos para mostrar en el avatar stack
	const participants = match.participants ?? []
	const visibleParticipants = participants.slice(0, MAX_VISIBLE_AVATARS)
	const extraCount = participants.length - MAX_VISIBLE_AVATARS

	const isCancelled = match.status === 'cancelled'

	return (
		<>
			<TouchableOpacity style={[styles.container, isCancelled && { opacity: 0.6 }]} onPress={onPress} activeOpacity={0.9}>
				{/* Imagen + badges */}
				<ImageBackground source={getSportImage(match.sport)} style={styles.imageContainer} imageStyle={styles.image}>
					<View style={styles.imageOverlay} />

					<View style={styles.badgeContainer}>
						{/* Nivel — izquierda */}
						<View style={[styles.levelBadge, match.skill_level === 'intermedio' && styles.levelBadgeIntermediate, match.skill_level === 'avanzado' && styles.levelBadgeAdvanced]}>
							<Text style={[styles.levelText, (match.skill_level === 'intermedio' || match.skill_level === 'avanzado') && styles.levelTextDark]}>{levelLabels[match.skill_level]}</Text>
						</View>

						{/* Relación — derecha */}
						<View style={styles.topRightBadgeContainer}>
							{/* Badge de cancelado — tiene prioridad sobre los demás */}
							{match.status === 'cancelled' ? (
								<View style={[styles.createdBadge, { backgroundColor: colors.error }]}>
									<Ionicons name='close-circle' size={12} color='white' />
									<Text style={[styles.relationText, { color: 'white' }]}>Cancelado</Text>
								</View>
							) : (
								<>
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
									{relation === 'history' && (
										<View style={[styles.joinedBadge, { backgroundColor: colors.textSecondaryDark }]}>
											<Ionicons name='time' size={12} color={colors.backgroundDark} />
											<Text style={styles.relationText}>Finalizado</Text>
										</View>
									)}
								</>
							)}
						</View>
					</View>
				</ImageBackground>

				{/* Contenido */}
				<View style={styles.content}>
					{/* Título + fecha */}
					<View style={styles.header}>
						<View style={styles.titleContainer}>
							<Text style={styles.title} numberOfLines={1}>
								{match.title}
							</Text>
							<View style={styles.locationRow}>
								<Ionicons name='location' size={14} color={colors.textSecondaryDark} />
								<Text style={styles.location} numberOfLines={1}>
									{match.venue_name}
								</Text>
							</View>
						</View>
						<View style={styles.dateContainer}>
							<Text style={styles.dateText}>{formatMatchDate()}</Text>
							<Text style={[styles.dateText, { fontSize: 12, opacity: 0.8 }]}>{format(matchDate, 'HH:mm')}</Text>
						</View>
					</View>

					{/* Footer: avatars + estado + botón */}
					<View style={styles.footer}>
						<View style={styles.playersInfo}>
							{/* Avatar stack — presionables */}
							<View style={styles.avatarStack}>
								{visibleParticipants.map((p, i) => {
									const name = p.user?.full_name || ''
									const avatarUrl = p.user?.avatar_url
									return (
										<TouchableOpacity
											key={p.id}
											style={[styles.avatar, { marginLeft: i === 0 ? 0 : -8, zIndex: MAX_VISIBLE_AVATARS - i }]}
											onPress={(e) => {
												e.stopPropagation()
												setSelectedParticipant(p)
											}}
											activeOpacity={0.8}
										>
											{avatarUrl ? (
												<Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
											) : (
												<View style={styles.avatarPlaceholder}>
													<Text style={styles.avatarInitial}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
												</View>
											)}
										</TouchableOpacity>
									)
								})}
								{extraCount > 0 && (
									<View style={[styles.avatar, styles.avatarMore, { marginLeft: -8 }]}>
										<Text style={styles.avatarMoreText}>+{extraCount}</Text>
									</View>
								)}
							</View>

							{/* Texto de estado */}
							<Text style={[styles.playersText, isFull && { color: colors.success }]}>{isFull ? '¡Completo!' : `Faltan ${playersNeeded}`}</Text>
						</View>

						{/* Botón unirse / ya unido */}
						{onJoin && !isAlreadyJoined && !isFull && (
							<TouchableOpacity
								style={styles.joinButton}
								onPress={(e) => {
									e.stopPropagation()
									onJoin()
								}}
							>
								<Text style={styles.joinButtonText}>Unirme</Text>
							</TouchableOpacity>
						)}
						{isAlreadyJoined && (
							<View style={[styles.joinButton, { backgroundColor: `${colors.primary}20`, borderWidth: 1, borderColor: colors.primary }]}>
								<Text style={[styles.joinButtonText, { color: colors.primary }]}>Unido ✓</Text>
							</View>
						)}
					</View>
				</View>
			</TouchableOpacity>

			{/* Modal de participante */}
			<Modal visible={!!selectedParticipant} transparent animationType='fade' onRequestClose={() => setSelectedParticipant(null)}>
				<TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setSelectedParticipant(null)}>
					<View style={{ width: 280, backgroundColor: colors.surfaceDark, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDark }}>
						{selectedParticipant?.user?.avatar_url ? (
							<Image source={{ uri: selectedParticipant.user.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 14, borderWidth: 3, borderColor: colors.primary }} />
						) : (
							<View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceDark, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
								<Ionicons name='person' size={36} color={colors.textSecondaryDark} />
							</View>
						)}
						<Text style={{ color: colors.textPrimaryDark, fontSize: 18, fontWeight: '600' }}>{selectedParticipant?.user?.full_name || 'Invitado'}</Text>
						<Text style={{ color: colors.textSecondaryDark, marginTop: 4, fontSize: 13 }}>{selectedParticipant?.user_id ? 'Jugador registrado' : 'Invitado'}</Text>
						{selectedParticipant?.user?.skill_level && (
							<View style={{ marginTop: 10, backgroundColor: `${colors.primary}20`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
								<Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{levelLabels[selectedParticipant.user.skill_level as SkillLevel]}</Text>
							</View>
						)}
					</View>
				</TouchableOpacity>
			</Modal>
		</>
	)
}
