import { styles } from '@/assets/styles/Profile.styles'
import { Text, View } from 'react-native'

type Props = {
	totalMatches: number
	totalWins: number
	rating: number
}

function StatsProfile({ totalMatches, totalWins, rating }: Props) {
	const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0

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
				<Text style={styles.statValue}>{winRate}%</Text>
				<Text style={styles.statLabel}>% Victorias</Text>
			</View>

			<View style={styles.statCard}>
				<Text style={styles.statValue}>{rating.toFixed(1)}</Text>
				<Text style={styles.statLabel}>Rating</Text>
			</View>
		</View>
	)
}

export default StatsProfile
