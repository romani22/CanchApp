import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import Loader from '@/components/ui/Loader'
import { buildMatchTitle, levels, sports } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type ParticipantRow = {
	id: string
	user_id: string | null
	guest_name: string | null
	user: { id: string; full_name: string; avatar_url: string | null } | null
}

export default function EditMatchScreen() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [loadingMatch, setLoadingMatch] = useState(true)
	const [saving, setSaving] = useState(false)

	const [sport, setSport] = useState<SportType>('futbol')
	const [titleMatch, setTitleMatch] = useState('')
	const [date, setDate] = useState(new Date())
	const [time, setTime] = useState(new Date())
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [venueName, setVenueName] = useState('')
	const [totalPlayers, setTotalPlayers] = useState(10)
	const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermedio')
	const [description, setDescription] = useState('')
	const [participants, setParticipants] = useState<ParticipantRow[]>([])
	const [newGuestName, setNewGuestName] = useState('')

	// Calculado igual que en Create — siempre derivado, nunca guardado aparte
	const playersNeeded = Math.max(0, totalPlayers - participants.length)
	const slotsAvailable = totalPlayers - participants.length

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
			setTitleMatch(data.title)
			setVenueName(data.venue_name)
			setTotalPlayers(data.total_players)
			setSkillLevel(data.skill_level)
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
		// No puede ser menor que los participantes actuales ni mayor de 22
		if (next < participants.length || next < 4 || next > 22) return
		setTotalPlayers(next)
	}

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
				title: titleMatch === '' ? buildMatchTitle(sport, totalPlayers) : titleMatch,
				starts_at,
				venue_name: venueName.trim(),
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
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

	const handleRemoveParticipant = (participant: ParticipantRow) => {
		const isCreatorParticipant = participant.user_id === user?.id
		if (isCreatorParticipant) return // no se puede quitar al creador

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

	const handleAddGuest = async () => {
		if (!newGuestName.trim()) return
		if (slotsAvailable <= 0) {
			Alert.alert('Sin lugar', 'Ya completaste el total de jugadores.')
			return
		}
		try {
			const { error } = await matchParticipantsService.addGuest(id as string, newGuestName.trim())
			if (error) throw error
			setParticipants((prev) => [...prev, { id: `temp-${Date.now()}`, user_id: null, guest_name: newGuestName.trim(), user: null }])
			setNewGuestName('')
		} catch (err) {
			console.error('[EditMatch] Error agregando invitado:', err)
			Alert.alert('Error', 'No se pudo agregar el jugador.')
		}
	}

	if (loadingMatch) return <Loader title='Cargando partido...' />

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

					{/* Resumen — igual que en Create */}
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

				{/* ── Participantes actuales ── */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Jugadores confirmados{' '}
						<Text style={{ color: colors.textSecondaryDark, fontSize: 13, fontWeight: '400' }}>
							({participants.length}/{totalPlayers})
						</Text>
					</Text>

					{participants.map((p) => {
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
					})}

					{/* Agregar invitado — igual visual que Create */}
					{slotsAvailable > 0 && (
						<View style={[styles.guestInputRow, { marginTop: 12 }]}>
							<View style={[styles.inputWrapper, { flex: 1 }]}>
								<Ionicons name='person-add-outline' size={18} color={colors.textSecondaryDark} />
								<TextInput style={styles.input} placeholder='Agregar invitado por nombre' placeholderTextColor={colors.textSecondaryDark} value={newGuestName} onChangeText={setNewGuestName} onSubmitEditing={handleAddGuest} returnKeyType='done' />
							</View>
							{newGuestName.trim().length > 0 && (
								<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={handleAddGuest}>
									<Ionicons name='add' size={20} color={colors.backgroundDark} />
								</TouchableOpacity>
							)}
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
