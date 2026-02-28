import { styles } from '@/assets/styles/Personal-matches.styles'
import { MatchCardComponent } from '@/components/match/MatchCard'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type Tab = 'created' | 'joined'
export type PersonalMatch = MatchWithCreator & {
	relation: 'created' | 'joined'
}
export default function PersonalMatchesScreen() {
	const { user } = useAuth()
	const [activeTab, setActiveTab] = useState<Tab>('created')
	const [createdMatches, setCreatedMatches] = useState<PersonalMatch[]>([])
	const [joinedMatches, setJoinedMatches] = useState<PersonalMatch[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const loadMatches = useCallback(async () => {
		if (!user) return

		try {
			const [createdRes, joinedRes] = await Promise.all([matchesService.getCreatedByUser(user.id), matchesService.getJoined(user.id)])

			if (createdRes.error) throw createdRes.error
			if (joinedRes.error) throw joinedRes.error

			const created = (createdRes.data || []).map((m) => ({
				...m,
				relation: 'created' as const,
			}))

			const joined = (joinedRes.data || [])
				.filter((m) => m.creator_id !== user.id)
				.map((m) => ({
					...m,
					relation: 'joined' as const,
				}))

			setCreatedMatches(created)
			setJoinedMatches(joined)
		} catch (error) {
			console.error('Error loading matches:', error)
		} finally {
			setIsLoading(false)
			setRefreshing(false)
		}
	}, [user])

	useEffect(() => {
		loadMatches()
	}, [loadMatches])

	const handleRefresh = () => {
		setRefreshing(true)
		loadMatches()
	}

	const handleMatchPress = (match: MatchWithCreator) => {
		router.push(`/(protected)/match/${match.id}`)
	}

	const matches = activeTab === 'created' ? createdMatches : joinedMatches

	const renderEmpty = () => (
		<View style={styles.emptyContainer}>
			<Ionicons name={activeTab === 'created' ? 'add-circle-outline' : 'search-outline'} size={64} color={colors.textSecondaryDark} />
			<Text style={styles.emptyTitle}>{activeTab === 'created' ? 'No has creado partidos' : 'No te has unido a ningun partido'}</Text>
			<Text style={styles.emptyText}>{activeTab === 'created' ? 'Crea tu primer partido y encuentra jugadores' : 'Explora los partidos disponibles y unete'}</Text>
			<TouchableOpacity
				style={styles.emptyButton}
				onPress={() => {
					if (activeTab === 'created') {
						router.push('/match/Create')
					} else {
						// @ts-ignore
						router.push('/(tabs)')
					}
				}}
			>
				<Ionicons name={activeTab === 'created' ? 'add' : 'compass'} size={20} color={colors.backgroundDark} />
				<Text style={styles.emptyButtonText}>{activeTab === 'created' ? 'Crear Partido' : 'Explorar'}</Text>
			</TouchableOpacity>
		</View>
	)

	const renderItem = useCallback(({ item }: { item: PersonalMatch }) => <MatchCardComponent match={item} relation={item.relation} onPress={() => handleMatchPress(item)} />, [])
	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Mis Turnos</Text>
			</View>

			{/* Tabs */}
			<View style={styles.tabsContainer}>
				<View style={styles.tabs}>
					<TouchableOpacity style={[styles.tab, activeTab === 'created' && styles.tabActive]} onPress={() => setActiveTab('created')}>
						<Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>Creados ({createdMatches.length})</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.tab, activeTab === 'joined' && styles.tabActive]} onPress={() => setActiveTab('joined')}>
						<Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]}>Unidos ({joinedMatches.length})</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Content */}
			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size='large' color={colors.primary} />
				</View>
			) : (
				<FlatList data={matches} keyExtractor={(item) => item.id} renderItem={renderItem} ListEmptyComponent={renderEmpty} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />} ItemSeparatorComponent={() => <View style={styles.separator} />} />
			)}

			{/* FAB */}
			<TouchableOpacity style={styles.fab} onPress={() => router.push('/match/Create')} activeOpacity={0.8}>
				<Ionicons name='add' size={32} color={colors.backgroundDark} />
			</TouchableOpacity>
			<TouchableOpacity style={styles.fab} onPress={() => router.push('/tournament/Create')} activeOpacity={0.8}>
				<Ionicons name='add' size={32} color={colors.backgroundDark} />
			</TouchableOpacity>
		</SafeAreaView>
	)
}
