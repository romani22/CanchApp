import { styles } from '@/assets/styles/Match.styles'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ImageBackground, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import ParticipantsMatch from './ParticipantsMatch'

export default function MatchDetail() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [match, setMatch] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [actionLoading, setActionLoading] = useState(false)

	useEffect(() => {
		loadMatch()
	}, [])

	useEffect(() => {
		if (!id) return

		const channel = supabase
			.channel('match-detail')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'match_participants',
					filter: `match_id=eq.${id}`,
				},
				() => {
					loadMatch()
				},
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [id])

	const loadMatch = async () => {
		try {
			const { data, error } = await matchesService.getById(id as string)
			if (error) throw error
			setMatch(data)
		} catch (err) {
			console.error(err)
		} finally {
			setLoading(false)
		}
	}

	const handleJoin = async () => {
		if (!user || !isOpen || isFull || isParticipant) return

		try {
			setActionLoading(true)

			const { error } = await matchParticipantsService.join(id as string, user.id)

			if (error) throw error

			await loadMatch()
		} catch (err) {
			console.error(err)
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
			console.error(err)
		} finally {
			setActionLoading(false)
		}
	}

	if (loading) return <Loader />

	if (!match) return null

	const currentPlayers = match.participants?.length || 0
	const isFull = currentPlayers >= match.total_players
	const isOpen = match.status === 'open'
	const isParticipant = match.participants?.some((p: any) => p.user_id === user?.id)

	return (
		<View style={styles.container}>
			<ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
				<ImageBackground source={getSportImage(match.sport)} style={styles.headerImage}>
					<SafeAreaView style={styles.headerButtons}>
						<TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
							<Ionicons name='arrow-back' size={24} color='white' />
						</TouchableOpacity>
					</SafeAreaView>
				</ImageBackground>

				<View style={styles.contentContainer}>
					<Text style={styles.title}>{match.title}</Text>
					<Text style={styles.subtitle}>{match.venue_name}</Text>

					<View style={styles.statsRow}>
						<View style={styles.statItem}>
							<Ionicons name='time-outline' size={20} color={colors.primary} />
							<Text style={styles.statText}>
								{match.date} {match.start_time}
							</Text>
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
				</View>
			</ScrollView>

			<View style={styles.footer}>
				{isParticipant ? (
					<TouchableOpacity style={styles.mainButton} onPress={handleLeave} disabled={isFull || actionLoading || isParticipant}>
						{actionLoading ? <ActivityIndicator color='white' /> : <Text style={styles.mainButtonText}>Salir del partido</Text>}
					</TouchableOpacity>
				) : (
					<TouchableOpacity style={[styles.mainButton, (!isOpen || isFull) && { backgroundColor: '#ccc' }]} disabled={!isOpen || isFull || actionLoading} onPress={handleJoin}>
						{actionLoading ? <ActivityIndicator color='white' /> : isFull ? <Text style={styles.mainButtonText}>Partido completo</Text> : <Text style={styles.mainButtonText}>Unirme al partido</Text>}
					</TouchableOpacity>
				)}
			</View>
		</View>
	)
}
