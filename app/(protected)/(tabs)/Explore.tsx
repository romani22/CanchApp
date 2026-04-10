import { styles } from '@/assets/styles/Explore.styles'
import { MatchCardComponent } from '@/components/match/MatchCard'
import { SportFilter } from '@/components/match/SportFilter'
import { ZoneFilter, useMatches } from '@/context/MatchContext'
import { useLocation } from '@/hooks/useLocation'
import { LocalidadSuggestion, useVenueZone } from '@/hooks/useVenueZone'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchWithCreator } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Radio predeterminado y opciones rápidas
const DEFAULT_RADIUS = 20
const RADIUS_PRESETS = [5, 10, 20, 50, 100]

export default function ExploreScreen() {
	const { matches, isLoading, error, filters, activeZone, setFilters, setZone, clearFilters, refreshMatches } = useMatches()
	const { detect, loading: detectingGPS } = useLocation()
	const venueZone = useVenueZone()

	const [modalVisible, setModalVisible] = useState(false)
	// Slider vive en estado local del modal — se aplica al confirmar
	const [draftRadius, setDraftRadius] = useState(activeZone?.radiusKm ?? DEFAULT_RADIUS)

	useFocusEffect(
		useCallback(() => {
			refreshMatches()
		}, [refreshMatches]),
	)

	const filteredMatches = filters.sport ? matches.filter((m) => m.sport === filters.sport) : matches

	const handleMatchPress = (match: MatchWithCreator) => router.push(`/match/${match.id}`)

	// ── Abrir modal: sincronizar draft con el estado actual ───────────────
	const openModal = () => {
		setDraftRadius(activeZone?.radiusKm ?? DEFAULT_RADIUS)
		venueZone.onDismiss()
		setModalVisible(true)
	}

	// ── Detectar por GPS ──────────────────────────────────────────────────
	const handleDetectGPS = async () => {
		const result = await detect()
		if (!result) return
		const zone: ZoneFilter = {
			label: result.zone,
			lng: result.coordinates.x,
			lat: result.coordinates.y,
			radiusKm: draftRadius,
		}
		setZone(zone)
		setModalVisible(false)
		venueZone.onDismiss()
	}

	// ── Seleccionar sugerencia del autocomplete ───────────────────────────
	const handleSelectSuggestion = (item: LocalidadSuggestion) => {
		venueZone.onSelect(item)
		Keyboard.dismiss()
	}

	// ── Aplicar la zona buscada por nombre ────────────────────────────────
	const handleApplySearch = () => {
		if (!venueZone.inputText.trim()) return
		const hasConfirmedCoords = venueZone.coords && !venueZone.isDirty
		const zone: ZoneFilter = hasConfirmedCoords
			? // Localidad seleccionada del autocomplete → filtro por radio
				{ label: venueZone.inputText, lng: venueZone.coords!.x, lat: venueZone.coords!.y, radiusKm: draftRadius }
			: // Texto libre → filtro por nombre (ilike sobre venue_zone)
				{ label: venueZone.inputText, lng: 0, lat: 0, radiusKm: 0 }
		console.log(zone)
		setZone(zone)
		setModalVisible(false)
		venueZone.onDismiss()
	}

	const handleClearZone = () => {
		setZone(null)
		setModalVisible(false)
		venueZone.onDismiss()
	}

	// ── Aplicar solo el nuevo radio a la zona actual ──────────────────────
	const handleApplyRadius = () => {
		if (!activeZone || activeZone.radiusKm === draftRadius) {
			setModalVisible(false)
			return
		}
		setZone({ ...activeZone, radiusKm: draftRadius })
		setModalVisible(false)
	}

	// ── Banner de zona (header de la lista) ──────────────────────────────
	const renderZoneBanner = () => (
		<TouchableOpacity style={localStyles.zoneBanner} onPress={openModal} activeOpacity={0.8}>
			<View style={localStyles.zoneBannerLeft}>
				<Ionicons name='location' size={15} color={activeZone ? colors.primary : colors.textSecondaryDark} />
				<Text style={localStyles.zoneBannerText} numberOfLines={1}>
					{activeZone ? activeZone.label : 'Todos los partidos'}
				</Text>
				{activeZone && activeZone.radiusKm > 0 && (
					<View style={localStyles.radiusPill}>
						<Text style={localStyles.radiusPillText}>{activeZone.radiusKm} km</Text>
					</View>
				)}
			</View>
			<Ionicons name='options-outline' size={16} color={colors.textSecondaryDark} />
		</TouchableOpacity>
	)

	const renderHeader = () => (
		<View>
			{renderZoneBanner()}
			<SportFilter
				selectedSport={filters.sport}
				onSelectSport={(sport) => {
					if (filters.sport === sport) clearFilters()
					else setFilters({ ...filters, sport })
				}}
			/>
			<View style={styles.sectionHeader}>
				<Text style={styles.sectionTitle}>Partidos disponibles {filteredMatches.length > 0 && <Text style={{ fontSize: 14, color: colors.textSecondaryDark }}>({filteredMatches.length})</Text>}</Text>
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
			<Text style={styles.emptyText}>{activeZone ? (activeZone.radiusKm > 0 ? `No hay partidos a ${activeZone.radiusKm} km de ${activeZone.label}` : `No hay partidos en ${activeZone.label}`) : filters.sport ? 'No hay partidos de este deporte' : 'Sé el primero en crear un partido'}</Text>
			{activeZone && (
				<TouchableOpacity style={[styles.createButton, { backgroundColor: colors.surfaceDark, marginBottom: spacing.md }]} onPress={handleClearZone}>
					<Ionicons name='globe-outline' size={18} color={colors.primary} />
					<Text style={[styles.createButtonText, { color: colors.primary }]}>Ver todos los partidos</Text>
				</TouchableOpacity>
			)}
			<TouchableOpacity style={styles.createButton} onPress={() => router.push('/match/Create')}>
				<Ionicons name='add' size={20} color={colors.backgroundDark} />
				<Text style={styles.createButtonText}>Crear Partido</Text>
			</TouchableOpacity>
		</View>
	)

	const renderItem = useCallback(({ item }: { item: MatchWithCreator }) => <MatchCardComponent match={item} onPress={() => handleMatchPress(item)} onJoin={() => handleMatchPress(item)} />, [])

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<TouchableOpacity style={styles.avatarButton}>
						<Ionicons name='person-circle-outline' size={32} color={colors.primary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Explorar</Text>
				</View>
				<View style={styles.headerRight}>
					<TouchableOpacity style={styles.headerButton} onPress={() => router.push('/Notifications')}>
						<Ionicons name='notifications-outline' size={24} color={colors.textPrimaryDark} />
					</TouchableOpacity>
					<TouchableOpacity style={styles.headerButton} onPress={() => router.push('/match/Create')}>
						<Ionicons name='add' size={24} color={colors.textPrimaryDark} />
					</TouchableOpacity>
				</View>
			</View>

			{/* Lista */}
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
				<FlatList data={filteredMatches} keyExtractor={(item) => item.id} renderItem={renderItem} ListHeaderComponent={renderHeader} ListEmptyComponent={renderEmpty} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled' refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshMatches} tintColor={colors.primary} />} ItemSeparatorComponent={() => <View style={styles.separator} />} />
			)}

			{/* ── Modal de zona ─────────────────────────────────────────── */}
			<Modal visible={modalVisible} transparent animationType='slide' onRequestClose={() => setModalVisible(false)}>
				<TouchableWithoutFeedback
					onPress={() => {
						Keyboard.dismiss()
						setModalVisible(false)
					}}
				>
					<View style={localStyles.overlay} />
				</TouchableWithoutFeedback>

				<View style={localStyles.sheet}>
					<View style={localStyles.handle} />
					<Text style={localStyles.sheetTitle}>Zona de búsqueda</Text>

					{/* ── Zona activa ── */}
					{activeZone && (
						<View style={localStyles.activeRow}>
							<View style={localStyles.activeRowLeft}>
								<Ionicons name='location' size={16} color={colors.primary} />
								<View style={{ flex: 1 }}>
									<Text style={localStyles.activeLabel}>{activeZone.label}</Text>
									<Text style={localStyles.activeSubtitle}>{activeZone.radiusKm > 0 ? `Radio actual: ${activeZone.radiusKm} km` : 'Búsqueda por nombre'}</Text>
								</View>
							</View>
							<TouchableOpacity onPress={handleClearZone} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<Ionicons name='close-circle' size={20} color={colors.error} />
							</TouchableOpacity>
						</View>
					)}

					{/* ── GPS ── */}
					<TouchableOpacity style={localStyles.gpsBtn} onPress={handleDetectGPS} disabled={detectingGPS}>
						{detectingGPS ? (
							<ActivityIndicator size='small' color={colors.backgroundDark} />
						) : (
							<>
								<Ionicons name='navigate' size={17} color={colors.backgroundDark} />
								<Text style={localStyles.gpsBtnText}>Usar mi ubicación actual</Text>
							</>
						)}
					</TouchableOpacity>

					{/* ── Separador ── */}
					<View style={localStyles.divider}>
						<View style={localStyles.dividerLine} />
						<Text style={localStyles.dividerText}>o buscá una localidad</Text>
						<View style={localStyles.dividerLine} />
					</View>

					{/* ── Autocomplete de localidad ── */}
					<View style={localStyles.searchWrapper}>
						<View style={[localStyles.searchInput, venueZone.suggestions.length > 0 && localStyles.searchInputOpen]}>
							<Ionicons name='search' size={16} color={colors.textSecondaryDark} />
							<TextInput style={localStyles.searchText} placeholder='Ej: Morteros, Córdoba...' placeholderTextColor={colors.textSecondaryDark} value={venueZone.inputText} onChangeText={venueZone.onChangeText} autoCapitalize='words' autoCorrect={false} returnKeyType='search' onSubmitEditing={handleApplySearch} />
							{venueZone.searching && <ActivityIndicator size='small' color={colors.primary} />}
							{!venueZone.searching && venueZone.coords && !venueZone.isDirty && <Ionicons name='checkmark-circle' size={16} color={colors.success} />}
							{venueZone.inputText.length > 0 && (
								<TouchableOpacity onPress={() => venueZone.onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
									<Ionicons name='close-circle' size={16} color={colors.textSecondaryDark} />
								</TouchableOpacity>
							)}
						</View>

						{/* Dropdown sugerencias */}
						{venueZone.suggestions.length > 0 && (
							<View style={localStyles.dropdown}>
								<ScrollView keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
									{venueZone.suggestions.map((item, index) => (
										<TouchableOpacity key={item.id} style={[localStyles.suggestionRow, index < venueZone.suggestions.length - 1 && localStyles.suggestionBorder]} onPress={() => handleSelectSuggestion(item)} activeOpacity={0.7}>
											<Ionicons name='location-outline' size={15} color={colors.primary} />
											<View style={{ flex: 1, marginLeft: spacing.sm }}>
												<Text style={localStyles.suggestionName}>{item.nombre}</Text>
												<Text style={localStyles.suggestionProv}>{item.provincia}</Text>
											</View>
										</TouchableOpacity>
									))}
								</ScrollView>
							</View>
						)}
					</View>

					{/* ── Slider de radio ── */}
					<View style={localStyles.radiusSection}>
						<View style={localStyles.radiusHeader}>
							<Text style={localStyles.radiusLabel}>Radio de búsqueda</Text>
							<View style={localStyles.radiusBadge}>
								<Text style={localStyles.radiusBadgeText}>{draftRadius} km</Text>
							</View>
						</View>

						<Slider style={{ width: '100%', height: 36 }} minimumValue={5} maximumValue={150} step={5} value={draftRadius} onValueChange={setDraftRadius} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.borderDark} thumbTintColor={colors.primary} />

						{/* Presets rápidos */}
						<View style={localStyles.presets}>
							{RADIUS_PRESETS.map((km) => (
								<TouchableOpacity key={km} style={[localStyles.preset, draftRadius === km && localStyles.presetActive]} onPress={() => setDraftRadius(km)}>
									<Text style={[localStyles.presetText, draftRadius === km && localStyles.presetTextActive]}>{km} km</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>

					{/* ── Botón aplicar ── */}
					<TouchableOpacity style={[localStyles.applyBtn, !venueZone.inputText.trim() && !activeZone && localStyles.applyBtnDisabled]} onPress={venueZone.inputText.trim() ? handleApplySearch : handleApplyRadius} disabled={!venueZone.inputText.trim() && !activeZone}>
						<Ionicons name='checkmark' size={18} color={colors.backgroundDark} />
						<Text style={localStyles.applyBtnText}>{venueZone.inputText.trim() ? 'Buscar en esta zona' : 'Actualizar radio'}</Text>
					</TouchableOpacity>

					{/* Ver todo */}
					<TouchableOpacity style={localStyles.allBtn} onPress={handleClearZone}>
						<Ionicons name='globe-outline' size={16} color={colors.textSecondaryDark} />
						<Text style={localStyles.allBtnText}>Ver todos los partidos</Text>
					</TouchableOpacity>
				</View>
			</Modal>
		</SafeAreaView>
	)
}

const localStyles = StyleSheet.create({
	// Banner
	zoneBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginHorizontal: spacing.lg,
		marginTop: spacing.sm,
		marginBottom: spacing.xs,
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
		paddingHorizontal: spacing.md,
		paddingVertical: 10,
	},
	zoneBannerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		flex: 1,
	},
	zoneBannerText: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
		fontSize: 13,
	},
	radiusPill: {
		backgroundColor: `${colors.primary}20`,
		borderRadius: borderRadius.full,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	radiusPillText: {
		color: colors.primary,
		fontSize: 11,
		fontWeight: '600',
	},
	// Modal
	overlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.55)',
	},
	sheet: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.surfaceDark,
		borderTopLeftRadius: borderRadius.xl,
		borderTopRightRadius: borderRadius.xl,
		padding: spacing.xl,
		paddingBottom: 36,
		borderWidth: 1,
		borderBottomWidth: 0,
		borderColor: colors.borderDark,
	},
	handle: {
		width: 40,
		height: 4,
		backgroundColor: colors.borderDark,
		borderRadius: 2,
		alignSelf: 'center',
		marginBottom: spacing.lg,
	},
	sheetTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
		marginBottom: spacing.lg,
	},
	// Zona activa
	activeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: `${colors.primary}12`,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
		padding: spacing.md,
		marginBottom: spacing.lg,
	},
	activeRowLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		flex: 1,
	},
	activeLabel: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	activeSubtitle: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 2,
	},
	// GPS
	gpsBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		borderRadius: borderRadius.full,
		paddingVertical: 13,
		marginBottom: spacing.lg,
	},
	gpsBtnText: {
		...typography.body,
		color: colors.backgroundDark,
		fontWeight: '700',
	},
	// Divider
	divider: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderDark },
	dividerText: { ...typography.bodySmall, color: colors.textSecondaryDark },
	// Search / autocomplete
	searchWrapper: {
		marginBottom: spacing.lg,
	},
	searchInput: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.backgroundDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		paddingHorizontal: spacing.md,
		height: 48,
	},
	searchInputOpen: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
		borderBottomColor: 'transparent',
	},
	searchText: {
		flex: 1,
		...typography.body,
		color: colors.textPrimaryDark,
	},
	dropdown: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderTopWidth: 0,
		borderColor: colors.borderDark,
		borderBottomLeftRadius: borderRadius.lg,
		borderBottomRightRadius: borderRadius.lg,
		overflow: 'hidden',
	},
	suggestionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: 11,
	},
	suggestionBorder: {
		borderBottomWidth: 0.5,
		borderBottomColor: colors.borderDark,
	},
	suggestionName: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	suggestionProv: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 1,
	},
	// Slider de radio
	radiusSection: {
		backgroundColor: colors.backgroundDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.md,
		marginBottom: spacing.lg,
	},
	radiusHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: spacing.xs,
	},
	radiusLabel: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	radiusBadge: {
		backgroundColor: `${colors.primary}20`,
		borderRadius: borderRadius.full,
		paddingHorizontal: 10,
		paddingVertical: 3,
	},
	radiusBadgeText: {
		color: colors.primary,
		fontSize: 13,
		fontWeight: '700',
	},
	presets: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.xs,
		flexWrap: 'wrap',
	},
	preset: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	presetActive: {
		backgroundColor: `${colors.primary}20`,
		borderColor: colors.primary,
	},
	presetText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	presetTextActive: {
		color: colors.primary,
		fontWeight: '600',
	},
	// Botones inferiores
	applyBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		backgroundColor: colors.primary,
		borderRadius: borderRadius.full,
		paddingVertical: 14,
		marginBottom: spacing.md,
	},
	applyBtnDisabled: {
		opacity: 0.4,
	},
	applyBtnText: {
		...typography.body,
		color: colors.backgroundDark,
		fontWeight: '700',
	},
	allBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
	},
	allBtnText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
})
