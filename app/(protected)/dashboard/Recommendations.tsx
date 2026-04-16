import { styles } from '@/assets/styles/Dashboard.styles'
import { useAuth } from '@/context/AuthContext'
import { useMatches } from '@/context/MatchContext'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { getSportImage } from '@/Utils/sportImage'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native'

export default function Recommendations() {
	const { matches, isLoading } = useMatches()
	const { profile } = useAuth()
	const recommendedMatches = matches.slice(0, 5)

	const handleMatchPress = (match: MatchWithCreator) => {
		router.push(`/match/${match.id}`)
	}

	return (
		<>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Recomendados en tu zona</Text>
				<View style={styles.locationBadge}>
					<Ionicons name='navigate' size={12} color={colors.primary} />
					<Text style={styles.locationBadgeText}>{profile?.zone ?? 'Tu zona'}</Text>
				</View>
			</View>

			{isLoading && (
				<View style={{ paddingVertical: 20 }}>
					<ActivityIndicator size='small' color={colors.primary} />
				</View>
			)}

			{!isLoading && recommendedMatches.length === 0 && (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>No hay partidos activos en {profile?.zone || 'tu zona'}.</Text>
					<Text style={styles.emptyText}>¡Sé el primero!</Text>
				</View>
			)}

			{recommendedMatches.map((item) => (
				<TouchableOpacity key={item.id} style={styles.matchCard} onPress={() => handleMatchPress(item)} activeOpacity={0.9}>
					<View style={styles.matchImageContainer}>
						<Image source={getSportImage(item.sport)} style={styles.matchImage} resizeMode='cover' />
					</View>
					<View style={styles.matchInfo}>
						<Text style={styles.matchTitle}>{item.title}</Text>
						<Text style={styles.matchLocation}>{item.venue_name}</Text>
					</View>
				</TouchableOpacity>
			))}
		</>
	)
}
