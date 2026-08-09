import { TEAM_CONFIG, levelForSport, levelLabels } from '@/constants/matches'
import { requestsService } from '@/services/requests.service'
import { colors } from '@/theme/colors'
import { JoinRequestWithUser } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

/**
 * Esta pantalla estaba escrita con `className` de NativeWind, que nunca funcionó:
 * el proyecto no tiene metro.config.js con withNativeWind() ni el preset de babel,
 * así que las clases se ignoraban y todo salía sin estilo, apilado y en blanco.
 *
 * Se pasó a StyleSheet en vez de configurar NativeWind por dos motivos. Era el
 * único archivo vivo que usaba className — los otros seis pertenecen al sistema
 * muerto de match_players o son componentes que no importa nadie. Y sus clases eran
 * de tema claro (bg-white, text-gray-900) dentro de una app oscura: activando
 * NativeWind habría quedado blanca sobre blanca, mal de otra forma.
 */
export default function MatchRequestsScreen() {
	const { id } = useLocalSearchParams()
	const [requests, setRequests] = useState<JoinRequestWithUser[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [processingId, setProcessingId] = useState<string | null>(null)

	// useCallback para poder declararla como dependencia del efecto sin recrear la
	// suscripción en cada render. Sólo depende de `id`, que el efecto ya observaba.
	const loadRequests = useCallback(async () => {
		try {
			setLoading(true)
			const data = await requestsService.getMatch(id as string)
			setRequests(data)
		} catch (error) {
			console.error('Error loading requests:', error)
			Alert.alert('Error', 'No se pudieron cargar las solicitudes')
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}, [id])

	useEffect(() => {
		loadRequests()

		// Suscribirse a cambios en tiempo real
		const subscription = requestsService.subscribe(id as string, () => {
			loadRequests()
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [id, loadRequests])

	const handleAccept = async (requestId: string, userName: string) => {
		Alert.alert('Aceptar solicitud', `¿Quieres aceptar a ${userName}?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Aceptar',
				onPress: async () => {
					try {
						setProcessingId(requestId)
						await requestsService.accept(requestId)
						Alert.alert('¡Listo!', `${userName} se unió al partido`)
						loadRequests()
					} catch (error: any) {
						Alert.alert('Error', error.message || 'No se pudo aceptar la solicitud')
					} finally {
						setProcessingId(null)
					}
				},
			},
		])
	}

	const handleReject = async (requestId: string, userName: string) => {
		Alert.alert('Rechazar solicitud', `¿Estás seguro de rechazar a ${userName}?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Rechazar',
				style: 'destructive',
				onPress: async () => {
					try {
						setProcessingId(requestId)
						await requestsService.reject(requestId)
						Alert.alert('Rechazado', `Se rechazó la solicitud de ${userName}`)
						loadRequests()
					} catch (error: any) {
						Alert.alert('Error', error.message || 'No se pudo rechazar la solicitud')
					} finally {
						setProcessingId(null)
					}
				},
			},
		])
	}

	const onRefresh = () => {
		setRefreshing(true)
		loadRequests()
	}

	const header = (
		<Stack.Screen
			options={{
				headerShown: true,
				title: 'Solicitudes',
				headerBackTitle: 'Atrás',
				headerStyle: { backgroundColor: colors.surfaceDark },
				headerTintColor: colors.textPrimaryDark,
			}}
		/>
	)

	if (loading) {
		return (
			<View style={styles.centered}>
				{header}
				<ActivityIndicator size='large' color={colors.primary} />
			</View>
		)
	}

	return (
		<>
			{/* headerShown explícito: el Stack de (protected) los oculta a todos, así
			    que sin esto la pantalla quedaba sin botón de volver. Antes nadie
			    navegaba acá, ahora el detalle del partido sí. */}
			{header}

			<ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
				{requests.length === 0 ? (
					<View style={styles.empty}>
						<Ionicons name='people-outline' size={64} color={colors.textSecondaryDark} />
						<Text style={styles.emptyTitle}>No hay solicitudes pendientes</Text>
						<Text style={styles.emptySubtitle}>Aquí aparecerán cuando alguien quiera unirse</Text>
					</View>
				) : (
					<>
						<View style={styles.summary}>
							<Ionicons name='information-circle' size={20} color={colors.primary} />
							<Text style={styles.summaryText}>
								{requests.length === 1 ? 'Tenés 1 solicitud pendiente' : `Tenés ${requests.length} solicitudes pendientes`}
							</Text>
						</View>

						{requests.map((request) => {
							// Mismo motivo que en RequestCard: full_name puede venir null y acá
							// además se interpola en el texto del Alert.
							const nombre = request.user?.full_name?.trim() || 'Jugador'
							return <RequestCard key={request.id} request={request} onAccept={() => handleAccept(request.id, nombre)} onReject={() => handleReject(request.id, nombre)} isProcessing={processingId === request.id} />
						})}
					</>
				)}
			</ScrollView>
		</>
	)
}

interface RequestCardProps {
	request: JoinRequestWithUser
	onAccept: () => void
	onReject: () => void
	isProcessing: boolean
}

function RequestCard({ request, onAccept, onReject, isProcessing }: RequestCardProps) {
	// El tipo declara `user: Profile` con `rating: number`, pero eso describe el
	// esquema ideal, no lo que llega. En la base rating, full_name y total_matches
	// son nulables, y el embed `match:matches(*)` devuelve null si RLS oculta la
	// fila. Cualquiera de esos nulls hacía explotar el render — y un error de render
	// en release no muestra pantalla roja: se lleva la app entera.
	const user = request.user
	const nombre = user?.full_name?.trim() || 'Jugador'
	const inicial = nombre.charAt(0).toUpperCase()
	const rating = typeof user?.rating === 'number' ? user.rating : null
	const partidos = user?.total_matches ?? 0
	const deporte = request.match?.sport
	const nivel = deporte ? levelForSport(user?.sport_levels, deporte) : null
	const equipo = request.team_slot ? TEAM_CONFIG[request.team_slot] : null

	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				{user?.avatar_url ? (
					<Image source={{ uri: user.avatar_url }} style={styles.avatar} />
				) : (
					<View style={[styles.avatar, styles.avatarFallback]}>
						<Text style={styles.avatarInitial}>{inicial}</Text>
					</View>
				)}

				<View style={styles.identity}>
					<Text style={styles.name} numberOfLines={1}>
						{nombre}
					</Text>
					<View style={styles.metaRow}>
						{/* Sin calificaciones todavía no se muestra la estrella: un "0.0" se
						    lee como mala reputación, y es lo contrario — es que nadie lo
						    calificó aún. */}
						{rating !== null && (
							<>
								<Ionicons name='star' size={13} color={colors.warning} />
								<Text style={styles.metaStrong}>{rating.toFixed(1)}</Text>
							</>
						)}
						<Text style={styles.meta}>
							{partidos} {partidos === 1 ? 'partido' : 'partidos'}
						</Text>
					</View>
				</View>

				<View style={styles.badges}>
					{/* Nivel en el deporte del partido al que se está postulando. */}
					{nivel && (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{levelLabels[nivel]}</Text>
						</View>
					)}

					{/* Equipo que pidió: si se acepta, entra en ese equipo (022). */}
					{equipo && (
						<View style={[styles.badge, { backgroundColor: equipo.bg, borderColor: equipo.border }]}>
							<Text style={[styles.badgeText, { color: equipo.color }]}>{equipo.label}</Text>
						</View>
					)}
				</View>
			</View>

			{request.message && (
				<View style={styles.message}>
					<Ionicons name='chatbubble-outline' size={15} color={colors.textSecondaryDark} />
					<Text style={styles.messageText}>{request.message}</Text>
				</View>
			)}

			<View style={styles.info}>
				<View style={styles.infoRow}>
					<Ionicons name='time-outline' size={15} color={colors.textSecondaryDark} />
					<Text style={styles.infoText}>Solicitó el {format(new Date(request.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}</Text>
				</View>

				{user?.zone && (
					<View style={styles.infoRow}>
						<Ionicons name='location-outline' size={15} color={colors.textSecondaryDark} />
						<Text style={styles.infoText}>{user.zone}</Text>
					</View>
				)}
			</View>

			<View style={styles.actions}>
				<TouchableOpacity style={[styles.actionButton, styles.rejectButton, isProcessing && styles.actionDisabled]} onPress={onReject} disabled={isProcessing}>
					<Ionicons name='close-circle' size={19} color={isProcessing ? colors.textSecondaryDark : colors.error} />
					<Text style={[styles.actionText, { color: isProcessing ? colors.textSecondaryDark : colors.error }]}>Rechazar</Text>
				</TouchableOpacity>

				<TouchableOpacity style={[styles.actionButton, styles.acceptButton, isProcessing && styles.actionDisabled]} onPress={onAccept} disabled={isProcessing}>
					{isProcessing ? (
						<ActivityIndicator color={colors.primaryForeground} size='small' />
					) : (
						<>
							<Ionicons name='checkmark-circle' size={19} color={colors.primaryForeground} />
							<Text style={[styles.actionText, { color: colors.primaryForeground }]}>Aceptar</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.backgroundDark,
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 32,
	},
	empty: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 80,
		gap: 6,
	},
	emptyTitle: {
		color: colors.textPrimaryDark,
		fontSize: 17,
		fontWeight: '600',
		marginTop: 10,
	},
	emptySubtitle: {
		color: colors.textSecondaryDark,
		fontSize: 14,
		textAlign: 'center',
	},
	summary: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: `${colors.primary}15`,
		borderWidth: 1,
		borderColor: `${colors.primary}40`,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 14,
	},
	summaryText: {
		color: colors.primary,
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	card: {
		backgroundColor: colors.surfaceDark,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: colors.borderDark,
		marginBottom: 14,
		overflow: 'hidden',
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 14,
		gap: 12,
	},
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 26,
	},
	avatarFallback: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: `${colors.primary}20`,
	},
	avatarInitial: {
		color: colors.primary,
		fontSize: 20,
		fontWeight: '700',
	},
	identity: {
		flex: 1,
		gap: 3,
	},
	name: {
		color: colors.textPrimaryDark,
		fontSize: 16,
		fontWeight: '600',
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	metaStrong: {
		color: colors.textPrimaryDark,
		fontSize: 13,
		marginRight: 4,
	},
	meta: {
		color: colors.textSecondaryDark,
		fontSize: 13,
	},
	badges: {
		alignItems: 'flex-end',
		gap: 5,
	},
	badge: {
		backgroundColor: colors.surfaceElevated,
		borderWidth: 1,
		borderColor: colors.borderDark,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
	},
	badgeText: {
		color: colors.textSecondaryDark,
		fontSize: 11,
		fontWeight: '600',
	},
	message: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 8,
		paddingHorizontal: 14,
		paddingVertical: 12,
		backgroundColor: colors.surfaceElevated,
	},
	messageText: {
		color: colors.textPrimaryDark,
		fontSize: 13,
		fontStyle: 'italic',
		flex: 1,
		lineHeight: 18,
	},
	info: {
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderDark,
		gap: 5,
	},
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	infoText: {
		color: colors.textSecondaryDark,
		fontSize: 12,
		flex: 1,
	},
	actions: {
		flexDirection: 'row',
		gap: 10,
		padding: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderDark,
	},
	actionButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 13,
		borderRadius: 12,
		borderWidth: 1,
	},
	rejectButton: {
		backgroundColor: `${colors.error}15`,
		borderColor: `${colors.error}50`,
	},
	acceptButton: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	actionDisabled: {
		opacity: 0.5,
	},
	actionText: {
		fontSize: 15,
		fontWeight: '700',
	},
})
