import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import Loader from '@/components/ui/Loader'
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
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
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

export default function EditMatchScreen() {
	const { id } = useLocalSearchParams()
	const { user } = useAuth()

	const [loadingMatch, setLoadingMatch] = useState(true)
	const [saving, setSaving] = useState(false)

	// Form state — se inicializa con los datos del partido
	const [sport, setSport] = useState<SportType>('futbol')
	const [date, setDate] = useState(new Date())
	const [time, setTime] = useState(new Date())
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [venueName, setVenueName] = useState('')
	const [totalPlayers, setTotalPlayers] = useState(10)
	const [playersNeeded, setPlayersNeeded] = useState(4)
	const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermedio')
	const [description, setDescription] = useState('')

	// Participantes invitados actuales (guests)
	const [existingParticipants, setExistingParticipants] = useState<any[]>([])
	const [newGuestName, setNewGuestName] = useState('')

	useEffect(() => {
		loadMatch()
	}, [])

	const loadMatch = async () => {
		try {
			const { data, error } = await matchesService.getById(id as string)
			if (error) throw error
			if (!data) {
				router.back()
				return
			}

			// Verificar que el usuario es el creador
			if (data.creator_id !== user?.id) {
				Alert.alert('Sin permiso', 'Solo el creador puede editar este partido.')
				router.back()
				return
			}

			// Inicializar form con datos existentes
			setSport(data.sport)
			setVenueName(data.venue_name)
			setTotalPlayers(data.total_players)
			setPlayersNeeded(data.players_needed)
			setSkillLevel(data.skill_level)
			setDescription(data.description || '')

			const matchDate = parseISO(data.starts_at)
			setDate(matchDate)
			setTime(matchDate)

			setExistingParticipants(data.participants || [])
		} catch (err) {
			console.error('[EditMatch] Error cargando:', err)
			router.back()
		} finally {
			setLoadingMatch(false)
		}
	}

	const handleSave = async () => {
		if (!venueName.trim()) {
			Alert.alert('Error', 'Ingresá el nombre de la cancha o club')
			return
		}

		const currentParticipants = existingParticipants.length
		if (currentParticipants > totalPlayers) {
			Alert.alert('Error', `Ya hay ${currentParticipants} participantes. El total no puede ser menor a eso.`)
			return
		}

		const starts_at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()).toISOString()

		try {
			setSaving(true)
			await matchesService.update(id as string, {
				sport,
				title: `${sports.find((s) => s.key === sport)?.label} ${totalPlayers > 6 ? '5' : '3'}v${totalPlayers > 6 ? '5' : '3'}`,
				starts_at,
				venue_name: venueName.trim(),
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
				description: description.trim() || null,
			})

			Alert.alert('Guardado', 'El partido fue actualizado correctamente.', [{ text: 'Ver partido', onPress: () => router.back() }])
		} catch (err) {
			console.error('[EditMatch] Error guardando:', err)
			Alert.alert('Error', 'No se pudo guardar. Intentá de nuevo.')
		} finally {
			setSaving(false)
		}
	}

	const handleRemoveParticipant = (participant: any) => {
		const isGuest = !participant.user_id
		const name = participant.user?.full_name || participant.guest_name || 'este jugador'

		Alert.alert('Quitar jugador', `¿Querés quitar a ${name} del partido?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Quitar',
				style: 'destructive',
				onPress: async () => {
					try {
						if (isGuest) {
							await matchParticipantsService.removeGuest(id as string, participant.guest_name)
						} else {
							await matchParticipantsService.leave(id as string, participant.user_id)
						}
						setExistingParticipants((prev) => prev.filter((p) => p.id !== participant.id))
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

		try {
			const { error } = await matchParticipantsService.addGuest(id as string, newGuestName.trim())
			if (error) throw error

			// Agregar al estado local con estructura similar a la que devuelve la DB
			setExistingParticipants((prev) => [
				...prev,
				{
					id: `temp-${Date.now()}`,
					user_id: null,
					guest_name: newGuestName.trim(),
					user: null,
				},
			])
			setNewGuestName('')
		} catch (err) {
			console.error('[EditMatch] Error agregando guest:', err)
			Alert.alert('Error', 'No se pudo agregar el jugador.')
		}
	}

	const adjustCount = (current: number, delta: number, min: number, max: number, setter: (v: number) => void) => {
		const next = current + delta
		if (next >= min && next <= max) setter(next)
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

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Deporte */}
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

				{/* Fecha y hora */}
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

				{/* Ubicación */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Ubicación</Text>
					<View style={styles.inputWrapper}>
						<Ionicons name='location' size={20} color={colors.textSecondaryDark} />
						<TextInput style={styles.input} placeholder='Nombre de la cancha o club' placeholderTextColor={colors.textSecondaryDark} value={venueName} onChangeText={setVenueName} />
					</View>
				</View>

				{/* Jugadores */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Jugadores</Text>

					<View style={styles.counterRow}>
						<View style={styles.counterInfo}>
							<Text style={styles.counterLabel}>Total de jugadores</Text>
							<Text style={styles.counterHint}>Capacidad de la cancha</Text>
						</View>
						<View style={styles.counterControls}>
							<TouchableOpacity style={styles.counterButton} onPress={() => adjustCount(totalPlayers, -1, existingParticipants.length, 22, setTotalPlayers)}>
								<Ionicons name='remove' size={20} color={colors.primary} />
							</TouchableOpacity>
							<Text style={styles.counterValue}>{totalPlayers}</Text>
							<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => adjustCount(totalPlayers, 1, existingParticipants.length, 22, setTotalPlayers)}>
								<Ionicons name='add' size={20} color={colors.backgroundDark} />
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.counterRow}>
						<View style={styles.counterInfo}>
							<Text style={styles.counterLabel}>Jugadores faltantes</Text>
							<Text style={styles.counterHint}>Cuántos más buscás</Text>
						</View>
						<View style={styles.counterControls}>
							<TouchableOpacity style={styles.counterButton} onPress={() => adjustCount(playersNeeded, -1, 0, totalPlayers - existingParticipants.length, setPlayersNeeded)}>
								<Ionicons name='remove' size={20} color={colors.primary} />
							</TouchableOpacity>
							<Text style={styles.counterValue}>{playersNeeded}</Text>
							<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => adjustCount(playersNeeded, 1, 0, totalPlayers - existingParticipants.length, setPlayersNeeded)}>
								<Ionicons name='add' size={20} color={colors.backgroundDark} />
							</TouchableOpacity>
						</View>
					</View>
				</View>

				{/* Lista de participantes actuales */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Participantes ({existingParticipants.length}/{totalPlayers})
					</Text>

					{existingParticipants.map((p) => {
						const isCreator = p.user_id === user?.id
						const name = p.user?.full_name || p.guest_name || 'Sin nombre'
						const isGuest = !p.user_id

						return (
							<View key={p.id} style={localStyles.participantRow}>
								<View style={localStyles.participantAvatar}>
									<Text style={localStyles.participantInitial}>{name.charAt(0).toUpperCase()}</Text>
								</View>
								<View style={localStyles.participantInfo}>
									<Text style={localStyles.participantName}>{name}</Text>
									<Text style={localStyles.participantBadge}>{isCreator ? 'Creador' : isGuest ? 'Invitado' : 'Registrado'}</Text>
								</View>
								{/* No permitir quitar al creador */}
								{!isCreator && (
									<TouchableOpacity onPress={() => handleRemoveParticipant(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
										<Ionicons name='close-circle' size={22} color={colors.error} />
									</TouchableOpacity>
								)}
							</View>
						)
					})}

					{/* Agregar invitado */}
					<View style={[styles.guestInputRow, { marginTop: 12 }]}>
						<TextInput style={[styles.input, { flex: 1 }]} placeholder='Agregar invitado por nombre' placeholderTextColor={colors.textSecondaryDark} value={newGuestName} onChangeText={setNewGuestName} onSubmitEditing={handleAddGuest} returnKeyType='done' />
						<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={handleAddGuest}>
							<Ionicons name='add' size={20} color={colors.backgroundDark} />
						</TouchableOpacity>
					</View>
				</View>

				{/* Nivel */}
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

				{/* Observaciones */}
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
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	participantInitial: {
		color: colors.primary,
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
