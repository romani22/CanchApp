import { styles } from '@/assets/styles/Match.styles'
import { MatchResultCard } from '@/components/match/MatchResultCard'
import ParticipantsMatch from '@/components/match/ParticipantsMatch'
import { TeamView } from '@/components/match/TeamView'
import Loader from '@/components/ui/Loader'
import { estimateMatchEnd, levelLabels } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { matchResultsService } from '@/services/matchResults.service'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { pushNotificationService } from '@/services/pushnotifications.service'
import { requestsService } from '@/services/requests.service'
import { colors } from '@/theme/colors'
import { JoinRequest, MatchResultWithPlayers, MatchWithCreator, TeamMode, TeamSlot } from '@/types/database.types'
import { getSportImage } from '@/utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, isPast, parseISO } from 'date-fns'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function MatchDetail() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [match, setMatch] = useState<MatchWithCreator | null>(null)
	const [result, setResult] = useState<MatchResultWithPlayers | null>(null)
	// Mi solicitud en este partido, en cualquier estado (null = nunca pedí entrar).
	const [myRequest, setMyRequest] = useState<JoinRequest | null>(null)
	// Solicitudes pendientes que tiene que responder el creador.
	const [pendingCount, setPendingCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)
	const [actionLoading, setActionLoading] = useState(false)
	const [cancelling, setCancelling] = useState(false)
	// Modal para elegir equipo al unirse
	const [teamPickerVisible, setTeamPickerVisible] = useState(false)

	const loadMatch = useCallback(async () => {
		try {
			const [{ data, error }, resultData] = await Promise.all([
				matchesService.getById(id as string),
				// El resultado puede no existir todavía: es null hasta que el creador
				// lo carga, y un error acá no tiene que tirar abajo el detalle.
				matchResultsService.getByMatchId(id as string).catch((err) => {
					console.warn('[MatchDetail] No se pudo cargar el resultado:', err)
					return null
				}),
			])

			if (error) throw error
			if (!data) {
				setNotFound(true)
				return
			}
			setMatch(data)
			setResult(resultData)

			if (!user) return

			// Al creador le interesa cuántas solicitudes tiene esperando; al resto, si
			// la suya sigue pendiente. Son consultas distintas: la lista completa del
			// partido sólo la puede leer el creador (RLS de join_requests).
			if (data.creator_id === user.id) {
				const pending = await requestsService.getMatch(id as string).catch(() => [])
				setPendingCount(pending.length)
			} else {
				const mine = await requestsService.getMine(id as string, user.id).catch(() => null)
				setMyRequest(mine)
			}
		} catch (err) {
			console.error('[MatchDetail] Error:', err)
			setNotFound(true)
		} finally {
			setLoading(false)
		}
	}, [id, user])

	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			setNotFound(false)
			loadMatch()
		}, [loadMatch]),
	)

	useEffect(() => {
		if (!id) return
		const participants = matchParticipantsService.subscribe(id as string, () => loadMatch())
		// Para que a los jugadores les aparezca el resultado en cuanto el creador lo
		// carga, sin salir y volver a entrar a la pantalla.
		const results = matchResultsService.subscribe(id as string, () => loadMatch())
		// Y para que el creador vea llegar las solicitudes, y el que pidió entrar vea
		// la respuesta, sin refrescar.
		const requests = requestsService.subscribe(id as string, () => loadMatch())
		return () => {
			participants.unsubscribe()
			results.unsubscribe()
			requests.unsubscribe()
		}
	}, [id, loadMatch])

	// Derivados que necesitan los hooks de abajo. Van acá arriba porque los early
	// returns del render (loading / notFound) están después: un hook no puede
	// quedar detrás de un return condicional.
	const isParticipant = !!user && (match?.participants?.some((p) => p.user_id === user.id) ?? false)
	const hasPendingRequest = myRequest?.status === 'pending'
	const wasRejected = myRequest?.status === 'rejected'

	// Recordatorio local del partido. Antes se programaba al apretar "Unirme", que
	// ahora sólo manda una solicitud: el momento en que el jugador está realmente
	// adentro es cuando abre un partido al que ya lo aceptaron.
	const matchId = match?.id
	const matchTitle = match?.title
	const matchVenue = match?.venue_name
	const matchStartsAt = match?.starts_at
	const matchStatus = match?.status

	useEffect(() => {
		if (!isParticipant || !matchId || !matchStartsAt || !matchTitle || !matchVenue) return
		if (matchStatus === 'cancelled' || isPast(parseISO(matchStartsAt))) return

		let stale = false
		// cancelar y volver a programar: scheduleMatchReminder no deduplica, así que
		// sin esto cada apertura del partido dejaría un recordatorio más.
		pushNotificationService
			.cancelMatchReminder(matchId)
			.then(() => {
				if (stale) return
				return pushNotificationService.scheduleMatchReminder(matchId, matchTitle, matchVenue, new Date(matchStartsAt))
			})
			.catch((err) => console.warn('[MatchDetail] No se pudo programar el recordatorio:', err))

		return () => {
			stale = true
		}
	}, [isParticipant, matchId, matchTitle, matchVenue, matchStartsAt, matchStatus])

	// Aviso de "cargá el resultado", sólo para el creador. Se programa al crear el
	// partido; acá se reasegura (por si lo creó en otro dispositivo o cambió la
	// fecha) y se cancela en cuanto el resultado existe o el partido se cancela.
	const isCreatorOfMatch = !!user && !!match && match.creator_id === user.id
	const hasResult = !!result
	const matchSport = match?.sport

	useEffect(() => {
		if (!isCreatorOfMatch || !matchId || !matchStartsAt || !matchTitle || !matchSport) return

		if (hasResult || matchStatus === 'cancelled') {
			pushNotificationService.cancelResultReminder(matchId).catch(() => {})
			return
		}

		let stale = false
		pushNotificationService
			.cancelResultReminder(matchId)
			.then(() => {
				if (stale) return
				return pushNotificationService.scheduleResultReminder(matchId, matchTitle, estimateMatchEnd(matchSport, parseISO(matchStartsAt)))
			})
			.catch((err) => console.warn('[MatchDetail] No se pudo programar el aviso de resultado:', err))

		return () => {
			stale = true
		}
	}, [isCreatorOfMatch, matchId, matchTitle, matchSport, matchStartsAt, matchStatus, hasResult])

	// ── Solicitar entrar ──────────────────────────────────────────────────
	// Nadie se anota solo: se pide entrar y el creador acepta o rechaza. Antes esto
	// insertaba directo en match_participants, así que cualquiera que viera el
	// partido en Explorar se metía sin que el creador pudiera decir nada.
	const handleJoinPress = () => {
		if (!match || !user || !isOpen || isFull || isParticipant || hasPendingRequest) return
		if (match.team_mode === 'two_teams') {
			setTeamPickerVisible(true)
		} else {
			doRequestJoin()
		}
	}

	const doRequestJoin = async (teamSlot?: TeamSlot) => {
		setTeamPickerVisible(false)
		try {
			setActionLoading(true)
			await requestsService.createJoin(id as string, user!.id, undefined, teamSlot)
			await loadMatch()
			Alert.alert('Solicitud enviada', 'El creador del partido tiene que aceptarte. Te avisamos cuando responda.')
		} catch (err) {
			console.error('[MatchDetail] Error solicitando unirse:', err)
			Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar la solicitud. Intentá de nuevo.')
		} finally {
			setActionLoading(false)
		}
	}

	const handleCancelRequest = async () => {
		if (!myRequest) return
		try {
			setActionLoading(true)
			await requestsService.cancel(myRequest.id)
			setMyRequest(null)
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error cancelando solicitud:', err)
			Alert.alert('Error', 'No se pudo cancelar la solicitud. Intentá de nuevo.')
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
			// Cancela los avisos locales si existen: un partido cancelado no empieza ni
			// necesita resultado.
			pushNotificationService.cancelMatchReminder(id as string).catch(() => {})
			pushNotificationService.cancelResultReminder(id as string).catch(() => {})
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
	const hasTeams = match.team_mode === 'two_teams'
	const matchDate = parseISO(match.starts_at)
	// end_time quedó como TIME desde el schema inicial (006 sólo migró la fecha y la
	// hora de inicio a starts_at), así que el único corte confiable es starts_at.
	const hasEnded = isPast(matchDate)

	const perTeam = Math.floor(match.total_players / 2)
	const teamAFull = (match.participants?.filter((p) => p.team_slot === 'A').length ?? 0) >= perTeam
	const teamBFull = (match.participants?.filter((p) => p.team_slot === 'B').length ?? 0) >= perTeam

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

					{/* Acá iba un recuadro con el pin y el nombre de la cancha. Era el
					    marco de un mapa que nunca se dibujó, así que sólo repetía el
					    venue_name que ya está arriba del título. Se saca hasta que haya
					    mapa de verdad. */}

					{/* Solicitudes pendientes — sólo las ve el creador */}
					{isCreator && pendingCount > 0 && !isCancelled && (
						<TouchableOpacity style={localStyles.requestsBanner} onPress={() => router.push({ pathname: '/match/requests', params: { id: id as string } })}>
							<Ionicons name='person-add' size={20} color={colors.primary} />
							<Text style={localStyles.requestsBannerText}>
								{pendingCount} {pendingCount === 1 ? 'jugador quiere' : 'jugadores quieren'} unirse
							</Text>
							<Ionicons name='chevron-forward' size={18} color={colors.primary} />
						</TouchableOpacity>
					)}

					{/* Estado de mi solicitud */}
					{!isCreator && !isParticipant && hasPendingRequest && (
						<View style={localStyles.requestPendingBanner}>
							<Ionicons name='hourglass-outline' size={18} color={colors.warning} />
							<Text style={localStyles.pendingResultText}>Tu solicitud está esperando la respuesta del creador.</Text>
						</View>
					)}

					{!isCreator && !isParticipant && wasRejected && (
						<View style={localStyles.requestRejectedBanner}>
							<Ionicons name='close-circle-outline' size={18} color={colors.error} />
							<Text style={localStyles.requestRejectedText}>El creador rechazó tu solicitud. Podés volver a pedir entrar.</Text>
						</View>
					)}

					{/* Resultado — sólo existe cuando el creador lo cargó */}
					{result ? (
						<MatchResultCard result={result} sport={match.sport} teamMode={(match.team_mode as TeamMode) ?? 'none'} />
					) : hasEnded && !isCancelled ? (
						<View style={localStyles.pendingResultBanner}>
							<Ionicons name='hourglass-outline' size={18} color={colors.warning} />
							<Text style={localStyles.pendingResultText}>{isCreator ? 'El partido ya se jugó: cargá el resultado para que cuente en las estadísticas.' : 'El creador todavía no cargó el resultado.'}</Text>
						</View>
					) : null}

					{match.description ? (
						<View style={[styles.section, { marginTop: 20 }]}>
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
						{/* Un partido que ya se jugó necesita resultado, no edición. */}
						{hasEnded ? (
							<TouchableOpacity style={styles.mainButton} onPress={() => router.push({ pathname: '/match/Result', params: { id: id as string } })}>
								<Text style={styles.mainButtonText}>{result ? 'Editar resultado' : 'Cargar resultado'}</Text>
							</TouchableOpacity>
						) : (
							<>
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
							</>
						)}
					</View>
				) : isParticipant ? (
					hasEnded ? (
						<View style={localStyles.cancelledFooter}>
							<Ionicons name='checkmark-done-outline' size={20} color={colors.textSecondaryDark} />
							<Text style={localStyles.cancelledFooterText}>Partido jugado</Text>
						</View>
					) : (
						<TouchableOpacity style={[styles.mainButton, { backgroundColor: colors.error }]} onPress={handleLeave} disabled={actionLoading}>
							{actionLoading ? <ActivityIndicator color='white' /> : <Text style={styles.mainButtonText}>Salir del partido</Text>}
						</TouchableOpacity>
					)
				) : hasPendingRequest && !hasEnded ? (
					<TouchableOpacity style={localStyles.cancelButton} onPress={handleCancelRequest} disabled={actionLoading}>
						{actionLoading ? (
							<ActivityIndicator color={colors.error} size='small' />
						) : (
							<>
								<Ionicons name='close-circle-outline' size={20} color={colors.error} />
								<Text style={localStyles.cancelButtonText}>Cancelar mi solicitud</Text>
							</>
						)}
					</TouchableOpacity>
				) : (
					<TouchableOpacity style={[styles.mainButton, (!isOpen || isFull || hasEnded) && { backgroundColor: '#555' }]} disabled={!isOpen || isFull || hasEnded || actionLoading} onPress={handleJoinPress}>
						{actionLoading ? <ActivityIndicator color='white' /> : hasEnded ? <Text style={styles.mainButtonText}>Partido finalizado</Text> : isFull ? <Text style={styles.mainButtonText}>Partido completo</Text> : <Text style={styles.mainButtonText}>{hasTeams ? 'Elegir equipo y solicitar' : wasRejected ? 'Volver a solicitar' : 'Solicitar unirme'}</Text>}
					</TouchableOpacity>
				)}
			</View>

			{/* Team picker modal */}
			<Modal visible={teamPickerVisible} transparent animationType='fade' onRequestClose={() => setTeamPickerVisible(false)}>
				<TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setTeamPickerVisible(false)}>
					<View style={localStyles.teamPickerSheet}>
						<Text style={localStyles.teamPickerTitle}>¿A qué equipo querés entrar?</Text>
						<Text style={localStyles.teamPickerSub}>Si el creador te acepta, entrás en ese equipo</Text>

						<TouchableOpacity style={[localStyles.teamPickerBtn, { backgroundColor: `${colors.info}18`, borderColor: `${colors.info}40` }, teamAFull && localStyles.teamPickerBtnDisabled]} onPress={() => !teamAFull && doRequestJoin('A')} disabled={teamAFull || actionLoading}>
							<View style={[localStyles.teamPickerDot, { backgroundColor: colors.info }]} />
							<View style={{ flex: 1 }}>
								<Text style={[localStyles.teamPickerBtnLabel, { color: colors.info }]}>Equipo A</Text>
								{teamAFull && <Text style={localStyles.teamPickerBtnSub}>Equipo completo</Text>}
							</View>
							{!teamAFull && <Ionicons name='chevron-forward' size={20} color={colors.info} />}
						</TouchableOpacity>

						<TouchableOpacity style={[localStyles.teamPickerBtn, { backgroundColor: '#f59e0b18', borderColor: '#f59e0b40' }, teamBFull && localStyles.teamPickerBtnDisabled]} onPress={() => !teamBFull && doRequestJoin('B')} disabled={teamBFull || actionLoading}>
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
	requestsBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.primary}15`,
		borderWidth: 1,
		borderColor: `${colors.primary}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginTop: 20,
	},
	requestsBannerText: {
		color: colors.primary,
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	requestPendingBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.warning}15`,
		borderWidth: 1,
		borderColor: `${colors.warning}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginTop: 20,
	},
	requestRejectedBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.error}12`,
		borderWidth: 1,
		borderColor: `${colors.error}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginTop: 20,
	},
	requestRejectedText: {
		color: colors.error,
		fontSize: 13,
		flex: 1,
	},
	pendingResultBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.warning}15`,
		borderWidth: 1,
		borderColor: `${colors.warning}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginTop: 20,
	},
	pendingResultText: {
		color: colors.warning,
		fontSize: 13,
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
