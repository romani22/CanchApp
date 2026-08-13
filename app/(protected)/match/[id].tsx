import { styles } from '@/assets/styles/Match.styles'
import { MatchResultCard } from '@/components/match/MatchResultCard'
import ParticipantsMatch from '@/components/match/ParticipantsMatch'
import { TeamView } from '@/components/match/TeamView'
import Loader from '@/components/ui/Loader'
import { levelLabels } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { matchResultsService } from '@/services/matchResults.service'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { requestsService } from '@/services/requests.service'
import { colors } from '@/theme/colors'
import { JoinRequest, JoinRequestWithUser, MatchResultVote, MatchResultWithPlayers, MatchWithCreator, TeamMode, TeamSlot } from '@/types/database.types'
import { getSportImage } from '@/utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { addHours, format, isAfter, isPast, parseISO } from 'date-fns'
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
	// Invitaciones que mandó el creador y todavía nadie respondió (027). Van
	// separadas de pendingCount a propósito: son el caso inverso — acá el que tiene
	// que responder es el invitado, no el creador.
	const [pendingInvites, setPendingInvites] = useState<JoinRequestWithUser[]>([])
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)
	const [actionLoading, setActionLoading] = useState(false)
	const [cancelling, setCancelling] = useState(false)
	const [voting, setVoting] = useState(false)
	// Modal para elegir equipo al unirse
	const [teamPickerVisible, setTeamPickerVisible] = useState(false)
	// Alto real del pie fijo, para que el scroll reserve exactamente eso (ver el
	// comentario del ScrollView).
	const [footerHeight, setFooterHeight] = useState(0)

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
				// La misma consulta trae las dos direcciones desde la 027, y mezclarlas
				// haría que el banner de "quieren unirse" contara a la gente que el creador
				// invitó él mismo.
				setPendingCount(pending.filter((r) => !r.invited_by).length)
				setPendingInvites(pending.filter((r) => !!r.invited_by))
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
	// 027: join_requests guarda las dos direcciones y `invited_by` las separa. La
	// distinción no es cosmética — de ella depende qué botón se le ofrece a quién:
	// una solicitud la responde el creador, una invitación la responde el invitado.
	const isInvitation = !!myRequest?.invited_by
	const hasPendingRequest = myRequest?.status === 'pending' && !isInvitation
	const hasPendingInvitation = myRequest?.status === 'pending' && isInvitation
	// Un "rechazado" de una invitación es el propio usuario diciendo que no: no
	// corresponde mostrarle "el creador rechazó tu solicitud" ni ofrecerle reintentar.
	const wasRejected = myRequest?.status === 'rejected' && !isInvitation

	// Los recordatorios (partido que arranca, resultado que falta) ya no se programan
	// acá: los encola el servidor cada 5 minutos y llegan como cualquier otra
	// notificación. Ver 024_notifications_single_channel.sql.

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

	// ── Responder una invitación ──────────────────────────────────────────
	// El creador invita y el invitado decide: es la única forma de que alguien con
	// cuenta entre a un partido. La aprobación del creador no sirve como
	// consentimiento acá — protege el partido, no a la persona —, así que las RPC
	// del servidor se niegan a que el creador responda su propia invitación.
	const respondInvitation = async (accept: boolean) => {
		if (!myRequest) return
		try {
			setActionLoading(true)
			if (accept) {
				await requestsService.acceptInvitation(myRequest.id)
			} else {
				await requestsService.rejectInvitation(myRequest.id)
			}
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error respondiendo la invitación:', err)
			// El mensaje del servidor es útil acá: entre que la invitación se manda y se
			// responde el partido puede haberse llenado, cancelado o jugado.
			Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo responder la invitación.')
		} finally {
			setActionLoading(false)
		}
	}

	// El creador da de baja una invitación que mandó. No hay aviso al invitado: la
	// notificación que ya le llegó lo lleva al partido, y ahí se encuentra con el botón
	// de solicitar entrar como cualquier otro. Si alguna vez molesta, el lugar del
	// aviso es un trigger de DELETE, no esta función.
	const handleCancelInvitation = (invitation: JoinRequestWithUser) => {
		const nombre = invitation.user?.full_name ?? 'este jugador'
		Alert.alert('Cancelar la invitación', `¿Cancelar la invitación a ${nombre}?`, [
			{ text: 'Volver', style: 'cancel' },
			{
				text: 'Cancelar invitación',
				style: 'destructive',
				onPress: async () => {
					try {
						setActionLoading(true)
						await requestsService.cancel(invitation.id)
						await loadMatch()
					} catch (err) {
						console.error('[MatchDetail] Error cancelando la invitación:', err)
						Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cancelar la invitación.')
					} finally {
						setActionLoading(false)
					}
				},
			},
		])
	}

	const handleRejectInvitation = () => {
		Alert.alert('Rechazar la invitación', '¿Seguro que no vas a jugar este partido?', [
			{ text: 'Volver', style: 'cancel' },
			{ text: 'Rechazar', style: 'destructive', onPress: () => respondInvitation(false) },
		])
	}

	// ── Votar el resultado ────────────────────────────────────────────────
	// El que lo cargó no vota (si está mal, lo corrige). Los demás confirman u
	// objetan: sin objeciones el resultado vale igual, así que confirmar es sólo
	// señal social y objetar es lo que lo saca de las estadísticas.
	const handleVote = async (vote: MatchResultVote) => {
		if (vote === 'dispute') {
			Alert.alert('Objetar el resultado', 'El resultado deja de contar para las estadísticas hasta que quien lo cargó lo corrija. ¿Seguro?', [
				{ text: 'Volver', style: 'cancel' },
				{ text: 'Objetar', style: 'destructive', onPress: () => submitVote('dispute') },
			])
			return
		}
		await submitVote(vote)
	}

	const submitVote = async (vote: MatchResultVote) => {
		try {
			setVoting(true)
			await matchResultsService.vote(id as string, vote)
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error votando el resultado:', err)
			Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar tu voto.')
		} finally {
			setVoting(false)
		}
	}

	const handleClearVote = async () => {
		try {
			setVoting(true)
			await matchResultsService.clearVote(id as string)
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error retirando el voto:', err)
			Alert.alert('Error', 'No se pudo retirar tu voto.')
		} finally {
			setVoting(false)
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
			// No hay avisos que cancelar: el encolado del servidor mira el estado del
			// partido, y uno cancelado no entra ni en el recordatorio ni en el pedido
			// de resultado.
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

	// Pasadas 24 horas del partido, si el creador no cargó el resultado lo puede
	// cargar cualquier jugador (la RPC valida lo mismo del lado del servidor).
	const openResultWindow = isAfter(new Date(), addHours(matchDate, 24))
	const canLoadResult = !isCancelled && hasEnded && (isCreator || result?.reported_by === user?.id || (!result && isParticipant && openResultWindow))
	// Vota quien jugó el partido y no cargó el resultado: si lo cargó él y está mal,
	// lo corrige, no se objeta a sí mismo.
	const canVoteResult = !!result && isParticipant && result.reported_by !== user?.id
	const registeredPlayers = match.participants?.filter((p) => p.user_id).length ?? 0
	const voterCount = Math.max(0, registeredPlayers - (result?.reported_by ? 1 : 0))

	const perTeam = Math.floor(match.total_players / 2)
	const teamAFull = (match.participants?.filter((p) => p.team_slot === 'A').length ?? 0) >= perTeam
	const teamBFull = (match.participants?.filter((p) => p.team_slot === 'B').length ?? 0) >= perTeam

	return (
		<View style={styles.container}>
			{/* El pie es absoluto, así que tapa el final del scroll. styles.scrollContent
			    reserva 120px fijos, que alcanzan para un botón pero no para los dos del
			    creador (editar + cancelar): el banner de solicitudes quedaba debajo del
			    pie, medio tapado. No se puede subir el 120 en el estilo compartido porque
			    lo usan otras diez pantallas, y tampoco sirve un número más grande acá: la
			    altura del pie cambia según quién mira y en qué estado está el partido. Se
			    mide y listo. */}
			<ScrollView bounces={false} contentContainerStyle={[styles.scrollContent, footerHeight > 0 && { paddingBottom: footerHeight + 24 }]}>
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

					{/* Invitaciones que el creador mandó y nadie respondió todavía (027).
					    Separadas del banner de arriba porque acá el que tiene que mover
					    ficha es el invitado: al creador sólo le corresponde esperar. */}
					{isCreator && pendingInvites.length > 0 && !isCancelled && (
						<View style={localStyles.invitesPendingBox}>
							<View style={localStyles.invitesPendingHeader}>
								<Ionicons name='hourglass-outline' size={18} color={colors.warning} />
								<Text style={localStyles.invitesPendingTitle}>{pendingInvites.length === 1 ? 'Invitación sin responder' : `${pendingInvites.length} invitaciones sin responder`}</Text>
							</View>
							{pendingInvites.map((invitation) => (
								<View key={invitation.id} style={localStyles.invitesPendingRow}>
									<Text style={localStyles.invitesPendingName} numberOfLines={1}>
										{invitation.user?.full_name ?? 'Jugador'}
									</Text>
									<TouchableOpacity onPress={() => handleCancelInvitation(invitation)} disabled={actionLoading} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
										<Ionicons name='close-circle' size={22} color={colors.error} />
									</TouchableOpacity>
								</View>
							))}
						</View>
					)}

					{/* Me invitaron: acepto o rechazo yo. El creador no puede responder por
					    mí — las RPC del servidor se lo niegan, no es sólo que no vea el botón. */}
					{!isCreator && !isParticipant && hasPendingInvitation && !isCancelled && !hasEnded && (
						<View style={localStyles.invitationBanner}>
							<View style={localStyles.invitationHeader}>
								<Ionicons name='mail-open-outline' size={20} color={colors.primary} />
								<Text style={localStyles.invitationText}>{match.creator?.full_name ?? 'El creador'} te invitó a este partido</Text>
							</View>
							<View style={localStyles.invitationActions}>
								<TouchableOpacity style={[localStyles.invitationBtn, localStyles.invitationRejectBtn]} onPress={handleRejectInvitation} disabled={actionLoading}>
									<Text style={localStyles.invitationRejectText}>Rechazar</Text>
								</TouchableOpacity>
								<TouchableOpacity style={[localStyles.invitationBtn, localStyles.invitationAcceptBtn]} onPress={() => respondInvitation(true)} disabled={actionLoading}>
									{actionLoading ? <ActivityIndicator color={colors.backgroundDark} size='small' /> : <Text style={localStyles.invitationAcceptText}>Aceptar y unirme</Text>}
								</TouchableOpacity>
							</View>
						</View>
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
						<MatchResultCard result={result} sport={match.sport} teamMode={(match.team_mode as TeamMode) ?? 'none'} currentUserId={user?.id} voterCount={voterCount} canVote={canVoteResult} onVote={handleVote} onClearVote={handleClearVote} voting={voting} />
					) : hasEnded && !isCancelled ? (
						<View style={localStyles.pendingResultBanner}>
							<Ionicons name='hourglass-outline' size={18} color={colors.warning} />
							<Text style={localStyles.pendingResultText}>{isCreator ? 'El partido ya se jugó: cargá el resultado para que cuente en las estadísticas.' : openResultWindow && isParticipant ? 'El creador no cargó el resultado: ya lo podés cargar vos.' : 'El creador todavía no cargó el resultado.'}</Text>
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
			<View style={styles.footer} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
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
						// Un jugador puede cargar el resultado si pasó la ventana del creador,
						// o corregir el que él mismo cargó.
						canLoadResult ? (
							<TouchableOpacity style={styles.mainButton} onPress={() => router.push({ pathname: '/match/Result', params: { id: id as string } })}>
								<Text style={styles.mainButtonText}>{result ? 'Editar resultado' : 'Cargar resultado'}</Text>
							</TouchableOpacity>
						) : (
							<View style={localStyles.cancelledFooter}>
								<Ionicons name='checkmark-done-outline' size={20} color={colors.textSecondaryDark} />
								<Text style={localStyles.cancelledFooterText}>Partido jugado</Text>
							</View>
						)
					) : (
						<TouchableOpacity style={[styles.mainButton, { backgroundColor: colors.error }]} onPress={handleLeave} disabled={actionLoading}>
							{actionLoading ? <ActivityIndicator color='white' /> : <Text style={styles.mainButtonText}>Salir del partido</Text>}
						</TouchableOpacity>
					)
				) : hasPendingInvitation && !hasEnded ? (
					// Los botones de responder están en el banner de arriba: acá abajo iría
					// "Solicitar unirme", que para alguien ya invitado no tiene sentido.
					<View style={localStyles.cancelledFooter}>
						<Ionicons name='mail-unread-outline' size={20} color={colors.primary} />
						<Text style={[localStyles.cancelledFooterText, { color: colors.primary }]}>Tenés una invitación para responder</Text>
					</View>
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
	// Invitaciones que mandó el creador y nadie respondió. Es una lista y no una línea
	// de texto porque cada una se puede cancelar por separado.
	invitesPendingBox: {
		backgroundColor: `${colors.warning}15`,
		borderWidth: 1,
		borderColor: `${colors.warning}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginBottom: 12,
		gap: 6,
	},
	invitesPendingHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	invitesPendingTitle: {
		color: colors.warning,
		fontSize: 13,
		fontWeight: '600',
		flex: 1,
	},
	invitesPendingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingLeft: 26,
	},
	invitesPendingName: {
		color: colors.textSecondaryDark,
		fontSize: 13,
		flex: 1,
	},
	// Invitación pendiente (027). Es el único banner con acciones adentro, así que va
	// en columna en vez de en fila: los dos botones necesitan el ancho completo para
	// que "Aceptar y unirme" no se corte en pantallas angostas.
	invitationBanner: {
		backgroundColor: `${colors.primary}15`,
		borderWidth: 1,
		borderColor: `${colors.primary}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 12,
		gap: 12,
	},
	invitationHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	invitationText: {
		color: colors.primary,
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	invitationActions: {
		flexDirection: 'row',
		gap: 10,
	},
	invitationBtn: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		paddingVertical: 11,
	},
	invitationRejectBtn: {
		borderWidth: 1,
		borderColor: `${colors.error}60`,
		backgroundColor: `${colors.error}12`,
	},
	invitationRejectText: {
		color: colors.error,
		fontSize: 14,
		fontWeight: '600',
	},
	invitationAcceptBtn: {
		backgroundColor: colors.primary,
	},
	invitationAcceptText: {
		color: colors.backgroundDark,
		fontSize: 14,
		fontWeight: '700',
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
