import { MatchCard } from '@/components/match/MatchCard'
import { SportFilter } from '@/components/match/SportFilter'
import { useAuth } from '@/context/AuthContext'
import { useMatches } from '@/context/MatchContext'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ExploreScreen() {
	const { profile } = useAuth()
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

	const renderItem = useCallback(({ item }: { item: MatchWithCreator }) => <MatchCard match={item} onPress={() => handleMatchPress(item)} onJoin={() => handleJoinPress(item)} />, [])

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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
	},
	avatarButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: `${colors.primary}20`,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
	},
	headerTitle: {
		...typography.h3,
		color: colors.textPrimaryDark,
	},
	headerRight: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.surfaceDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
		paddingBottom: spacing.md,
	},
	sectionTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	mapButton: {},
	mapButtonText: {
		...typography.labelSmall,
		color: colors.primary,
	},
	listContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: 100,
	},
	separator: {
		height: spacing.lg,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	errorContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.xl,
	},
	errorText: {
		...typography.body,
		color: colors.error,
		textAlign: 'center',
		marginBottom: spacing.lg,
	},
	retryButton: {
		backgroundColor: colors.surfaceDark,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
	},
	retryButtonText: {
		...typography.button,
		color: colors.textPrimaryDark,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: spacing['5xl'],
		gap: spacing.md,
	},
	emptyTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
		marginTop: spacing.md,
	},
	emptyText: {
		...typography.body,
		color: colors.textSecondaryDark,
		textAlign: 'center',
		maxWidth: 280,
	},
	createButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.xl,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.full,
		marginTop: spacing.lg,
	},
	createButtonText: {
		...typography.button,
		color: colors.backgroundDark,
	},
	fab: {
		position: 'absolute',
		bottom: 80,
		right: spacing.xl,
		width: 40,
		height: 40,
		borderRadius: 28,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
})
