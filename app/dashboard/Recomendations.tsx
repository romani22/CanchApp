import { styles } from '@/assets/styles/Dashboard.styles'
import { Ionicons } from '@expo/vector-icons'
import { Image, Text, TouchableOpacity, View } from 'react-native'

interface Match {
	id: string
	title: string
	location: string
	time: string
	price: string
	distance: string
	spots: number
	image: string
}

export default function Recomendations() {
	const recommendedMatches: Match[] = [
		{
			id: '1',
			title: 'Pádel Mixto Avanzado',
			location: 'Club Los Pinos • San Isidro',
			time: '19:30',
			price: '$2.500',
			distance: '1.2 KM',
			spots: 3,
			image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400',
		},
		{
			id: '2',
			title: 'Básquet 3x3 Amistoso',
			location: 'Parque Municipal',
			time: 'Mañana, 10:00',
			price: 'Gratis',
			distance: '0.5 KM',
			spots: 1,
			image: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400',
		},
	]
	return (
		<>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Recomendados en tu zona</Text>
				<View style={styles.locationBadge}>
					<Ionicons name='navigate' size={12} color='#34d399' />
					<Text style={styles.locationBadgeText}>Buenos Aires</Text>
				</View>
			</View>

			{/* Match Cards */}
			{recommendedMatches.map((match) => (
				<View key={match.id} style={styles.matchCard}>
					<View style={styles.matchImageContainer}>
						<Image source={{ uri: match.image }} style={styles.matchImage} resizeMode='cover' />
						<View style={styles.distanceBadge}>
							<Text style={styles.distanceBadgeText}>A {match.distance}</Text>
						</View>
					</View>
					<View style={styles.matchInfo}>
						<View style={styles.matchHeader}>
							<Text style={styles.matchTitle}>{match.title}</Text>
							<View style={styles.spotsBadge}>
								<Text style={styles.spotsBadgeText}>
									{match.spots} {match.spots === 1 ? 'CUPO' : 'CUPOS'}
								</Text>
							</View>
						</View>
						<Text style={styles.matchLocation}>{match.location}</Text>
						<View style={styles.matchFooter}>
							<View style={styles.matchDetails}>
								<View style={styles.matchDetailItem}>
									<Ionicons name='time-outline' size={14} color='#9ca3af' />
									<Text style={styles.matchDetailText}>{match.time}</Text>
								</View>
								<View style={styles.matchDetailItem}>
									<Ionicons name='card-outline' size={14} color='#9ca3af' />
									<Text style={styles.matchDetailText}>{match.price}</Text>
								</View>
							</View>
							<TouchableOpacity style={styles.joinButton}>
								<Text style={styles.joinButtonText}>Unirse</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			))}
		</>
	)
}
