import { styles } from '@/assets/styles/Dashboard.styles'
import Countdown from '@/components/ui/Countdown'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

export default function NextMatches() {
	const [nextMatch, setNextMatch] = useState(true)

	useEffect(() => {
		const loadNextMatch = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) return

			const { data } = await matchesService.getNextMatchForUser(user.id)

			if (data?.date) {
				setNextMatch(true)
			} else {
				setNextMatch(false)
			}
		}
		loadNextMatch()
	}, [])

	const handlerpress = () => {
		router.push('/Explore')
	}

	return (
		<View style={styles.nextMatchCard}>
			{nextMatch ? (
				<>
					<View style={styles.nextMatchHeader}>
						<View style={styles.todayBadge}>
							<Text style={styles.todayBadgeText}>HOY</Text>
						</View>
						<View style={styles.locationContainer}>
							<Ionicons name='location' size={14} color='#34d399' />
							<Text style={styles.locationText}>Cancha Centenario</Text>
						</View>
					</View>

					<Text style={styles.nextMatchTitle}>Tu próximo partido</Text>
					<Text style={styles.nextMatchSubtitle}>Fútbol 5 • 21:00 hs</Text>

					{/* Countdown */}
					<Countdown />

					<TouchableOpacity style={styles.detailsButton}>
						<Text style={styles.detailsButtonText}>Ver detalles del partido</Text>
						<Ionicons name='arrow-forward' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			) : (
				<>
					<Text style={styles.nextMatchTitle}>No tienes partidos próximos</Text>
					<Text style={styles.nextMatchSubtitle}>Únete a un partido o crea el tuyo propio</Text>
					<TouchableOpacity style={styles.detailsButton} onPress={() => handlerpress()}>
						<Text style={styles.detailsButtonText}>Explorar/Crea partidos</Text>
						<Ionicons name='search' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			)}
		</View>
	)
}
