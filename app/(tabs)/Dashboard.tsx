import { styles } from '@/assets/styles/Dashboard.styles'
import { ScrollView, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../dashboard/Headers'
import Recomendations from '../dashboard/Recomendations'
import NextMatches from '../match/NextMatch'

export default function HomeScreen({ navigation }: { navigation?: any }) {
	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle='light-content' backgroundColor='#0a0f0a' />

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Header />
				<NextMatches />
				<Recomendations />
			</ScrollView>
		</SafeAreaView>
	)
}
