import { styles } from '@/assets/styles/Dashboard.styles'
import Countdown from '@/components/ui/Countdown'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import type { Match } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

export default function NextMatches() {
	const [nextMatch, setNextMatch] = useState<Match | null>(null)
	const { user } = useAuth()

	const loadNextMatch = useCallback(async () => {
		if (!user) return
		const { data, error } = await matchesService.getNextMatchForUser(user.id)
		if (error) {
			console.error('[NextMatch] Error cargando partido:', error)
			return
		}
		setNextMatch(data ?? null)
	}, [user])

	// Recarga cada vez que el Dashboard queda en foco
	useFocusEffect(
		useCallback(() => {
			loadNextMatch()
		}, [loadNextMatch]),
	)

	const matchDate = nextMatch ? parseISO(nextMatch.starts_at) : null

	return (
		<View style={styles.nextMatchCard}>
			{nextMatch && matchDate ? (
				<>
					<View style={styles.nextMatchHeader}>
						<View style={styles.todayBadge}>
							<Text style={styles.todayBadgeText}>{format(matchDate, 'dd/MM/yyyy')}</Text>
						</View>
						<View style={styles.locationContainer}>
							<Ionicons name='location' size={14} color='#34d399' />
							<Text style={styles.locationText}>{nextMatch.venue_name}</Text>
						</View>
					</View>

					<Text style={styles.nextMatchTitle}>Tu próximo partido</Text>
					<Text style={styles.nextMatchSubtitle}>
						{nextMatch.sport} • {format(matchDate, 'dd/MM - HH:mm')} hs
					</Text>

					<Countdown date={nextMatch.starts_at} />

					<TouchableOpacity style={styles.detailsButton} onPress={() => router.push(`/match/${nextMatch.id}`)}>
						<Text style={styles.detailsButtonText}>Ver detalles del partido</Text>
						<Ionicons name='arrow-forward' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			) : (
				<>
					<Text style={styles.nextMatchTitle}>No tienes partidos próximos</Text>
					<Text style={styles.nextMatchSubtitle}>Únete a un partido o crea el tuyo propio</Text>
					<TouchableOpacity style={styles.detailsButton} onPress={() => router.push('/Explore')}>
						<Text style={styles.detailsButtonText}>Explorar / Crear partidos</Text>
						<Ionicons name='search' size={20} color='#0a0f0a' />
					</TouchableOpacity>
				</>
			)}
		</View>
	)
}
