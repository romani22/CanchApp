import { styles } from '@/assets/styles/Match.styles'
import ParticipantsMatch from '@/components/match/ParticipantsMatch'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ImageBackground, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function MatchDetail() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [match, setMatch] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [notFound, setNotFound] = useState(false)
	const [actionLoading, setActionLoading] = useState(false)

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

	// Recarga cada vez que la pantalla queda en foco (ej: al volver de Edit)
	useFocusEffect(
		useCallback(() => {
			setLoading(true)
			loadMatch()
		}, [loadMatch]),
	)

	// Suscripción realtime a cambios de participantes
	useEffect(() => {
		if (!id) return
		const channel = supabase
			.channel(`match-detail-${id}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${id}` }, () => loadMatch())
			.subscribe()
		return () => {
			supabase.removeChannel(channel)
		}
	}, [id])

	const handleJoin = async () => {
		if (!user || !isOpen || isFull || isParticipant) return
		try {
			setActionLoading(true)
			const { error } = await matchParticipantsService.join(id as string, user.id)
			if (error) throw error
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error uniéndose:', err)
		} finally {
			setActionLoading(false)
		}
	}

	const handleLeave = async () => {
		if (!user || !isParticipant) return
		try {
			setActionLoading(true)
			const { error } = await matchParticipantsService.leave(id as string, user.id)
			if (error) throw error
			await loadMatch()
		} catch (err) {
			console.error('[MatchDetail] Error saliendo:', err)
		} finally {
			setActionLoading(false)
		}
	}

	if (loading) return <Loader title='Cargando detalles del partido...' />

	if (notFound || !match) {
		return (
			<View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
				<Ionicons name='alert-circle-outline' size={64} color={colors.textSecondaryDark} />
				<Text style={[styles.title, { textAlign: 'center', marginTop: 16 }]}>Partido no encontrado</Text>
				<Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>Este partido ya no existe o fue cancelado.</Text>
				<TouchableOpacity style={[styles.mainButton, { marginTop: 32 }]} onPress={() => router.replace('/Explore')}>
					<Text style={styles.mainButtonText}>Volver a Explorar</Text>
				</TouchableOpacity>
			</View>
		)
	}

	const currentPlayers = match.participants?.length || 0
	const isFull = currentPlayers >= match.total_players
	const isOpen = match.status === 'open'
	const isCreator = match.creator_id === user?.id
	const isParticipant = match.participants?.some((p: any) => p.user_id === user?.id)
	const matchDate = parseISO(match.starts_at)

	return (
		<View style={styles.container}>
			<ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
				<ImageBackground source={getSportImage(match.sport)} style={styles.headerImage}>
					<SafeAreaView style={styles.headerButtons}>
						<TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={24} color='white' />
						</TouchableOpacity>
						{isCreator && (
							<TouchableOpacity style={styles.iconButton} onPress={() => router.push({ pathname: '/match/Edit_match', params: { id: id as string } })}>
								<Ionicons name='pencil' size={20} color='white' />
							</TouchableOpacity>
						)}
					</SafeAreaView>
				</ImageBackground>

				<View style={styles.contentContainer}>
					<Text style={styles.title}>{match.title}</Text>
					<Text style={styles.subtitle}>{match.venue_name}</Text>

					<View style={styles.statsRow}>
						<View style={styles.statItem}>
							<Ionicons name='time-outline' size={20} color={colors.primary} />
							<Text style={styles.statText}>{format(matchDate, 'dd/MM/yyyy HH:mm')}</Text>
						</View>
						<View style={[styles.statItem, styles.statBorder]}>
							<Ionicons name='stats-chart' size={20} color={colors.primary} />
							<Text style={styles.statText}>Nivel: {match.skill_level}</Text>
						</View>
						<View style={styles.statItem}>
							<Ionicons name='people-outline' size={20} color={colors.primary} />
							<Text style={styles.statText}>
								{currentPlayers} / {match.total_players}
							</Text>
						</View>
					</View>

					<ParticipantsMatch match={match} />

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

			<View style={styles.footer}>
				{isCreator ? (
					<TouchableOpacity style={styles.mainButton} onPress={() => router.push(`/match/Edit?id=${id}`)}>
						<Text style={styles.mainButtonText}>Editar partido</Text>
					</TouchableOpacity>
				) : isParticipant ? (
					<TouchableOpacity style={[styles.mainButton, { backgroundColor: colors.error }]} onPress={handleLeave} disabled={actionLoading}>
						{actionLoading ? <ActivityIndicator color='white' /> : <Text style={styles.mainButtonText}>Salir del partido</Text>}
					</TouchableOpacity>
				) : (
					<TouchableOpacity style={[styles.mainButton, (!isOpen || isFull) && { backgroundColor: '#555' }]} disabled={!isOpen || isFull || actionLoading} onPress={handleJoin}>
						{actionLoading ? <ActivityIndicator color='white' /> : isFull ? <Text style={styles.mainButtonText}>Partido completo</Text> : <Text style={styles.mainButtonText}>Unirme al partido</Text>}
					</TouchableOpacity>
				)}
			</View>
		</View>
	)
}
