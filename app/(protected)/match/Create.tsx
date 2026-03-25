import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import { VenueZoneInput } from '@/components/ui/Venuezoneinput'
import { useAuth } from '@/context/AuthContext'
import { useVenueZone } from '@/hooks/useVenueZone'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType, TeamMode, TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const sports: { key: SportType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
	{ key: 'futbol', label: 'Futbol', icon: 'football' },
	{ key: 'padel', label: 'Padel', icon: 'tennisball' },
	{ key: 'basquet', label: 'Basquet', icon: 'basketball' },
	{ key: 'voley', label: 'Voley', icon: 'baseball' },
	{ key: 'tenis', label: 'Tenis', icon: 'tennisball' },
]

const levels: { key: SkillLevel; label: string }[] = [
	{ key: 'principiante', label: 'Bajo' },
	{ key: 'intermedio', label: 'Medio' },
	{ key: 'avanzado', label: 'Alto' },
]

const TEAM_CONFIG = {
	A: { label: 'Equipo A', color: colors.info, bg: `${colors.info}18`, border: `${colors.info}40` },
	B: { label: 'Equipo B', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
} as const

type ConfirmedParticipant = { type: 'user'; id: string; userId: string; name: string; avatarUrl: string | null; teamSlot: TeamSlot | null } | { type: 'guest'; id: string; name: string; teamSlot: TeamSlot | null }

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
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [venueName, setVenueName] = useState('')
	const venueZoneState = useVenueZone()
	const [totalPlayers, setTotalPlayers] = useState(10)
	const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermedio')
	const [teamMode, setTeamMode] = useState<TeamMode>('none')
	const [description, setDescription] = useState('')
	const [confirmed, setConfirmed] = useState<ConfirmedParticipant[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
	const [searching, setSearching] = useState(false)

	// Equipo del creador en modo two_teams
	const [creatorTeamSlot, setCreatorTeamSlot] = useState<TeamSlot | null>(null)

	// Modal para elegir equipo al agregar jugador en modo two_teams
	const [pendingUser, setPendingUser] = useState<UserSearchResult | null>(null)
	const [pendingGuestName, setPendingGuestName] = useState<string | null>(null)

	const playersNeeded = Math.max(0, totalPlayers - 1 - confirmed.length)
	const slotsAvailable = totalPlayers - 1 - confirmed.length

	const perTeam = Math.floor(totalPlayers / 2)
	const teamACount = confirmed.filter((p) => p.teamSlot === 'A').length + (creatorTeamSlot === 'A' ? 1 : 0)
	const teamBCount = confirmed.filter((p) => p.teamSlot === 'B').length + (creatorTeamSlot === 'B' ? 1 : 0)

	// ── Búsqueda de usuarios ─────────────────────────────────────────────
	const handleSearch = useCallback(
		async (query: string) => {
			setSearchQuery(query)
			if (query.trim().length < 2) {
				setSearchResults([])
				return
			}
			try {
				setSearching(true)
				const addedUserIds = confirmed.filter((p) => p.type === 'user').map((p) => (p as any).userId)
				const { data } = await supabase
					.from('profiles')
					.select('id, full_name, avatar_url, skill_level')
					.ilike('full_name', `%${query.trim()}%`)
					.neq('id', user?.id ?? '')
					.limit(5)
				setSearchResults((data || []).filter((u) => !addedUserIds.includes(u.id)))
			} catch (err) {
				console.error('[Create] búsqueda:', err)
			} finally {
				setSearching(false)
			}
		},
		[confirmed, user?.id],
	)

	// ── Agregar jugadores ──────────────────────────────────────────────
	const doAddUser = (u: UserSearchResult, slot: TeamSlot | null) => {
		setConfirmed((prev) => [...prev, { type: 'user', id: Date.now().toString(), userId: u.id, name: u.full_name, avatarUrl: u.avatar_url, teamSlot: slot }])
		setSearchQuery('')
		setSearchResults([])
		setPendingUser(null)
	}

	const doAddGuest = (name: string, slot: TeamSlot | null) => {
		setConfirmed((prev) => [...prev, { type: 'guest', id: Date.now().toString(), name, teamSlot: slot }])
		setSearchQuery('')
		setSearchResults([])
		setPendingGuestName(null)
	}

	const addUserParticipant = (u: UserSearchResult) => {
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}
		if (teamMode === 'two_teams') {
			setPendingUser(u)
		} else {
			doAddUser(u, null)
		}
	}

	const addGuestParticipant = () => {
		if (!searchQuery.trim()) return
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}
		if (teamMode === 'two_teams') {
			setPendingGuestName(searchQuery.trim())
		} else {
			doAddGuest(searchQuery.trim(), null)
		}
	}

	const removeParticipant = (id: string) => setConfirmed((prev) => prev.filter((p) => p.id !== id))

	const moveParticipant = (id: string, toSlot: TeamSlot) => {
		setConfirmed((prev) => prev.map((p) => (p.id === id ? { ...p, teamSlot: toSlot } : p)))
	}

	// ── Cambio de modo ──────────────────────────────────────────────────
	const handleTeamModeChange = (mode: TeamMode) => {
		if (mode === 'none' && teamMode === 'two_teams') {
			// Limpiar todos los team_slots
			setConfirmed((prev) => prev.map((p) => ({ ...p, teamSlot: null })))
			setCreatorTeamSlot(null)
		}
		setTeamMode(mode)
	}

	// ── Contadores ───────────────────────────────────────────────────────
	const handleTotalChange = (delta: number) => {
		const next = totalPlayers + delta
		if (next < 4 || next > 22) return
		setTotalPlayers(next)
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
		if (!venueZoneState.inputText.trim()) {
			Alert.alert('Error', 'Ingresá la localidad del partido')
			return
		}
		if (venueZoneState.isDirty && !venueZoneState.coords) {
			const shouldContinue = await new Promise<boolean>((resolve) => {
				Alert.alert('Localidad sin confirmar', 'Seleccioná una opción del listado para que el partido aparezca en búsquedas por zona. ¿Crear sin confirmar la localidad?', [
					{ text: 'Volver', style: 'cancel', onPress: () => resolve(false) },
					{ text: 'Crear igual', onPress: () => resolve(true) },
				])
			})
			if (!shouldContinue) return
		}

		setIsLoading(true)
		try {
			const starts_at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()).toISOString()

			const match = await matchesService.create({
				creator_id: user.id,
				sport,
				title: `${sports.find((s) => s.key === sport)?.label} ${totalPlayers > 6 ? '5' : '3'}v${totalPlayers > 6 ? '5' : '3'}`,
				description: description.trim() || undefined,
				starts_at,
				venue_name: venueName.trim(),
				venue_zone: venueZoneState.inputText.trim() || null,
				venue_coordinates: venueZoneState.coords ?? undefined,
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
				is_mixed: false,
				team_mode: teamMode,
			})

			// Unirse como creador con su equipo asignado (si aplica)
			await matchParticipantsService.join(match.id, user.id, creatorTeamSlot ?? undefined)

			// Agregar participantes confirmados con su equipo
			await Promise.all(confirmed.map((p) => (p.type === 'user' ? matchParticipantsService.join(match.id, (p as any).userId, p.teamSlot ?? undefined) : matchParticipantsService.addGuest(match.id, p.name, p.teamSlot ?? undefined))))

			Alert.alert('¡Partido publicado!', 'Ya está visible para otros jugadores.', [{ text: 'Ver partido', onPress: () => router.replace(`/match/${match.id}`) }])
		} catch (error) {
			console.error('[Create]', error)
			Alert.alert('Error', 'No se pudo crear el partido. Intentá de nuevo.')
		} finally {
			setIsLoading(false)
		}
	}

	// ── Team picker inline para jugadores pendientes ──────────────────
	const renderTeamPicker = (name: string, onSelect: (slot: TeamSlot) => void, onCancel: () => void) => (
		<View style={localStyles.inlineTeamPicker}>
			<Text style={localStyles.inlineTeamPickerTitle}>¿A qué equipo va {name}?</Text>
			<View style={localStyles.inlineTeamBtns}>
				<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.A.border, backgroundColor: TEAM_CONFIG.A.bg }, teamACount >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => teamACount < perTeam && onSelect('A')} disabled={teamACount >= perTeam}>
					<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.A.color }]} />
					<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.A.color }]}>Equipo A {teamACount >= perTeam ? '(lleno)' : `(${teamACount}/${perTeam})`}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.B.border, backgroundColor: TEAM_CONFIG.B.bg }, teamBCount >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => teamBCount < perTeam && onSelect('B')} disabled={teamBCount >= perTeam}>
					<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.B.color }]} />
					<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.B.color }]}>Equipo B {teamBCount >= perTeam ? '(lleno)' : `(${teamBCount}/${perTeam})`}</Text>
				</TouchableOpacity>
			</View>
			<TouchableOpacity onPress={onCancel} style={localStyles.inlineTeamCancel}>
				<Text style={{ color: colors.textSecondaryDark, fontSize: 13 }}>Cancelar</Text>
			</TouchableOpacity>
		</View>
	)

	// ── Vista de equipos en modo two_teams ────────────────────────────
	const renderTeamsPreview = () => {
		const teamA = confirmed.filter((p) => p.teamSlot === 'A')
		const teamB = confirmed.filter((p) => p.teamSlot === 'B')
		const unassigned = confirmed.filter((p) => !p.teamSlot)

		return (
			<View style={{ gap: 12 }}>
				{/* Selector de equipo para el creador */}
				{!creatorTeamSlot ? (
					<View style={localStyles.creatorTeamSelector}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
							<View style={[localStyles.miniAvatar, { backgroundColor: colors.primary }]}>
								<Ionicons name='star' size={10} color={colors.backgroundDark} />
							</View>
							<Text style={{ color: colors.textPrimaryDark, fontSize: 13, fontWeight: '600' }}>Vos (creador) — elegí tu equipo:</Text>
						</View>
						<View style={{ flexDirection: 'row', gap: 10 }}>
							<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.A.border, backgroundColor: TEAM_CONFIG.A.bg }, teamACount >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => teamACount < perTeam && setCreatorTeamSlot('A')} disabled={teamACount >= perTeam}>
								<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.A.color }]} />
								<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.A.color }]}>Equipo A {teamACount >= perTeam ? '(lleno)' : `(${teamACount}/${perTeam})`}</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.B.border, backgroundColor: TEAM_CONFIG.B.bg }, teamBCount >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => teamBCount < perTeam && setCreatorTeamSlot('B')} disabled={teamBCount >= perTeam}>
								<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.B.color }]} />
								<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.B.color }]}>Equipo B {teamBCount >= perTeam ? '(lleno)' : `(${teamBCount}/${perTeam})`}</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : null}

				{/* Columnas A / B */}
				<View style={{ flexDirection: 'row', gap: 10 }}>
					{(['A', 'B'] as TeamSlot[]).map((slot) => {
						const cfg = TEAM_CONFIG[slot]
						const members = slot === 'A' ? teamA : teamB
						const creatorInThisTeam = creatorTeamSlot === slot
						// empties ya descuenta al creador si está en este equipo
						const empties = Math.max(0, perTeam - members.length - (creatorInThisTeam ? 1 : 0))
						return (
							<View key={slot} style={[localStyles.teamPreviewCol, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
								<View style={localStyles.teamPreviewHeader}>
									<View style={[localStyles.teamDot, { backgroundColor: cfg.color }]} />
									<Text style={[localStyles.teamPreviewTitle, { color: cfg.color }]}>{cfg.label}</Text>
									<Text style={[localStyles.teamPreviewCount, { color: cfg.color }]}>
										{members.length + (creatorInThisTeam ? 1 : 0)}/{perTeam}
									</Text>
								</View>

								{/* Fila del creador si está en este equipo */}
								{creatorInThisTeam && (
									<View style={localStyles.teamPreviewRow}>
										<View style={[localStyles.miniAvatar, { backgroundColor: colors.primary }]}>
											<Ionicons name='star' size={9} color={colors.backgroundDark} />
										</View>
										<Text style={[localStyles.teamPreviewName, { flex: 1 }]} numberOfLines={1}>
											Vos
										</Text>
										<TouchableOpacity onPress={() => setCreatorTeamSlot(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[localStyles.swapBtn, { borderColor: TEAM_CONFIG[slot === 'A' ? 'B' : 'A'].border }]}>
											<Ionicons name='swap-horizontal' size={11} color={TEAM_CONFIG[slot === 'A' ? 'B' : 'A'].color} />
										</TouchableOpacity>
									</View>
								)}

								{members.map((p) => (
									<View key={p.id} style={localStyles.teamPreviewRow}>
										<View style={[localStyles.miniAvatar, { backgroundColor: p.type === 'user' ? `${colors.info}30` : colors.surfaceDark }]}>{p.type === 'user' && (p as any).avatarUrl ? <Image source={{ uri: (p as any).avatarUrl }} style={localStyles.miniAvatarImg} /> : <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{p.name.charAt(0).toUpperCase()}</Text>}</View>
										<Text style={localStyles.teamPreviewName} numberOfLines={1}>
											{p.name}
										</Text>
										<TouchableOpacity onPress={() => moveParticipant(p.id, slot === 'A' ? 'B' : 'A')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[localStyles.swapBtn, { borderColor: TEAM_CONFIG[slot === 'A' ? 'B' : 'A'].border }]}>
											<Ionicons name='swap-horizontal' size={11} color={TEAM_CONFIG[slot === 'A' ? 'B' : 'A'].color} />
										</TouchableOpacity>
										<TouchableOpacity onPress={() => removeParticipant(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
											<Ionicons name='close-circle' size={16} color={colors.error} />
										</TouchableOpacity>
									</View>
								))}
								{Array.from({ length: empties }, (_, i) => (
									<View key={`e-${i}`} style={localStyles.emptySlotRow}>
										<Ionicons name='person-add-outline' size={12} color={cfg.color} style={{ opacity: 0.4 }} />
										<Text style={[localStyles.emptySlotText, { color: cfg.color }]}>Lugar libre</Text>
									</View>
								))}
							</View>
						)
					})}
				</View>

				{/* Sin equipo */}
				{unassigned.length > 0 && (
					<View style={localStyles.unassignedBox}>
						<Text style={localStyles.unassignedTitle}>Sin equipo asignado</Text>
						{unassigned.map((p) => (
							<View key={p.id} style={localStyles.unassignedRow}>
								<Text style={localStyles.unassignedName}>{p.name}</Text>
								<View style={{ flexDirection: 'row', gap: 6 }}>
									<TouchableOpacity style={[localStyles.assignBtn, { borderColor: TEAM_CONFIG.A.border }]} onPress={() => moveParticipant(p.id, 'A')}>
										<Text style={{ color: TEAM_CONFIG.A.color, fontSize: 11, fontWeight: '700' }}>A</Text>
									</TouchableOpacity>
									<TouchableOpacity style={[localStyles.assignBtn, { borderColor: TEAM_CONFIG.B.border }]} onPress={() => moveParticipant(p.id, 'B')}>
										<Text style={{ color: TEAM_CONFIG.B.color, fontSize: 11, fontWeight: '700' }}>B</Text>
									</TouchableOpacity>
									<TouchableOpacity onPress={() => removeParticipant(p.id)}>
										<Ionicons name='close-circle' size={18} color={colors.error} />
									</TouchableOpacity>
								</View>
							</View>
						))}
					</View>
				)}
			</View>
		)
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

					<Text style={[styles.sectionTitle, { marginTop: 16 }]}>Localidad del partido</Text>
					<VenueZoneInput value={venueZoneState.inputText} coords={venueZoneState.coords} suggestions={venueZoneState.suggestions} searching={venueZoneState.searching} isDirty={venueZoneState.isDirty} onChangeText={venueZoneState.onChangeText} onSelect={venueZoneState.onSelect} onDetectGPS={venueZoneState.onDetectGPS} onDismiss={venueZoneState.onDismiss} />
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

				{/* ── Modo de equipos ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Modo de equipos</Text>
					<View style={styles.levelSelector}>
						<TouchableOpacity style={[styles.levelOption, teamMode === 'none' && styles.levelOptionActive]} onPress={() => handleTeamModeChange('none')}>
							<Text style={[styles.levelText, teamMode === 'none' && styles.levelTextActive]}>Sin equipos</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[styles.levelOption, teamMode === 'two_teams' && styles.levelOptionActive]} onPress={() => handleTeamModeChange('two_teams')}>
							<Text style={[styles.levelText, teamMode === 'two_teams' && styles.levelTextActive]}>Equipo A vs B</Text>
						</TouchableOpacity>
					</View>
					<Text style={styles.levelHint}>{teamMode === 'none' ? 'Los jugadores se unen libremente, los equipos se arman después' : 'Cada jugador elige su equipo al unirse · vos podés moverlos'}</Text>
				</View>

				{/* ── Participantes confirmados ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Jugadores confirmados{' '}
						<Text style={{ color: colors.textSecondaryDark, fontSize: 13, fontWeight: '400' }}>
							(opcional · {slotsAvailable} lugar{slotsAvailable !== 1 ? 'es' : ''})
						</Text>
					</Text>

					{/* Selector de equipo inline — usuario pendiente */}
					{pendingUser &&
						renderTeamPicker(
							pendingUser.full_name,
							(slot) => doAddUser(pendingUser, slot),
							() => setPendingUser(null),
						)}

					{/* Selector de equipo inline — invitado pendiente */}
					{pendingGuestName &&
						renderTeamPicker(
							pendingGuestName,
							(slot) => doAddGuest(pendingGuestName, slot),
							() => setPendingGuestName(null),
						)}

					{/* Input de búsqueda — solo si no hay pending */}
					{!pendingUser && !pendingGuestName && slotsAvailable > 0 && (
						<>
							<View style={styles.guestInputRow}>
								<View style={[styles.inputWrapper, { flex: 1 }]}>
									<Ionicons name='search' size={18} color={colors.textSecondaryDark} />
									<TextInput style={styles.input} placeholder='Buscar usuario o agregar invitado' placeholderTextColor={colors.textSecondaryDark} value={searchQuery} onChangeText={handleSearch} returnKeyType='done' onSubmitEditing={addGuestParticipant} />
									{searching && <ActivityIndicator size='small' color={colors.primary} />}
								</View>
								{searchQuery.trim().length > 0 && searchResults.length === 0 && !searching && (
									<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={addGuestParticipant}>
										<Ionicons name='add' size={20} color={colors.backgroundDark} />
									</TouchableOpacity>
								)}
							</View>

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

					{/* Lista / vista de equipos */}
					{(confirmed.length > 0 || teamMode === 'two_teams') && (
						<View style={styles.guestListContainer}>
							{/* Creador — solo visible en modo sin equipos */}
							{teamMode !== 'two_teams' && (
								<View style={styles.confirmedRow}>
									<View style={[styles.confirmedAvatar, { backgroundColor: colors.primary }]}>
										<Ionicons name='star' size={13} color={colors.backgroundDark} />
									</View>
									<View style={{ flex: 1 }}>
										<Text style={styles.confirmedName}>Vos (creador)</Text>
									</View>
								</View>
							)}

							{teamMode === 'two_teams'
								? renderTeamsPreview()
								: confirmed.map((p) => (
										<View key={p.id} style={styles.guestRow}>
											{p.type === 'user' && (p as any).avatarUrl ? (
												<Image source={{ uri: (p as any).avatarUrl }} style={styles.confirmedAvatar} />
											) : (
												<View style={[styles.confirmedAvatar, { backgroundColor: p.type === 'user' ? `${colors.info}30` : colors.surfaceDark, borderWidth: 1, borderColor: p.type === 'user' ? colors.info : colors.borderDark }]}>
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

const localStyles = StyleSheet.create({
	creatorTeamSelector: {
		backgroundColor: `${colors.primary}12`,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: `${colors.primary}30`,
		padding: 12,
	},
	inlineTeamPicker: {
		backgroundColor: colors.surfaceDark,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: 16,
		marginBottom: 12,
		gap: 10,
	},
	inlineTeamPickerTitle: {
		color: colors.textPrimaryDark,
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	inlineTeamBtns: {
		flexDirection: 'row',
		gap: 10,
	},
	inlineTeamBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 12,
	},
	inlineTeamBtnDisabled: {
		opacity: 0.4,
	},
	inlineTeamBtnText: {
		fontSize: 13,
		fontWeight: '700',
	},
	inlineTeamCancel: {
		alignItems: 'center',
		paddingVertical: 4,
	},
	teamDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	teamPreviewCol: {
		flex: 1,
		borderRadius: 12,
		borderWidth: 1,
		padding: 10,
		gap: 4,
	},
	teamPreviewHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		marginBottom: 6,
	},
	teamPreviewTitle: {
		fontSize: 12,
		fontWeight: '700',
		flex: 1,
	},
	teamPreviewCount: {
		fontSize: 11,
		fontWeight: '600',
	},
	teamPreviewRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 3,
	},
	teamPreviewName: {
		flex: 1,
		color: colors.textPrimaryDark,
		fontSize: 12,
		fontWeight: '500',
	},
	miniAvatar: {
		width: 22,
		height: 22,
		borderRadius: 11,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
	miniAvatarImg: {
		width: 22,
		height: 22,
		borderRadius: 11,
	},
	swapBtn: {
		borderWidth: 1,
		borderRadius: 99,
		padding: 3,
	},
	emptySlotRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 3,
		opacity: 0.5,
	},
	emptySlotText: {
		fontSize: 11,
	},
	unassignedBox: {
		backgroundColor: colors.surfaceDark,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: 10,
		gap: 6,
	},
	unassignedTitle: {
		color: colors.textSecondaryDark,
		fontSize: 11,
		fontWeight: '600',
		marginBottom: 2,
	},
	unassignedRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	unassignedName: {
		flex: 1,
		color: colors.textPrimaryDark,
		fontSize: 13,
		fontWeight: '500',
	},
	assignBtn: {
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
})
