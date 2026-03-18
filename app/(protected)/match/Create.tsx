import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import { levels, sports } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ConfirmedParticipant = { type: 'user'; id: string; userId: string; name: string; avatarUrl: string | null } | { type: 'guest'; id: string; name: string }

type UserSearchResult = {
	id: string
	full_name: string
	avatar_url: string | null
	skill_level: string
}

export default function CreateMatchScreen() {
	const { user } = useAuth()
	const [isLoading, setIsLoading] = useState(false)

	const [sport, setSport] = useState<SportType>('futbol')
	const [date, setDate] = useState(new Date())
	const [time, setTime] = useState(new Date())
	const [titleMatch, setTitleMatch] = useState('')
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [venueName, setVenueName] = useState('')
	const [totalPlayers, setTotalPlayers] = useState(10)
	const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermedio')
	const [description, setDescription] = useState('')
	const [confirmed, setConfirmed] = useState<ConfirmedParticipant[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const playersNeeded = Math.max(0, totalPlayers - 1 - confirmed.length)
	const slotsAvailable = totalPlayers - 1 - confirmed.length

	// ── Búsqueda de usuarios ─────────────────────────────────────────────
	const handleSearch = useCallback(
		async (query: string) => {
			setSearchQuery(query)
			if (searchTimer.current) clearTimeout(searchTimer.current)
			if (query.trim().length < 2) {
				setSearchResults([])
				return
			}

			searchTimer.current = setTimeout(async () => {
				try {
					setSearching(true)
					const { data } = await supabase
						.from('profiles')
						.select('id, full_name, avatar_url, skill_level')
						.ilike('full_name', `%${query.trim()}%`)
						.neq('id', user?.id ?? '')
						.limit(5)
					setSearchResults(data ?? [])
				} finally {
					setSearching(false)
				}
			}, 300) // 300ms debounce
		},
		[user?.id],
	)

	const addUserParticipant = (u: UserSearchResult) => {
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}
		setConfirmed((prev) => [...prev, { type: 'user', id: Date.now().toString(), userId: u.id, name: u.full_name, avatarUrl: u.avatar_url }])
		setSearchQuery('')
		setSearchResults([])
	}

	const addGuestParticipant = () => {
		if (!searchQuery.trim()) return
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}
		setConfirmed((prev) => [...prev, { type: 'guest', id: Date.now().toString(), name: searchQuery.trim() }])
		setSearchQuery('')
		setSearchResults([])
	}

	const removeParticipant = (id: string) => setConfirmed((prev) => prev.filter((p) => p.id !== id))

	// ── Contadores ───────────────────────────────────────────────────────
	const handleTotalChange = (delta: number) => {
		const next = totalPlayers + delta
		if (next < 4 || next > 22) return
		setTotalPlayers(next)
		// Quitar confirmados que queden fuera del nuevo total
		const maxConfirmed = next - 1
		if (confirmed.length > maxConfirmed) setConfirmed((prev) => prev.slice(0, maxConfirmed))
	}

	// ── Crear ────────────────────────────────────────────────────────────
	const handleCreateMatch = async () => {
		if (!user) {
			Alert.alert('Error', 'Debés iniciar sesión para crear un partido')
			return
		}
		if (!venueName.trim()) {
			Alert.alert('Error', 'Ingresá el nombre de la cancha o club')
			return
		}

		setIsLoading(true)
		try {
			const starts_at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()).toISOString()
			const playersPerSide = Math.floor(totalPlayers / 2)
			const title = titleMatch === '' ? `${sport} ${playersPerSide}vs${playersPerSide}` : titleMatch
			const match = await matchesService.create({
				creator_id: user.id,
				sport,
				title: title,
				description: description.trim() || undefined,
				starts_at,
				venue_name: venueName.trim(),
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
				is_mixed: false,
			})

			await matchParticipantsService.join(match.id, user.id)

			await Promise.all(confirmed.map((p) => (p.type === 'user' ? matchParticipantsService.join(match.id, (p as any).userId) : matchParticipantsService.addGuest(match.id, p.name))))

			Alert.alert('¡Partido publicado!', 'Ya está visible para otros jugadores.', [{ text: 'Ver partido', onPress: () => router.replace(`/match/${match.id}`) }])
		} catch (error) {
			console.error('[Create]', error)
			Alert.alert('Error', 'No se pudo crear el partido. Intentá de nuevo.')
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name='chevron-back' size={24} color={colors.textPrimaryDark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Crear Nuevo Turno</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
				{/* ── Titulo ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Titulo</Text>
					<View style={styles.inputWrapper}>
						<TextInput style={styles.input} placeholder='Titulo para el partido' placeholderTextColor={colors.textSecondaryDark} value={titleMatch} onChangeText={setTitleMatch} />
					</View>
				</View>

				{/* ── Deporte ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Deporte</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
						<View style={styles.chipsContainer}>
							{sports.map((s) => (
								<Chip key={s.key} label={s.label} icon={s.icon} selected={sport === s.key} onPress={() => setSport(s.key)} size='lg' />
							))}
						</View>
					</ScrollView>
				</View>

				{/* ── Fecha y hora ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Fecha y Hora</Text>
					<View style={styles.dateTimeRow}>
						<TouchableOpacity style={styles.dateTimeInput} onPress={() => setShowDatePicker(true)}>
							<Text style={styles.dateTimeLabel}>Fecha</Text>
							<Text style={styles.dateTimeValue}>{format(date, 'dd/MM/yyyy', { locale: es })}</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.dateTimeInput} onPress={() => setShowTimePicker(true)}>
							<Text style={styles.dateTimeLabel}>Hora</Text>
							<Text style={styles.dateTimeValue}>{format(time, 'HH:mm')}</Text>
						</TouchableOpacity>
					</View>
				</View>

				{showDatePicker && (
					<DateTimePicker
						value={date}
						mode='date'
						minimumDate={new Date()}
						onChange={(_, d) => {
							setShowDatePicker(Platform.OS === 'ios')
							if (d) setDate(d)
						}}
					/>
				)}
				{showTimePicker && (
					<DateTimePicker
						value={time}
						mode='time'
						is24Hour
						onChange={(_, t) => {
							setShowTimePicker(Platform.OS === 'ios')
							if (t) setTime(t)
						}}
					/>
				)}

				{/* ── Ubicación ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Ubicación</Text>
					<View style={styles.inputWrapper}>
						<Ionicons name='location' size={20} color={colors.textSecondaryDark} />
						<TextInput style={styles.input} placeholder='Nombre de la cancha o club' placeholderTextColor={colors.textSecondaryDark} value={venueName} onChangeText={setVenueName} />
					</View>
				</View>

				{/* ── Jugadores ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Jugadores</Text>

					<View style={styles.counterRow}>
						<View style={styles.counterInfo}>
							<Text style={styles.counterLabel}>Total de jugadores</Text>
							<Text style={styles.counterHint}>Capacidad de la cancha</Text>
						</View>
						<View style={styles.counterControls}>
							<TouchableOpacity style={styles.counterButton} onPress={() => handleTotalChange(-1)}>
								<Ionicons name='remove' size={20} color={colors.primary} />
							</TouchableOpacity>
							<Text style={styles.counterValue}>{totalPlayers}</Text>
							<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => handleTotalChange(1)}>
								<Ionicons name='add' size={20} color={colors.backgroundDark} />
							</TouchableOpacity>
						</View>
					</View>

					{/* Resumen automático */}
					<View style={styles.summaryRow}>
						<View style={styles.summaryItem}>
							<Text style={styles.summaryNum}>{1 + confirmed.length}</Text>
							<Text style={styles.summaryLabel}>Confirmados</Text>
						</View>
						<View style={styles.summaryDivider} />
						<View style={styles.summaryItem}>
							<Text style={[styles.summaryNum, { color: playersNeeded > 0 ? colors.warning : colors.success }]}>{playersNeeded}</Text>
							<Text style={styles.summaryLabel}>Faltan</Text>
						</View>
						<View style={styles.summaryDivider} />
						<View style={styles.summaryItem}>
							<Text style={styles.summaryNum}>{totalPlayers}</Text>
							<Text style={styles.summaryLabel}>Total</Text>
						</View>
					</View>
				</View>

				{/* ── Participantes confirmados ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Jugadores confirmados{' '}
						<Text style={{ color: colors.textSecondaryDark, fontSize: 13, fontWeight: '400' }}>
							(opcional · {slotsAvailable} lugar{slotsAvailable !== 1 ? 'es' : ''})
						</Text>
					</Text>

					{slotsAvailable > 0 && (
						<>
							<View style={styles.guestInputRow}>
								<View style={[styles.inputWrapper, { flex: 1 }]}>
									<Ionicons name='search' size={18} color={colors.textSecondaryDark} />
									<TextInput style={styles.input} placeholder='Buscar usuario o agregar invitado' placeholderTextColor={colors.textSecondaryDark} value={searchQuery} onChangeText={handleSearch} returnKeyType='done' onSubmitEditing={addGuestParticipant} />
									{searching && <ActivityIndicator size='small' color={colors.primary} />}
								</View>
								{searchQuery.trim().length > 0 && searchResults.length === 0 && !searching && (
									<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={addGuestParticipant}>
										<Ionicons name='add' size={16} color={colors.backgroundDark} />
									</TouchableOpacity>
								)}
							</View>

							{/* Resultados de búsqueda */}
							{searchResults.length > 0 && (
								<View style={styles.searchResults}>
									{searchResults.map((u) => (
										<TouchableOpacity key={u.id} style={styles.searchRow} onPress={() => addUserParticipant(u)}>
											{u.avatar_url ? (
												<Image source={{ uri: u.avatar_url }} style={styles.searchAvatar} />
											) : (
												<View style={[styles.searchAvatar, styles.searchAvatarPlaceholder]}>
													<Ionicons name='person' size={16} color={colors.textSecondaryDark} />
												</View>
											)}
											<View style={{ flex: 1 }}>
												<Text style={styles.searchName}>{u.full_name}</Text>
												<Text style={styles.searchSub}>{u.skill_level}</Text>
											</View>
											<Ionicons name='add-circle' size={22} color={colors.primary} />
										</TouchableOpacity>
									))}
								</View>
							)}
						</>
					)}

					{/* Lista de confirmados */}
					{confirmed.length > 0 && (
						<View style={styles.guestListContainer}>
							{/* Creador siempre primero */}
							<View style={styles.confirmedRow}>
								<View style={[styles.confirmedAvatar, { backgroundColor: colors.primary }]}>
									<Ionicons name='star' size={13} color={colors.backgroundDark} />
								</View>
								<View style={{ flex: 1 }}>
									<Text style={styles.confirmedName}>Vos (creador)</Text>
								</View>
							</View>

							{confirmed.map((p) => (
								<View key={p.id} style={styles.guestRow}>
									{p.type === 'user' && (p as any).avatarUrl ? (
										<Image source={{ uri: (p as any).avatarUrl }} style={styles.confirmedAvatar} />
									) : (
										<View
											style={[
												styles.confirmedAvatar,
												{
													backgroundColor: p.type === 'user' ? `${colors.info}30` : colors.surfaceDark,
													borderWidth: 1,
													borderColor: p.type === 'user' ? colors.info : colors.borderDark,
												},
											]}
										>
											<Ionicons name={p.type === 'user' ? 'person' : 'person-outline'} size={13} color={p.type === 'user' ? colors.info : colors.textSecondaryDark} />
										</View>
									)}
									<View style={{ flex: 1 }}>
										<Text style={styles.confirmedName}>{p.name}</Text>
										<Text style={styles.confirmedSub}>{p.type === 'user' ? 'Usuario registrado' : 'Invitado'}</Text>
									</View>
									<TouchableOpacity onPress={() => removeParticipant(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
										<Ionicons name='close-circle' size={20} color={colors.error} />
									</TouchableOpacity>
								</View>
							))}
						</View>
					)}
				</View>

				{/* ── Nivel ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Nivel de Juego</Text>
					<View style={styles.levelSelector}>
						{levels.map((level) => (
							<TouchableOpacity key={level.key} style={[styles.levelOption, skillLevel === level.key && styles.levelOptionActive]} onPress={() => setSkillLevel(level.key)}>
								<Text style={[styles.levelText, skillLevel === level.key && styles.levelTextActive]}>{level.label}</Text>
							</TouchableOpacity>
						))}
					</View>
					<View style={styles.levelHints}>
						<Text style={styles.levelHint}>Principiante</Text>
						<Text style={styles.levelHint}>Intermedio</Text>
						<Text style={styles.levelHint}>Avanzado</Text>
					</View>
				</View>

				{/* ── Observaciones ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Observaciones (opcional)</Text>
					<TextInput style={styles.textArea} placeholder='Información adicional sobre el partido...' placeholderTextColor={colors.textSecondaryDark} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical='top' />
				</View>
			</ScrollView>

			{/* Footer */}
			<View style={styles.footer}>
				<TouchableOpacity style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} onPress={handleCreateMatch} disabled={isLoading}>
					{isLoading ? (
						<ActivityIndicator color={colors.backgroundDark} />
					) : (
						<>
							<Ionicons name='rocket' size={20} color={colors.backgroundDark} />
							<Text style={styles.submitButtonText}>Publicar Partido</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
