import { styles } from '@/assets/styles/Match.styles'
import ParticipantsMatch from '@/components/match/ParticipantsMatch'
import { TeamView } from '@/components/match/Teamview'
import Loader from '@/components/ui/Loader'
import { levelLabels } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { pushNotificationService } from '@/services/pushnotifications.service'
import { colors } from '@/theme/colors'
import { TeamSlot } from '@/types/database.types'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function MatchDetail() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [match, setMatch] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)
	const [actionLoading, setActionLoading] = useState(false)
	const [cancelling, setCancelling] = useState(false)
	// Modal para elegir equipo al unirse
	const [teamPickerVisible, setTeamPickerVisible] = useState(false)

	const loadMatch = useCallback(async () => {
		try {
			const { data, error } = await matchesService.getById(id as string)
			if (error) throw error
			if (!data) {
				setNotFound(true)
				return
			}
			setMatch(data)
		} catch (err) {
			console.error('[MatchDetail] Error:', err)
			setNotFound(true)
		} finally {
			setLoading(false)
		}
	}, [id])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			setNotFound(false)
			loadMatch()
		}, [loadMatch]),
	)

	useEffect(() => {
		if (!id) return
		const subscription = matchParticipantsService.subscribe(id as string, () => loadMatch())
		return () => subscription.unsubscribe()
	}, [id, loadMatch])

	// ── Join ──────────────────────────────────────────────────────────────
	const handleJoinPress = () => {
		if (!user || !isOpen || isFull || isParticipant) return
		if (match.team_mode === 'two_teams') {
			setTeamPickerVisible(true)
		} else {
			doJoin()
		}
	}

	const doJoin = async (teamSlot?: TeamSlot) => {
		setTeamPickerVisible(false)
		try {
			setActionLoading(true)
			const { error } = await matchParticipantsService.join(id as string, user!.id, teamSlot)
			if (error) throw error
			await loadMatch()
			// Schedule a local reminder 10 minutes before the match starts
			if (match?.starts_at) {
				pushNotificationService
					.scheduleMatchReminder(id as string, match.title, match.venue_name, new Date(match.starts_at))
					.catch((err) => console.warn('[MatchDetail] Could not schedule reminder:', err))
			}
		} catch (err) {
			console.error('[MatchDetail] Error uniéndose:', err)
			Alert.alert('Error', 'No se pudo unir al partido. Intentá de nuevo.')
		} finally {
			setActionLoading(false)
		}
	}

	// ── Leave ─────────────────────────────────────────────────────────────
	const handleLeave = async () => {
		if (!user || !isParticipant) return
		try {
			setActionLoading(true)
			const { error } = await matchParticipantsService.leave(id as string, user.id)
			if (error) throw error
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error saliendo:', err)
			Alert.alert('Error', 'No se pudo salir del partido. Intentá de nuevo.')
		} finally {
			setActionLoading(false)
		}
	}

	// ── Cancel match (creator only) ──────────────────────────────────────
	const handleCancelMatch = () => {
		Alert.alert('Cancelar partido', '¿Estás seguro? Se avisará a todos los participantes que el partido fue cancelado.', [
			{ text: 'Volver', style: 'cancel' },
			{ text: 'Sí, cancelar', style: 'destructive', onPress: confirmCancelMatch },
		])
	}

	const confirmCancelMatch = async () => {
		try {
			setCancelling(true)
			await matchesService.cancel(id as string)
			// Cancela el recordatorio local si existe
			pushNotificationService.cancelMatchReminder(id as string).catch(() => {})
			router.replace('/(protected)/(tabs)/My-Matches')
		} catch (err) {
			Alert.alert('Error', 'No se pudo cancelar el partido. Intentá de nuevo.')
			console.error('[MatchDetail] Error cancelando:', err)
		} finally {
			setCancelling(false)
		}
	}

	// ── Move player between teams (creator only) ─────────────────────────
	const handleMovePlayer = async (participantId: string, toSlot: TeamSlot) => {
		try {
			await matchParticipantsService.assignTeam(participantId, toSlot)
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error moviendo jugador:', err)
		}
	}

	if (loading) return <Loader title='Cargando detalles del partido...' />

	if (notFound || !match) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
				<Ionicons name='alert-circle-outline' size={64} color={colors.textSecondaryDark} />
				<Text style={[styles.title, { textAlign: 'center', marginTop: 16 }]}>Partido no encontrado</Text>
				<Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>Este partido ya no existe o fue cancelado.</Text>
				<TouchableOpacity style={[styles.mainButton, { marginTop: 32, paddingHorizontal: 24 }]} onPress={() => router.replace('/Explore')}>
					<Text style={styles.mainButtonText}>Volver a Explorar</Text>
				</TouchableOpacity>
			</View>
		)
	}

	const currentPlayers = match.participants?.length ?? 0
	const playersNeeded = Math.max(0, match.total_players - currentPlayers)
	const isFull = playersNeeded === 0
	const isOpen = match.status === 'open'
	const isCancelled = match.status === 'cancelled'
	const isCreator = match.creator_id === user?.id
	const isParticipant = match.participants?.some((p: any) => p.user_id === user?.id) ?? false
	const hasTeams = match.team_mode === 'two_teams'
	const matchDate = parseISO(match.starts_at)

	const perTeam = Math.floor(match.total_players / 2)
	const teamAFull = match.participants?.filter((p: any) => p.team_slot === 'A').length >= perTeam
	const teamBFull = match.participants?.filter((p: any) => p.team_slot === 'B').length >= perTeam

	return (
		<View style={styles.container}>
			<ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
				{/* Imagen de portada */}
				<ImageBackground source={getSportImage(match.sport)} style={styles.headerImage}>
					<SafeAreaView style={styles.headerButtons}>
						<TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={24} color='white' />
						</TouchableOpacity>
						{isCreator && !isCancelled && (
							<TouchableOpacity style={styles.iconButton} onPress={() => router.push({ pathname: '/match/Edit_match', params: { id: id as string } })}>
								<Ionicons name='pencil' size={20} color='white' />
							</TouchableOpacity>
						)}
					</SafeAreaView>
				</ImageBackground>

				<View style={styles.contentContainer}>
					{/* Banner de partido cancelado */}
					{isCancelled && (
						<View style={localStyles.cancelledBanner}>
							<Ionicons name='close-circle' size={20} color={colors.error} />
							<Text style={localStyles.cancelledBannerText}>Este partido fue cancelado</Text>
						</View>
					)}

					<Text style={styles.title}>{match.title}</Text>
					<Text style={styles.subtitle}>{match.venue_name}</Text>

					{/* Modo equipos badge */}
					{hasTeams && (
						<View style={localStyles.teamsBadge}>
							<Ionicons name='people' size={14} color={colors.primary} />
							<Text style={localStyles.teamsBadgeText}>Partido con equipos</Text>
						</View>
					)}

					{/* Stats */}
					<View style={styles.statsRow}>
						<View style={styles.statItem}>
							<Ionicons name='time-outline' size={20} color={colors.primary} />
							<Text style={styles.statText}>
								{format(matchDate, 'dd/MM')} · {format(matchDate, 'HH:mm')}
							</Text>
						</View>
						<View style={[styles.statItem, styles.statBorder]}>
							<Ionicons name='stats-chart' size={20} color={colors.primary} />
							<Text style={styles.statText}>{levelLabels[match.skill_level as keyof typeof levelLabels] ?? match.skill_level}</Text>
						</View>
						<View style={styles.statItem}>
							<Ionicons name='people-outline' size={20} color={colors.primary} />
							<Text style={styles.statText}>
								{currentPlayers}/{match.total_players}
							</Text>
							{playersNeeded > 0 && <Text style={[styles.statText, { color: colors.warning, marginLeft: 2 }]}>({playersNeeded} faltan)</Text>}
							{isFull && <Text style={[styles.statText, { color: colors.success, marginLeft: 2 }]}>✓ completo</Text>}
						</View>
					</View>

					{/* Jugadores / Equipos */}
					{hasTeams ? (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Equipos</Text>
							<TeamView participants={match.participants ?? []} totalPlayers={match.total_players} currentUserId={user?.id} isCreator={isCreator} canManage={isCreator} onMovePlayer={isCreator ? handleMovePlayer : undefined} />
						</View>
					) : (
						<ParticipantsMatch match={match} />
					)}

					{/* Ubicación */}
					<View style={styles.mapContainer}>
						<View style={styles.mapOverlay}>
							<Ionicons name='location' size={24} color={colors.primary} />
							<Text style={styles.mapText}>{match.venue_address || match.venue_name}</Text>
						</View>
					</View>

					{match.description ? (
						<View style={[styles.section, { marginTop: 8 }]}>
							<Text style={styles.sectionTitle}>Observaciones</Text>
							<Text style={styles.subtitle}>{match.description}</Text>
						</View>
					) : null}
				</View>
			</ScrollView>

			{/* Footer */}
			<View style={styles.footer}>
				{isCancelled ? (
					<View style={localStyles.cancelledFooter}>
						<Ionicons name='close-circle-outline' size={20} color={colors.textSecondaryDark} />
						<Text style={localStyles.cancelledFooterText}>Partido cancelado</Text>
					</View>
				) : isCreator ? (
					<View style={localStyles.creatorActions}>
						<TouchableOpacity style={styles.mainButton} onPress={() => router.push({ pathname: '/match/Edit_match', params: { id: id as string } })}>
							<Text style={styles.mainButtonText}>Editar partido</Text>
						</TouchableOpacity>
						{(isOpen || match.status === 'full') && (
							<TouchableOpacity style={localStyles.cancelButton} onPress={handleCancelMatch} disabled={cancelling}>
								{cancelling ? (
									<ActivityIndicator color={colors.error} size='small' />
								) : (
									<>
										<Ionicons name='close-circle-outline' size={20} color={colors.error} />
										<Text style={localStyles.cancelButtonText}>Cancelar partido</Text>
									</>
								)}
							</TouchableOpacity>
						)}
					</View>
				) : isParticipant ? (
					<TouchableOpacity style={[styles.mainButton, { backgroundColor: colors.error }]} onPress={handleLeave} disabled={actionLoading}>
						{actionLoading ? <ActivityIndicator color='white' /> : <Text style={styles.mainButtonText}>Salir del partido</Text>}
					</TouchableOpacity>
				) : (
					<TouchableOpacity style={[styles.mainButton, (!isOpen || isFull) && { backgroundColor: '#555' }]} disabled={!isOpen || isFull || actionLoading} onPress={handleJoinPress}>
						{actionLoading ? <ActivityIndicator color='white' /> : isFull ? <Text style={styles.mainButtonText}>Partido completo</Text> : <Text style={styles.mainButtonText}>{hasTeams ? 'Elegir equipo y unirme' : 'Unirme al partido'}</Text>}
					</TouchableOpacity>
				)}
			</View>

			{/* Team picker modal */}
			<Modal visible={teamPickerVisible} transparent animationType='fade' onRequestClose={() => setTeamPickerVisible(false)}>
				<TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setTeamPickerVisible(false)}>
					<View style={localStyles.teamPickerSheet}>
						<Text style={localStyles.teamPickerTitle}>¿A qué equipo te unís?</Text>
						<Text style={localStyles.teamPickerSub}>Elegí tu equipo para este partido</Text>

						<TouchableOpacity style={[localStyles.teamPickerBtn, { backgroundColor: `${colors.info}18`, borderColor: `${colors.info}40` }, teamAFull && localStyles.teamPickerBtnDisabled]} onPress={() => !teamAFull && doJoin('A')} disabled={teamAFull || actionLoading}>
							<View style={[localStyles.teamPickerDot, { backgroundColor: colors.info }]} />
							<View style={{ flex: 1 }}>
								<Text style={[localStyles.teamPickerBtnLabel, { color: colors.info }]}>Equipo A</Text>
								{teamAFull && <Text style={localStyles.teamPickerBtnSub}>Equipo completo</Text>}
							</View>
							{!teamAFull && <Ionicons name='chevron-forward' size={20} color={colors.info} />}
						</TouchableOpacity>

						<TouchableOpacity style={[localStyles.teamPickerBtn, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b40' }, teamBFull && localStyles.teamPickerBtnDisabled]} onPress={() => !teamBFull && doJoin('B')} disabled={teamBFull || actionLoading}>
							<View style={[localStyles.teamPickerDot, { backgroundColor: '#f59e0b' }]} />
							<View style={{ flex: 1 }}>
								<Text style={[localStyles.teamPickerBtnLabel, { color: '#f59e0b' }]}>Equipo B</Text>
								{teamBFull && <Text style={localStyles.teamPickerBtnSub}>Equipo completo</Text>}
							</View>
							{!teamBFull && <Ionicons name='chevron-forward' size={20} color='#f59e0b' />}
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	)
}

