import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import Loader from '@/components/ui/Loader'
import { VenueZoneInput } from '@/components/ui/Venuezoneinput'
import { buildMatchTitle, levels, sports } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { useVenueZone } from '@/hooks/useVenueZone'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType, TeamMode, TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const TEAM_CONFIG = {
	A: { label: 'Equipo A', color: colors.info, bg: `${colors.info}18`, border: `${colors.info}40` },
	B: { label: 'Equipo B', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
} as const

type ParticipantRow = {
	id: string
	user_id: string | null
	guest_name: string | null
	team_slot: TeamSlot | null
	user: { id: string; full_name: string; avatar_url: string | null } | null
}

export default function EditMatchScreen() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [loadingMatch, setLoadingMatch] = useState(true)
	const [saving, setSaving] = useState(false)

	const [sport, setSport] = useState<SportType>('futbol')
	const [date, setDate] = useState(new Date())
	const [time, setTime] = useState(new Date())
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [venueName, setVenueName] = useState('')
	const [initialZone, setInitialZone] = useState('')
	const [initialCoords, setInitialCoords] = useState<{ x: number; y: number } | null>(null)
	const venueZoneState = useVenueZone(initialZone, initialCoords)
	const [totalPlayers, setTotalPlayers] = useState(10)
	const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermedio')
	const [teamMode, setTeamMode] = useState<TeamMode>('none')
	const [description, setDescription] = useState('')
	const [participants, setParticipants] = useState<ParticipantRow[]>([])
	const [newGuestName, setNewGuestName] = useState('')
	const [movingId, setMovingId] = useState<string | null>(null)

	const playersNeeded = Math.max(0, totalPlayers - participants.length)
	const slotsAvailable = totalPlayers - participants.length
	const perTeam = Math.floor(totalPlayers / 2)

	const loadMatch = useCallback(async () => {
		try {
			const { data, error } = await matchesService.getById(id as string)
			if (error) throw error
			if (!data) {
				router.back()
				return
			}

			if (data.creator_id !== user?.id) {
				Alert.alert('Sin permiso', 'Solo el creador puede editar este partido.')
				router.back()
				return
			}

			setSport(data.sport)
			setVenueName(data.venue_name)
			setInitialZone(data.venue_zone || '')
			setInitialCoords((data.venue_coordinates as { x: number; y: number } | null) ?? null)
			setTotalPlayers(data.total_players)
			setSkillLevel(data.skill_level)
			setTeamMode((data.team_mode as TeamMode) || 'none')
			setDescription(data.description || '')
			const matchDate = parseISO(data.starts_at)
			setDate(matchDate)
			setTime(matchDate)
			setParticipants((data.participants as unknown as ParticipantRow[]) ?? [])
		} catch (err) {
			console.error('[EditMatch] Error cargando:', err)
			router.back()
		} finally {
			setLoadingMatch(false)
		}
	}, [id, user?.id])

	useEffect(() => {
		loadMatch()
	}, [loadMatch])

	const handleTotalChange = (delta: number) => {
		const next = totalPlayers + delta
		if (next < participants.length || next < 4 || next > 22) return
		setTotalPlayers(next)
	}

	// ── Cambio de modo de equipos ────────────────────────────────────
	const handleTeamModeChange = async (mode: TeamMode) => {
		if (mode === teamMode) return

		if (mode === 'none' && teamMode === 'two_teams') {
			Alert.alert('Quitar equipos', 'Todos los jugadores perderán su equipo asignado. ¿Continuar?', [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Continuar',
					onPress: async () => {
						try {
							await matchParticipantsService.clearAllTeamSlots(id as string)
							setParticipants((prev) => prev.map((p) => ({ ...p, team_slot: null })))
							setTeamMode('none')
						} catch (err) {
							console.error('[EditMatch] Error limpiando slots:', err)
							Alert.alert('Error', 'No se pudo limpiar los equipos.')
						}
					},
				},
			])
		} else {
			setTeamMode(mode)
		}
	}

	// ── Mover jugador entre equipos ──────────────────────────────────
	const handleMoveParticipant = async (participant: ParticipantRow, toSlot: TeamSlot) => {
		setMovingId(participant.id)
		try {
			const { error } = await matchParticipantsService.assignTeam(participant.id, toSlot)
			if (error) throw error
			setParticipants((prev) => prev.map((p) => (p.id === participant.id ? { ...p, team_slot: toSlot } : p)))
		} catch (err) {
			console.error('[EditMatch] Error moviendo jugador:', err)
			Alert.alert('Error', 'No se pudo mover el jugador.')
		} finally {
			setMovingId(null)
		}
	}

	// ── Asignar equipo (unassigned) ──────────────────────────────────
	const handleAssignTeam = async (participant: ParticipantRow, slot: TeamSlot) => {
		setMovingId(participant.id)
		try {
			const { error } = await matchParticipantsService.assignTeam(participant.id, slot)
			if (error) throw error
			setParticipants((prev) => prev.map((p) => (p.id === participant.id ? { ...p, team_slot: slot } : p)))
		} catch (err) {
			console.error('[EditMatch] Error asignando equipo:', err)
			Alert.alert('Error', 'No se pudo asignar el equipo.')
		} finally {
			setMovingId(null)
		}
	}

	// ── Guardar ──────────────────────────────────────────────────────
	const handleSave = async () => {
		if (!venueName.trim()) {
			Alert.alert('Error', 'Ingresá el nombre de la cancha o club')
			return
		}

		const starts_at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()).toISOString()

		try {
			setSaving(true)
			await matchesService.update(id as string, {
				sport,
				title: buildMatchTitle(sport, totalPlayers),
				starts_at,
				venue_name: venueName.trim(),
				venue_zone: venueZoneState.inputText.trim() || null,
				venue_coordinates: venueZoneState.coords ?? undefined,
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
				team_mode: teamMode,
				description: description.trim() || null,
			})
			Alert.alert('Guardado', 'El partido fue actualizado.', [{ text: 'Ver partido', onPress: () => router.back() }])
		} catch (err) {
			console.error('[EditMatch] Error guardando:', err)
			Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.')
		} finally {
			setSaving(false)
		}
	}

	// ── Quitar participante ──────────────────────────────────────────
	const handleRemoveParticipant = (participant: ParticipantRow) => {
		const isCreatorParticipant = participant.user_id === user?.id
		if (isCreatorParticipant) return

		const name = participant.user?.full_name ?? participant.guest_name ?? 'este jugador'

		Alert.alert('Quitar jugador', `¿Querés quitar a ${name} del partido?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Quitar',
				style: 'destructive',
				onPress: async () => {
					try {
						if (participant.guest_name) {
							await matchParticipantsService.removeGuest(id as string, participant.guest_name)
						} else if (participant.user_id) {
							await matchParticipantsService.leave(id as string, participant.user_id)
						}
						setParticipants((prev) => prev.filter((p) => p.id !== participant.id))
					} catch (err) {
						console.error('[EditMatch] Error quitando participante:', err)
						Alert.alert('Error', 'No se pudo quitar al jugador.')
					}
				},
			},
		])
	}

	// ── Agregar invitado ─────────────────────────────────────────────
	const handleAddGuest = async (teamSlot?: TeamSlot) => {
		if (!newGuestName.trim()) return
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}

		// En modo equipos, si no se pasó slot, preguntar
		if (teamMode === 'two_teams' && !teamSlot) {
			setPendingGuestAdd(newGuestName.trim())
			return
		}

		try {
			const { error } = await matchParticipantsService.addGuest(id as string, newGuestName.trim(), teamSlot)
			if (error) throw error
			setParticipants((prev) => [...prev, { id: `temp-${Date.now()}`, user_id: null, guest_name: newGuestName.trim(), team_slot: teamSlot ?? null, user: null }])
			setNewGuestName('')
			setPendingGuestAdd(null)
		} catch (err) {
			console.error('[EditMatch] Error agregando invitado:', err)
			Alert.alert('Error', 'No se pudo agregar el jugador.')
		}
	}

	const [pendingGuestAdd, setPendingGuestAdd] = useState<string | null>(null)

	if (loadingMatch) return <Loader title='Cargando partido...' />

	const teamA = participants.filter((p) => p.team_slot === 'A')
	const teamB = participants.filter((p) => p.team_slot === 'B')
	const unassigned = participants.filter((p) => !p.team_slot)

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name='chevron-back' size={24} color={colors.textPrimaryDark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Editar Partido</Text>
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
						onChange={(_, selected) => {
							setShowDatePicker(Platform.OS === 'ios')
							if (selected) setDate(selected)
						}}
					/>
				)}
				{showTimePicker && (
					<DateTimePicker
						value={time}
						mode='time'
						is24Hour
						onChange={(_, selected) => {
							setShowTimePicker(Platform.OS === 'ios')
							if (selected) setTime(selected)
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
							<Text style={styles.counterHint}>Mínimo: {participants.length} (actuales)</Text>
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
							<Text style={styles.summaryNum}>{participants.length}</Text>
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

				{/* ── Participantes actuales ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Jugadores confirmados{' '}
						<Text style={{ color: colors.textSecondaryDark, fontSize: 13, fontWeight: '400' }}>
							({participants.length}/{totalPlayers})
						</Text>
					</Text>

					{/* Vista de equipos (modo two_teams) */}
					{teamMode === 'two_teams' ? (
						<>
							{/* Columnas A/B */}
							<View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
								{(['A', 'B'] as TeamSlot[]).map((slot) => {
									const cfg = TEAM_CONFIG[slot]
									const members = slot === 'A' ? teamA : teamB
									const empties = Math.max(0, perTeam - members.length)
									return (
										<View key={slot} style={[localStyles.teamCol, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
											<View style={localStyles.teamHeader}>
												<View style={[localStyles.teamDot, { backgroundColor: cfg.color }]} />
												<Text style={[localStyles.teamTitle, { color: cfg.color }]}>{cfg.label}</Text>
												<Text style={[localStyles.teamCount, { color: cfg.color }]}>
													{members.length}/{perTeam}
												</Text>
											</View>
											{members.map((p) => {
												const isCreatorRow = p.user_id === user?.id
												const name = p.user?.full_name ?? p.guest_name ?? 'Sin nombre'
												const otherSlot: TeamSlot = slot === 'A' ? 'B' : 'A'
												return (
													<View key={p.id} style={localStyles.playerRow}>
														{p.user?.avatar_url ? <Image source={{ uri: p.user.avatar_url }} style={localStyles.avatar} /> : <View style={[localStyles.avatar, { backgroundColor: isCreatorRow ? colors.primary : `${colors.info}30` }]}>{isCreatorRow ? <Ionicons name='star' size={10} color={colors.backgroundDark} /> : <Text style={localStyles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>}</View>}
														<Text style={localStyles.playerName} numberOfLines={1}>
															{name}
														</Text>
														{movingId === p.id ? (
															<ActivityIndicator size='small' color={cfg.color} />
														) : (
															<View style={{ flexDirection: 'row', gap: 5 }}>
																{!isCreatorRow && (
																	<TouchableOpacity style={[localStyles.moveBtn, { borderColor: TEAM_CONFIG[otherSlot].border }]} onPress={() => handleMoveParticipant(p, otherSlot)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
																		<Ionicons name='swap-horizontal' size={11} color={TEAM_CONFIG[otherSlot].color} />
																		<Text style={[localStyles.moveBtnText, { color: TEAM_CONFIG[otherSlot].color }]}>{otherSlot}</Text>
																	</TouchableOpacity>
																)}
																{!isCreatorRow && (
																	<TouchableOpacity onPress={() => handleRemoveParticipant(p)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
																		<Ionicons name='close-circle' size={16} color={colors.error} />
																	</TouchableOpacity>
																)}
															</View>
														)}
													</View>
												)
											})}
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

							{/* Sin equipo asignado */}
							{unassigned.length > 0 && (
								<View style={localStyles.unassignedBox}>
									<Text style={localStyles.unassignedTitle}>Sin equipo asignado — asignalos:</Text>
									{unassigned.map((p) => {
										const isCreatorRow = p.user_id === user?.id
										const name = p.user?.full_name ?? p.guest_name ?? 'Sin nombre'
										return (
											<View key={p.id} style={localStyles.unassignedRow}>
												<View style={[localStyles.avatar, { backgroundColor: isCreatorRow ? colors.primary : colors.surfaceDark }]}>{isCreatorRow ? <Ionicons name='star' size={10} color={colors.backgroundDark} /> : <Text style={localStyles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>}</View>
												<Text style={localStyles.unassignedName}>{name}</Text>
												{movingId === p.id ? (
													<ActivityIndicator size='small' color={colors.primary} />
												) : (
													<View style={{ flexDirection: 'row', gap: 6 }}>
														<TouchableOpacity style={[localStyles.assignBtn, { borderColor: TEAM_CONFIG.A.border }]} onPress={() => handleAssignTeam(p, 'A')} disabled={teamA.length >= perTeam}>
															<Text style={{ color: teamA.length >= perTeam ? colors.textSecondaryDark : TEAM_CONFIG.A.color, fontSize: 11, fontWeight: '700' }}>A</Text>
														</TouchableOpacity>
														<TouchableOpacity style={[localStyles.assignBtn, { borderColor: TEAM_CONFIG.B.border }]} onPress={() => handleAssignTeam(p, 'B')} disabled={teamB.length >= perTeam}>
															<Text style={{ color: teamB.length >= perTeam ? colors.textSecondaryDark : TEAM_CONFIG.B.color, fontSize: 11, fontWeight: '700' }}>B</Text>
														</TouchableOpacity>
														{!isCreatorRow && (
															<TouchableOpacity onPress={() => handleRemoveParticipant(p)}>
																<Ionicons name='close-circle' size={18} color={colors.error} />
															</TouchableOpacity>
														)}
													</View>
												)}
											</View>
										)
									})}
								</View>
							)}
						</>
					) : (
						/* Vista normal — lista plana */
						participants.map((p) => {
							const isCreatorRow = p.user_id === user?.id
							const name = p.user?.full_name ?? p.guest_name ?? 'Sin nombre'
							const isGuest = !p.user_id

							return (
								<View key={p.id} style={localStyles.participantRow}>
									{p.user?.avatar_url ? <Image source={{ uri: p.user.avatar_url }} style={localStyles.participantAvatar} /> : <View style={[localStyles.participantAvatar, { backgroundColor: isCreatorRow ? colors.primary : isGuest ? colors.surfaceDark : `${colors.info}30`, borderWidth: 1, borderColor: isCreatorRow ? colors.primary : isGuest ? colors.borderDark : colors.info }]}>{isCreatorRow ? <Ionicons name='star' size={14} color={colors.backgroundDark} /> : <Text style={[localStyles.participantInitial, { color: isGuest ? colors.textSecondaryDark : colors.info }]}>{name.charAt(0).toUpperCase()}</Text>}</View>}
									<View style={localStyles.participantInfo}>
										<Text style={localStyles.participantName}>{isCreatorRow ? `${name} (vos)` : name}</Text>
										<Text style={localStyles.participantBadge}>{isCreatorRow ? 'Creador' : isGuest ? 'Invitado' : 'Registrado'}</Text>
									</View>
									{!isCreatorRow && (
										<TouchableOpacity onPress={() => handleRemoveParticipant(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
											<Ionicons name='close-circle' size={22} color={colors.error} />
										</TouchableOpacity>
									)}
								</View>
							)
						})
					)}

					{/* Agregar invitado */}
					{slotsAvailable > 0 && (
						<>
							{/* Team picker inline cuando se quiere agregar invitado en modo equipos */}
							{pendingGuestAdd && teamMode === 'two_teams' && (
								<View style={localStyles.inlineTeamPicker}>
									<Text style={localStyles.inlineTeamPickerTitle}>¿A qué equipo va {pendingGuestAdd}?</Text>
									<View style={{ flexDirection: 'row', gap: 10 }}>
										<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.A.border, backgroundColor: TEAM_CONFIG.A.bg }, teamA.length >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => handleAddGuest('A')} disabled={teamA.length >= perTeam}>
											<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.A.color }]}>Equipo A {teamA.length >= perTeam ? '(lleno)' : `(${teamA.length}/${perTeam})`}</Text>
										</TouchableOpacity>
										<TouchableOpacity style={[localStyles.inlineTeamBtn, { borderColor: TEAM_CONFIG.B.border, backgroundColor: TEAM_CONFIG.B.bg }, teamB.length >= perTeam && localStyles.inlineTeamBtnDisabled]} onPress={() => handleAddGuest('B')} disabled={teamB.length >= perTeam}>
											<Text style={[localStyles.inlineTeamBtnText, { color: TEAM_CONFIG.B.color }]}>Equipo B {teamB.length >= perTeam ? '(lleno)' : `(${teamB.length}/${perTeam})`}</Text>
										</TouchableOpacity>
									</View>
									<TouchableOpacity onPress={() => setPendingGuestAdd(null)} style={{ alignItems: 'center', paddingVertical: 4 }}>
										<Text style={{ color: colors.textSecondaryDark, fontSize: 13 }}>Cancelar</Text>
									</TouchableOpacity>
								</View>
							)}

							{!pendingGuestAdd && (
								<View style={[styles.guestInputRow, { marginTop: 12 }]}>
									<View style={[styles.inputWrapper, { flex: 1 }]}>
										<Ionicons name='person-add-outline' size={18} color={colors.textSecondaryDark} />
										<TextInput style={styles.input} placeholder='Agregar invitado por nombre' placeholderTextColor={colors.textSecondaryDark} value={newGuestName} onChangeText={setNewGuestName} onSubmitEditing={() => handleAddGuest()} returnKeyType='done' />
									</View>
									{newGuestName.trim().length > 0 && (
										<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => handleAddGuest()}>
											<Ionicons name='add' size={20} color={colors.backgroundDark} />
										</TouchableOpacity>
									)}
								</View>
							)}
						</>
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
				<TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
					{saving ? (
						<ActivityIndicator color={colors.backgroundDark} />
					) : (
						<>
							<Ionicons name='checkmark' size={20} color={colors.backgroundDark} />
							<Text style={styles.submitButtonText}>Guardar cambios</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}

const localStyles = StyleSheet.create({
	teamCol: {
		flex: 1,
		borderRadius: 12,
		borderWidth: 1,
		padding: 10,
		gap: 4,
	},
	teamHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		marginBottom: 6,
	},
	teamDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	teamTitle: {
		fontSize: 12,
		fontWeight: '700',
		flex: 1,
	},
	teamCount: {
		fontSize: 11,
		fontWeight: '600',
	},
	playerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 3,
	},
	avatar: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
	avatarInitial: {
		color: 'white',
		fontWeight: '700',
		fontSize: 10,
	},
	playerName: {
		flex: 1,
		color: colors.textPrimaryDark,
		fontSize: 12,
		fontWeight: '500',
	},
	moveBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		borderWidth: 1,
		borderRadius: 99,
		paddingHorizontal: 5,
		paddingVertical: 2,
	},
	moveBtnText: {
		fontSize: 10,
		fontWeight: '700',
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
		gap: 8,
		marginBottom: 10,
	},
	unassignedTitle: {
		color: colors.textSecondaryDark,
		fontSize: 11,
		fontWeight: '600',
	},
	unassignedRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
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
	inlineTeamPicker: {
		backgroundColor: colors.surfaceDark,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: 14,
		marginTop: 10,
		gap: 10,
	},
	inlineTeamPickerTitle: {
		color: colors.textPrimaryDark,
		fontSize: 13,
		fontWeight: '600',
		textAlign: 'center',
	},
	inlineTeamBtn: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 10,
	},
	inlineTeamBtnDisabled: {
		opacity: 0.4,
	},
	inlineTeamBtnText: {
		fontSize: 12,
		fontWeight: '700',
	},
	participantRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
		borderBottomWidth: 0.5,
		borderBottomColor: 'rgba(255,255,255,0.08)',
		gap: 12,
	},
	participantAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	participantInitial: {
		fontWeight: '700',
		fontSize: 14,
	},
	participantInfo: {
		flex: 1,
	},
	participantName: {
		color: colors.textPrimaryDark,
		fontSize: 14,
		fontWeight: '500',
	},
	participantBadge: {
		color: colors.textSecondaryDark,
		fontSize: 11,
		marginTop: 2,
	},
})
