import { styles } from '@/assets/styles/Explore.styles'
import { MatchCardComponent } from '@/components/match/MatchCard'
import { SportFilter } from '@/components/match/SportFilter'
import { useMatches } from '@/context/MatchContext'
import { colors } from '@/theme/colors'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ExploreScreen() {
	const { filteredMatches, isLoading, error, filters, setFilters, refreshMatches } = useMatches()

	const handleMatchPress = (match: MatchWithCreator) => {
		router.push(`/match/${match.id}`)
	}

	const handleJoinPress = (match: MatchWithCreator) => {
		router.push(`/match/${match.id}`)
	}

	const renderHeader = () => (
		<View>
			{/* Sport Filters */}
			<SportFilter selectedSport={filters.sport} onSelectSport={(sport) => setFilters({ ...filters, sport })} />

			{/* Section Header */}
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Partidos Disponibles</Text>
				<TouchableOpacity style={styles.mapButton}>
					<Text style={styles.mapButtonText}>Ver Mapa</Text>
				</TouchableOpacity>
			</View>
		</View>
	)

	const renderEmpty = () => (
		<View style={styles.emptyContainer}>
			<Ionicons name='calendar-outline' size={64} color={colors.textSecondaryDark} />
			<Text style={styles.emptyTitle}>No hay partidos disponibles</Text>
			<Text style={styles.emptyText}>{filters.sport ? 'No hay partidos de este deporte en este momento' : 'Se el primero en crear un partido'}</Text>
			<TouchableOpacity style={styles.createButton} onPress={() => router.push('/match/Create')}>
				<Ionicons name='add' size={20} color={colors.backgroundDark} />
				<Text style={styles.createButtonText}>Crear Partido</Text>
			</TouchableOpacity>
		</View>
	)

	const renderItem = useCallback(({ item }: { item: MatchWithCreator }) => <MatchCardComponent match={item} onPress={() => handleMatchPress(item)} onJoin={() => handleJoinPress(item)} />, [])

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
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

			{/* Content */}
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

			{/* FAB */}
		</SafeAreaView>
	)
}
