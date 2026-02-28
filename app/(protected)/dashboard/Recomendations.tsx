import { styles } from '@/assets/styles/Dashboard.styles'
import { MatchCard, matchesService } from '@/services/matches.service'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native'

export default function Recomendations() {
	const [recommendedMatches, setRecommendedMatches] = useState<MatchCard[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadMatches()
	}, [])

	const loadMatches = async () => {
		try {
			setLoading(true)
			const matches = await matchesService.getRecommendedMatches()
			setRecommendedMatches(matches)
		} catch (error) {
			console.log(error)
		} finally {
			setLoading(false)
		}
	}
	const handleMatchPress = (match: MatchCard) => {
		router.push(`/match/${match.id}`)
	}

	const handleJoinPress = (match: MatchCard) => {
		router.push(`/match/${match.id}`)
	}

	return (
		<>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Recomendados en tu zona</Text>
				<View style={styles.locationBadge}>
					<Ionicons name='navigate' size={12} color='#34d399' />
					<Text style={styles.locationBadgeText}>Buenos Aires</Text>
				</View>
			</View>

			{loading && (
				<View style={{ paddingVertical: 20 }}>
					<ActivityIndicator size='small' color='#34d399' />
				</View>
			)}

			{!loading && recommendedMatches.length === 0 && (
				<View style={styles.matchCard}>
					<Text style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>No hay partidos activos en tu zona 🎾</Text>
				</View>
			)}

			{recommendedMatches.map((item) => (
				<TouchableOpacity key={item.id} style={styles.container} onPress={() => handleMatchPress(item)} activeOpacity={0.9}>
					<View style={styles.matchCard}>
						<View style={styles.matchImageContainer}>
							<Image source={getSportImage(item.sport)} style={styles.matchImage} resizeMode='cover' />
						</View>
						<View style={styles.matchInfo}>
							<Text style={styles.matchTitle}>{item.title}</Text>
						</View>
					</View>
				</TouchableOpacity>
			))}
		</>
	)
}
