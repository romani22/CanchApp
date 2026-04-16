import { styles } from '@/assets/styles/Personal-matches.styles'
import { MatchCardComponent } from '@/components/match/MatchCard'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { isAfter, parseISO } from 'date-fns'
import { router, useFocusEffect } from 'expo-router'

import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type Tab = 'created' | 'joined' | 'history'

export type PersonalMatch = MatchWithCreator & {
	relation: 'created' | 'joined' | 'history'
}
export default function MyMatchesScreen() {
	const { user } = useAuth()

	const [activeTab, setActiveTab] = useState<Tab>('created')
	const [createdMatches, setCreatedMatches] = useState<PersonalMatch[]>([])
	const [joinedMatches, setJoinedMatches] = useState<PersonalMatch[]>([])
	const [historyMatches, setHistoryMatches] = useState<PersonalMatch[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const loadMatches = useCallback(async () => {
		if (!user) return
		try {
			const [createdRes, joinedRes] = await Promise.all([matchesService.getCreatedByUser(user.id), matchesService.getJoined(user.id)])

			if (createdRes.error) throw createdRes.error
			if (joinedRes.error) throw joinedRes.error

			const now = new Date()

			const created = (createdRes.data || []).map((m) => ({ ...m, relation: 'created' as const }))
			const joined = (joinedRes.data || []).filter((m) => m.creator_id !== user.id).map((m) => ({ ...m, relation: 'joined' as const }))

			// Un partido va a "activo" solo si es futuro Y no está cancelado
			const isActive = (m: PersonalMatch) => isAfter(parseISO(m.starts_at), now) && m.status !== 'cancelled'
			// Va a historial si ya pasó O fue cancelado (sin importar la fecha)
			const isHistory = (m: PersonalMatch) => !isAfter(parseISO(m.starts_at), now) || m.status === 'cancelled'

			setCreatedMatches(created.filter(isActive))
			setJoinedMatches(joined.filter(isActive))
			setHistoryMatches([...created, ...joined].filter(isHistory))
		} catch (error) {
			console.error('[PersonalMatches] Error:', error)
		} finally {
			setIsLoading(false)
			setRefreshing(false)
		}
	}, [user])

	// Recarga cada vez que la tab Mis Turnos queda en foco
	useFocusEffect(
		useCallback(() => {
			loadMatches()
		}, [loadMatches]),
	)

	const handleRefresh = () => {
		setRefreshing(true)
		loadMatches()
	}

	const handleMatchPress = (match: MatchWithCreator) => {
		router.push(`/match/${match.id}`)
	}

	const currentMatches: PersonalMatch[] = activeTab === 'created' ? createdMatches : activeTab === 'joined' ? joinedMatches : historyMatches

	const renderEmpty = () => (
		<View style={styles.emptyContainer}>
			<Ionicons name={activeTab === 'created' ? 'add-circle-outline' : activeTab === 'history' ? 'time-outline' : 'search-outline'} size={64} color={colors.textSecondaryDark} />
			<Text style={styles.emptyTitle}>{activeTab === 'created' ? 'No creaste partidos' : activeTab === 'history' ? 'Sin historial' : 'No te uniste a partidos'}</Text>
			<Text style={styles.emptyText}>{activeTab === 'created' ? 'Crea tu primer partido y encontrá jugadores' : activeTab === 'history' ? 'Aquí aparecerán los partidos que ya jugaste' : 'Explorá los partidos disponibles y unite'}</Text>
			{activeTab !== 'history' && (
				<TouchableOpacity style={styles.emptyButton} onPress={() => router.push(activeTab === 'created' ? '/match/Create' : '/Explore')}>
					<Ionicons name={activeTab === 'created' ? 'add' : 'compass'} size={20} color={colors.backgroundDark} />
					<Text style={styles.emptyButtonText}>{activeTab === 'created' ? 'Crear Partido' : 'Explorar'}</Text>
				</TouchableOpacity>
			)}
		</View>
	)

	const renderItem = useCallback(({ item }: { item: PersonalMatch }) => <MatchCardComponent match={item} relation={item.relation} onPress={() => handleMatchPress(item)} />, [])

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Mis Turnos</Text>
			</View>

			<View style={styles.tabsContainer}>
				<View style={styles.tabs}>
					{(['created', 'joined', 'history'] as Tab[]).map((tab) => {
						const count = tab === 'created' ? createdMatches.length : tab === 'joined' ? joinedMatches.length : historyMatches.length
						const label = tab === 'created' ? 'Creados' : tab === 'joined' ? 'Unidos' : 'Finalizados'
						return (
							<TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
								<Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
									{label} ({count})
								</Text>
							</TouchableOpacity>
						)
					})}
				</View>
			</View>

			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size='large' color={colors.primary} />
				</View>
			) : (
				<FlatList data={currentMatches} keyExtractor={(item) => item.id} renderItem={renderItem} ListEmptyComponent={renderEmpty} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />} ItemSeparatorComponent={() => <View style={styles.separator} />} />
			)}

			<TouchableOpacity style={styles.fab} onPress={() => router.push('/match/Create')} activeOpacity={0.8}>
				<Ionicons name='add' size={32} color={colors.backgroundDark} />
			</TouchableOpacity>
		</SafeAreaView>
	)
}
