import { styles } from '@/assets/styles/Dashboard.styles'
import { useMatches } from '@/context/MatchContext'
import { colors } from '@/theme/colors'
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Header from '../dashboard/Headers'
import NextMatches from '../dashboard/NextMatch'
import Recommendations from '../dashboard/Recommendations'

export default function HomeScreen() {
	const { refreshMatches } = useMatches()
	const [refreshingNext, setRefreshingNext] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		setRefreshingNext(true)
		try {
			await refreshMatches()
		} finally {
			setRefreshing(false)
		}
	}, [refreshMatches])

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle='light-content' backgroundColor={colors.backgroundDark} />
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={handleRefresh}
						tintColor={colors.primary}
					/>
				}
			>
				<Header />
				<NextMatches shouldRefresh={refreshingNext} onRefreshDone={() => setRefreshingNext(false)} />
				<Recommendations />
			</ScrollView>
		</SafeAreaView>
	)
}
