import { styles } from '@/assets/styles/Explore.styles'
import { MatchCardComponent } from '@/components/match/MatchCard'
import { SportFilter } from '@/components/match/SportFilter'
import { useMatches } from '@/context/MatchContext'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ExploreScreen() {
	const { matches, isLoading, error, filters, setFilters, clearFilters, refreshMatches } = useMatches()

	// Recarga al volver a la tab Explorar
	useFocusEffect(
		useCallback(() => {
			refreshMatches()
		}, []),
	)

	const filteredMatches = useMemo(() => (filters.sport ? matches.filter((m) => m.sport === filters.sport) : matches), [matches, filters])

	const handleMatchPress = (match: MatchWithCreator) => router.push(`/match/${match.id}`)

	const renderHeader = () => (
		<View>
			<SportFilter
				selectedSport={filters.sport}
				onSelectSport={(sport) => {
					if (filters.sport === sport) clearFilters()
					else setFilters({ ...filters, sport })
				}}
			/>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Partidos Disponibles {filteredMatches.length > 0 && <Text style={{ fontSize: 14, color: colors.textSecondaryDark }}>({filteredMatches.length})</Text>}</Text>
				{filters.sport && (
					<TouchableOpacity onPress={clearFilters}>
						<Text style={styles.mapButtonText}>Limpiar filtro</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	)

	const renderEmpty = () => (
		<View style={styles.emptyContainer}>
			<Ionicons name='calendar-outline' size={64} color={colors.textSecondaryDark} />
			<Text style={styles.emptyTitle}>No hay partidos disponibles</Text>
			<Text style={styles.emptyText}>{filters.sport ? 'No hay partidos de este deporte en este momento' : 'Sé el primero en crear un partido'}</Text>
			<TouchableOpacity style={styles.createButton} onPress={() => router.push('/match/Create')}>
				<Ionicons name='add' size={20} color={colors.backgroundDark} />
				<Text style={styles.createButtonText}>Crear Partido</Text>
			</TouchableOpacity>
		</View>
	)

	const renderItem = useCallback(({ item }: { item: MatchWithCreator }) => <MatchCardComponent match={item} onPress={() => handleMatchPress(item)} onJoin={() => handleMatchPress(item)} />, [])

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<TouchableOpacity style={styles.avatarButton}>
						<Ionicons name='person-circle-outline' size={32} color={colors.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Explorar Partidos</Text>
				</View>
				<View style={styles.headerRight}>
					<TouchableOpacity style={styles.headerButton} onPress={() => router.push('/Notifications')}>
						<Ionicons name='notifications-outline' size={24} color={colors.textPrimaryDark} />
					</TouchableOpacity>
					<TouchableOpacity style={styles.headerButton}>
						<Ionicons name='search-outline' size={24} color={colors.textPrimaryDark} />
					</TouchableOpacity>
					<TouchableOpacity style={styles.headerButton} onPress={() => router.push('/match/Create')}>
						<Ionicons name='add' size={24} color={colors.textPrimaryDark} />
					</TouchableOpacity>
				</View>
			</View>

			{isLoading && filteredMatches.length === 0 ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size='large' color={colors.primary} />
				</View>
			) : error ? (
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={refreshMatches}>
						<Text style={styles.retryButtonText}>Reintentar</Text>
					</TouchableOpacity>
				</View>
			) : (
				<FlatList data={filteredMatches} keyExtractor={(item) => item.id} renderItem={renderItem} ListHeaderComponent={renderHeader} ListEmptyComponent={renderEmpty} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshMatches} tintColor={colors.primary} />} ItemSeparatorComponent={() => <View style={styles.separator} />} />
			)}
		</SafeAreaView>
	)
}
