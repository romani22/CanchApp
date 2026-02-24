import { styles } from '@/assets/styles/Dashboard.styles'
import Countdown from '@/components/ui/Countdown'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import type { Match } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

export default function NextMatches() {
	const [nextMatch, setNextMatch] = useState<Match | null>(null)

	useEffect(() => {
		const loadNextMatch = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser()

			if (!user) return

			const { data, error } = await matchesService.getNextMatchForUser(user.id)
			console.log(error)
			if (error) {
				console.error(error)
				return
			}
			console.log(data)
			setNextMatch(data ?? null)
		}

		loadNextMatch()
	}, [])

	const handlePress = () => {
		router.push('/Explore')
	}

	const goToDetails = () => {
		if (!nextMatch) return
		router.push(`/match/${nextMatch.id}`)
	}

	return (
		<View style={styles.nextMatchCard}>
			{nextMatch ? (
				<>
					<View style={styles.nextMatchHeader}>
						<View style={styles.todayBadge}>
							<Text style={styles.todayBadgeText}>{nextMatch.date}</Text>
						</View>

						<View style={styles.locationContainer}>
							<Ionicons name='location' size={14} color='#34d399' />
							<Text style={styles.locationText}>{nextMatch.venue_name}</Text>
						</View>
					</View>

					<Text style={styles.nextMatchTitle}>Tu próximo partido</Text>

					<Text style={styles.nextMatchSubtitle}>
						{nextMatch.sport} • {nextMatch.start_time} hs
					</Text>

					<Countdown date={`${nextMatch.date}T${nextMatch.start_time}`} />

					<TouchableOpacity style={styles.detailsButton} onPress={goToDetails}>
						<Text style={styles.detailsButtonText}>Ver detalles del partido</Text>
						<Ionicons name='arrow-forward' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			) : (
				<>
					<Text style={styles.nextMatchTitle}>No tienes partidos próximos</Text>

					<Text style={styles.nextMatchSubtitle}>Únete a un partido o crea el tuyo propio</Text>

					<TouchableOpacity style={styles.detailsButton} onPress={handlePress}>
						<Text style={styles.detailsButtonText}>Explorar / Crear partidos</Text>
						<Ionicons name='search' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			)}
		</View>
	)
}
