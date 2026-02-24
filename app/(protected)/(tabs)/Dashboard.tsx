import { styles } from '@/assets/styles/Dashboard.styles'
import { colors } from '@/theme/colors'
import { ScrollView, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../dashboard/Headers'
import NextMatches from '../dashboard/NextMatch'
import Recomendations from '../dashboard/Recomendations'

export default function HomeScreen({ navigation }: { navigation?: any }) {
	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle='light-content' backgroundColor={colors.backgroundDark} />
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Header />
				<NextMatches />
				<Recomendations />
			</ScrollView>
		</SafeAreaView>
	)
}
