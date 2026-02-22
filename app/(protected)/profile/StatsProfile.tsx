import { styles } from '@/assets/styles/Profile.styles'
import { Text, View } from 'react-native'

type Props = {
	totalMatches: number
	totalWins: number
	eloRating: number
	rating: number
	ratingCount: number
	winRate: number
}

function StatsProfile({ totalMatches, totalWins, rating }: Props) {
	return (
		<View style={styles.statsGrid}>
			<View style={styles.statCard}>
				<Text style={styles.statValue}>{totalMatches}</Text>
				<Text style={styles.statLabel}>Partidos</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{totalWins}</Text>
				<Text style={styles.statLabel}>Victorias</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{rating}</Text>
				<Text style={styles.statLabel}>Rating</Text>
			</View>
		</View>
	)
}

export default StatsProfile