const localStyles = StyleSheet.create({
	cancelledBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.error}15`,
		borderWidth: 1,
		borderColor: `${colors.error}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginBottom: 12,
	},
	cancelledBannerText: {
		color: colors.error,
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	cancelledFooter: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 16,
	},
	cancelledFooterText: {
		color: colors.textSecondaryDark,
		fontSize: 15,
		fontWeight: '600',
	},
	creatorActions: {
		gap: 10,
		width: '100%',
	},
	cancelButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 14,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: `${colors.error}40`,
		backgroundColor: `${colors.error}12`,
	},
	cancelButtonText: {
		color: colors.error,
		fontSize: 15,
		fontWeight: '600',
	},
	teamsBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		alignSelf: 'flex-start',
		backgroundColor: `${colors.primary}15`,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
		paddingHorizontal: 10,
		paddingVertical: 3,
		marginTop: 6,
		marginBottom: 4,
	},
	teamsBadgeText: {
		color: colors.primary,
		fontSize: 12,
		fontWeight: '600',
	},
	teamPickerSheet: {
		width: '100%',
		backgroundColor: colors.surfaceDark,
		borderRadius: 20,
		padding: 24,
		gap: 12,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	teamPickerTitle: {
		color: colors.textPrimaryDark,
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
	},
	teamPickerSub: {
		color: colors.textSecondaryDark,
		fontSize: 13,
		textAlign: 'center',
		marginBottom: 4,
	},
	teamPickerBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: 14,
		padding: 16,
	},
	teamPickerBtnDisabled: {
		opacity: 0.4,
	},
	teamPickerDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	teamPickerBtnLabel: {
		fontSize: 16,
		fontWeight: '700',
	},
	teamPickerBtnSub: {
		color: colors.textSecondaryDark,
		fontSize: 12,
		marginTop: 2,
	},
})
