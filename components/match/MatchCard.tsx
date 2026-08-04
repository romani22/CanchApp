import { styles } from '@/assets/styles/MatchCard.styles'
import { ParticipantModal, ParticipantSummary } from '@/components/match/ParticipantModal'
import { levelLabels } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { getSportImage } from '@/utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useState } from 'react'
import { Image, ImageBackground, Text, TouchableOpacity, View } from 'react-native'

interface MatchCardProps {
	match: MatchWithCreator
	relation?: 'created' | 'joined' | 'history'
	/**
	 * El partido ya se jugó y quien mira es el creador, que todavía no cargó el
	 * resultado. Es el mismo aviso que la notificación local, pero dentro de la app:
	 * la notificación vive en el dispositivo donde se programó, así que sin esto un
	 * cambio de teléfono deja al creador sin ningún recordatorio.
	 */
	needsResult?: boolean
	onPress: () => void
	onJoin?: () => void
}

const MAX_VISIBLE_AVATARS = 4

export function MatchCardComponent({ match, relation, needsResult, onPress, onJoin }: MatchCardProps) {
	const { user } = useAuth()
	const [selectedParticipant, setSelectedParticipant] = useState<ParticipantSummary | null>(null)
	const matchDate = parseISO(match.starts_at)

	const formatMatchDate = () => {
		if (isToday(matchDate)) return 'Hoy'
		if (isTomorrow(matchDate)) return 'Mañana'
		return format(matchDate, 'EEEE d', { locale: es })
	}

	const isAlreadyJoined = match.participants?.some((p) => p.user_id === user?.id)

	// Participantes reales con datos para mostrar en el avatar stack
	const participants = match.participants ?? []

	// Contar los participantes traídos, igual que el detalle: si la tarjeta lee la
	// columna players_needed y el detalle cuenta filas, cualquier desfase de la
	// columna hace que los dos muestren números distintos (era el caso: "Faltan 8"
	// en Explorar con un solo jugador anotado). La columna queda de respaldo para
	// consultas que no traigan la relación.
	const playersNeeded = match.participants ? Math.max(0, match.total_players - participants.length) : (match.players_needed ?? Math.max(0, match.total_players - (match.current_players || 0)))
	const isFull = playersNeeded === 0
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
							) : needsResult ? (
								// Tiene prioridad sobre "Creador": que lo creó él ya lo sabe, que le
								// falta cargar el resultado es lo que tiene que hacer.
								//
								// Va acá y no atado a relation === 'history' porque esa relación no se
								// asigna nunca: en Mis Turnos los partidos del historial conservan su
								// relación original ('created' o 'joined').
								<View style={[styles.joinedBadge, { backgroundColor: colors.warning }]}>
									<Ionicons name='clipboard' size={12} color={colors.backgroundDark} />
									<Text style={styles.relationText}>Falta resultado</Text>
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

						{/* Botón solicitar / ya unido. "Solicitar" y no "Unirme": entrar a un
						    partido pasa por la aprobación del creador, y este botón sólo
						    lleva al detalle, donde se manda la solicitud. */}
						{onJoin && !isAlreadyJoined && !isFull && (
							<TouchableOpacity
								style={styles.joinButton}
								onPress={(e) => {
									e.stopPropagation()
									onJoin()
								}}
							>
								<Text style={styles.joinButtonText}>Solicitar</Text>
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

			<ParticipantModal participant={selectedParticipant} sport={match.sport} onClose={() => setSelectedParticipant(null)} />
		</>
	)
}
