import { styles } from '@/assets/styles/Match.styles'
import { Chip } from '@/components/ui/Chip'
import { useAuth } from '@/context/AuthContext'
import { matchesService } from '@/services/matches.service'
import { matchParticipantsService } from '@/services/matchParticipants.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
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

export default function CreateMatchScreen() {
	const { user } = useAuth()
	const [isLoading, setIsLoading] = useState(false)

	// Form state
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
	const [guests, setGuests] = useState<string[]>([])
	const [guestName, setGuestName] = useState('')

	const handleCreateMatch = async () => {
		if (!user) {
			Alert.alert('Error', 'Debes iniciar sesion para crear un partido')
			return
		}

		if (!venueName.trim()) {
			Alert.alert('Error', 'Ingresa el nombre de la cancha o club')
			return
		}

		if (guests.length + 1 > totalPlayers) {
			Alert.alert('Error', 'Los jugadores faltantes no pueden ser mas que el total menos tu')
			return
		}

		setIsLoading(true)
		try {
			const match = await matchesService.create({
				creator_id: user.id,
				sport,
				title: `${sports.find((s) => s.key === sport)?.label} ${totalPlayers > 6 ? '5' : '3'}v${totalPlayers > 6 ? '5' : '3'}`,
				description: description.trim() || undefined,
				date: format(date, 'yyyy-MM-dd'),
				start_time: format(time, 'HH:mm'),
				venue_name: venueName.trim(),
				total_players: totalPlayers,
				players_needed: playersNeeded,
				skill_level: skillLevel,
				is_mixed: false,
			})
			await matchParticipantsService.join(match.id, user.id)

			for (const guest of guests) {
				await matchParticipantsService.addGuest(match.id, guest)
			}

			Alert.alert('Exito', 'Tu partido ha sido publicado', [{ text: 'Ver Partido', onPress: () => router.replace(`/match/${match.id}`) }])
		} catch (error) {
			console.error('Error creating match:', error)
			Alert.alert('Error', 'No se pudo crear el partido')
		} finally {
			setIsLoading(false)
		}
	}

	const adjustCount = (current: number, delta: number, min: number, max: number, setter: (value: number) => void) => {
		const newValue = current + delta
		if (newValue >= min && newValue <= max) {
			setter(newValue)
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

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Sport Selection */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Selecciona el Deporte</Text>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
						<View style={styles.chipsContainer}>
							{sports.map((s) => (
								<Chip key={s.key} label={s.label} icon={s.icon} selected={sport === s.key} onPress={() => setSport(s.key)} size='lg' />
							))}
						</View>
					</ScrollView>
				</View>

				{/* Date and Time */}
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

				{/* Date/Time Pickers */}
				{showDatePicker && (
					<DateTimePicker
						value={date}
						mode='date'
						minimumDate={new Date()}
						onChange={(event, selectedDate) => {
							setShowDatePicker(Platform.OS === 'ios')
							if (selectedDate) setDate(selectedDate)
						}}
					/>
				)}
				{showTimePicker && (
					<DateTimePicker
						value={time}
						mode='time'
						is24Hour
						onChange={(event, selectedTime) => {
							setShowTimePicker(Platform.OS === 'ios')
							if (selectedTime) setTime(selectedTime)
						}}
					/>
				)}

				{/* Location */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Ubicacion</Text>
					<View style={styles.inputWrapper}>
						<Ionicons name='location' size={20} color={colors.textSecondaryDark} />
						<TextInput style={styles.input} placeholder='Nombre de la cancha o club' placeholderTextColor={colors.textSecondaryDark} value={venueName} onChangeText={setVenueName} />
					</View>
				</View>

				{/* Players */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Jugadores</Text>

					{/* Total Players */}
					<View style={styles.counterRow}>
						<View style={styles.counterInfo}>
							<Text style={styles.counterLabel}>Total de jugadores</Text>
							<Text style={styles.counterHint}>Capacidad de la cancha</Text>
						</View>
						<View style={styles.counterControls}>
							<TouchableOpacity style={styles.counterButton} onPress={() => adjustCount(totalPlayers, -1, 4, 22, setTotalPlayers)}>
								<Ionicons name='remove' size={20} color={colors.primary} />
							</TouchableOpacity>
							<Text style={styles.counterValue}>{totalPlayers}</Text>
							<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => adjustCount(totalPlayers, 1, 4, 22, setTotalPlayers)}>
								<Ionicons name='add' size={20} color={colors.backgroundDark} />
							</TouchableOpacity>
						</View>
					</View>

					{/* Players Needed */}
					<View style={styles.counterRow}>
						<View style={styles.counterInfo}>
							<Text style={styles.counterLabel}>Jugadores faltantes</Text>
							<Text style={styles.counterHint}>A cuantos buscas invitar</Text>
						</View>
						<View style={styles.counterControls}>
							<TouchableOpacity style={styles.counterButton} onPress={() => adjustCount(playersNeeded, -1, 1, totalPlayers - 1, setPlayersNeeded)}>
								<Ionicons name='remove' size={20} color={colors.primary} />
							</TouchableOpacity>
							<Text style={styles.counterValue}>{playersNeeded}</Text>
							<TouchableOpacity style={[styles.counterButton, styles.counterButtonActive]} onPress={() => adjustCount(playersNeeded, 1, 1, totalPlayers - 1, setPlayersNeeded)}>
								<Ionicons name='add' size={20} color={colors.backgroundDark} />
							</TouchableOpacity>
						</View>
					</View>
				</View>
				{/* Confirmados manualmente */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Agregar jugadores confirmados (opcional)</Text>

					<View style={{ flexDirection: 'row', gap: 8 }}>
						<TextInput style={[styles.input, { flex: 1 }]} placeholder='Nombre del jugador' placeholderTextColor={colors.textSecondaryDark} value={guestName} onChangeText={setGuestName} />

						<TouchableOpacity
							style={[styles.counterButton, styles.counterButtonActive]}
							onPress={() => {
								if (!guestName.trim()) return
								setGuests((prev) => [...prev, guestName.trim()])
								setGuestName('')
							}}
						>
							<Ionicons name='add' size={20} color={colors.backgroundDark} />
						</TouchableOpacity>
					</View>

					{guests.length > 0 && (
						<View style={{ marginTop: 10 }}>
							{guests.map((g, index) => (
								<View
									key={index}
									style={{
										flexDirection: 'row',
										justifyContent: 'space-between',
										alignItems: 'center',
										marginBottom: 6,
									}}
								>
									<Text style={{ color: colors.textPrimaryDark }}>{g}</Text>

									<TouchableOpacity onPress={() => setGuests((prev) => prev.filter((_, i) => i !== index))}>
										<Ionicons name='close-circle' size={20} color='red' />
									</TouchableOpacity>
								</View>
							))}
						</View>
					)}
				</View>

				{/* Skill Level */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Nivel de Juego</Text>
					<View style={styles.levelSelector}>
						{levels.map((level, index) => (
							<TouchableOpacity key={level.key} style={[styles.levelOption, skillLevel === level.key && styles.levelOptionActive, index === 0 && styles.levelOptionFirst, index === levels.length - 1 && styles.levelOptionLast]} onPress={() => setSkillLevel(level.key)}>
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

				{/* Description */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Observaciones (opcional)</Text>
					<TextInput style={styles.textArea} placeholder='Agrega informacion adicional sobre el partido...' placeholderTextColor={colors.textSecondaryDark} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical='top' />
				</View>
			</ScrollView>

			{/* Footer Button */}
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
