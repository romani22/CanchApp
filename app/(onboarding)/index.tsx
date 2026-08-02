import { styles } from '@/assets/styles/Onboarding.styles'
import { SportLevelDraft, SportLevelEditor, draftSports, draftToSportLevels, sportsMissingLevel, toggleDraftSport } from '@/components/ui/SportLevelEditor'
import { VenueZoneInput } from '@/components/ui/VenueZoneInput'
import { sports } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { useLocation } from '@/hooks/useLocation'
import { useVenueZone } from '@/hooks/useVenueZone'
import { storageService } from '@/services/storage.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const STEPS = ['Tu perfil', 'Deportes y nivel', 'Tu zona'] as const

/** Acepta números locales e internacionales: dígitos, espacios, +, -, paréntesis. */
const isValidPhone = (value: string) => /^[\d\s+()-]{8,20}$/.test(value.trim())

export default function OnboardingScreen() {
	const { profile, updateProfile } = useAuth()
	// El GPS lo maneja useVenueZone internamente; acá sólo queda el geocoding de
	// respaldo, para cuando el usuario escribe la localidad sin elegirla del listado.
	const { geocodeZone, geocoding } = useLocation()

	const [step, setStep] = useState(0)

	// Paso 1 — perfil
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [fullName, setFullName] = useState('')
	const [phone, setPhone] = useState('')

	// Paso 2 — un nivel por deporte. Ningún nivel viene preseleccionado: el default
	// 'intermedio' de la DB era justamente el problema original.
	const [draftLevels, setDraftLevels] = useState<SportLevelDraft>({})

	const chosenSports = draftSports(draftLevels)

	// Paso 3 — zona. Mismo buscador de localidades que usa el alta de partidos:
	// consulta la API georef (localidades + municipios) con debounce.
	const venueZone = useVenueZone()

	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	// Precargamos lo que Google ya nos dio (nombre y foto).
	useEffect(() => {
		if (!profile) return
		setFullName((prev) => prev || profile.full_name || '')
		setAvatarUrl((prev) => prev ?? profile.avatar_url)
		setPhone((prev) => prev || profile.phone || '')
	}, [profile])

	const handlePickAvatar = async () => {
		if (!profile?.id) return
		try {
			setUploadingAvatar(true)
			const url = await storageService.pickAndUploadAvatar(profile.id)
			if (url) setAvatarUrl(url)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'No se pudo subir la imagen.'
			Alert.alert('Error al subir la foto', message)
		} finally {
			setUploadingAvatar(false)
		}
	}

	const toggleSport = (sport: SportType) => {
		setError(null)
		setDraftLevels((prev) => toggleDraftSport(prev, sport))
	}

	const setSportLevel = (sport: SportType, level: SkillLevel) => {
		setError(null)
		setDraftLevels((prev) => ({ ...prev, [sport]: level }))
	}

	const handleDetectZone = async () => {
		setError(null)
		await venueZone.onDetectGPS()
	}

	const validateStep = (): string | null => {
		if (step === 0) {
			if (!fullName.trim()) return 'Necesitamos tu nombre para mostrarlo en los partidos.'
			if (fullName.trim().length > 50) return 'El nombre no puede superar los 50 caracteres.'
			if (phone.trim() && !isValidPhone(phone)) return 'Ese teléfono no parece válido. Dejalo vacío si preferís no cargarlo.'
			return null
		}
		if (step === 1) {
			if (chosenSports.length === 0) return 'Elegí al menos un deporte.'
			const sinNivel = sportsMissingLevel(draftLevels)
			if (sinNivel.length > 0) {
				const nombres = sinNivel.map((s) => sports.find((o) => o.key === s)?.label ?? s).join(', ')
				return `Falta elegir tu nivel en: ${nombres}.`
			}
			return null
		}
		if (step === 2) {
			if (!venueZone.inputText.trim()) return 'Necesitamos tu zona para mostrarte partidos cerca tuyo.'
			if (venueZone.inputText.trim().length < 3) return 'Escribí el nombre completo de tu ciudad o barrio.'
			return null
		}
		return null
	}

	const handleFinish = async () => {
		if (!profile?.id) return

		const zone = venueZone.inputText.trim()

		// venueZone.coords sólo se setea al elegir del listado o usar GPS. Si el
		// usuario escribió el nombre sin seleccionar, intentamos geocodificarlo.
		// Si eso también falla guardamos igual: el filtro por nombre de zona sigue
		// funcionando, sólo se pierde la búsqueda por distancia.
		const coords = venueZone.coords ?? (await geocodeZone(zone))

		try {
			setSaving(true)
			// validateStep() ya garantizó que ningún deporte elegido quedó sin nivel,
			// así que el estrechado a SportLevels no descarta nada.
			const sportLevels = draftToSportLevels(draftLevels)

			const { error: updateError } = await updateProfile({
				full_name: fullName.trim(),
				phone: phone.trim() || null,
				avatar_url: avatarUrl,
				sport_levels: sportLevels,
				zone,
				zone_coordinates: coords,
				onboarding_completed: true,
			})

			if (updateError) throw updateError

			router.replace('/(protected)/(tabs)/Dashboard')
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'No pudimos guardar tu perfil.'
			setError(`${message} Revisá tu conexión e intentá de nuevo.`)
		} finally {
			setSaving(false)
		}
	}

	const handleNext = () => {
		const validationError = validateStep()
		if (validationError) {
			setError(validationError)
			return
		}
		setError(null)

		if (step < STEPS.length - 1) {
			setStep(step + 1)
		} else {
			handleFinish()
		}
	}

	const handleBack = () => {
		setError(null)
		setStep((prev) => Math.max(0, prev - 1))
	}

	const isLastStep = step === STEPS.length - 1
	const busy = saving || geocoding

	return (
		<SafeAreaView style={styles.container} edges={['top', 'bottom']}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				{/* Progreso */}
				<View style={styles.progressWrapper}>
					<View style={styles.progressTrack}>
						{STEPS.map((label, index) => (
							<View key={label} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />
						))}
					</View>
					<Text style={styles.progressLabel}>
						Paso {step + 1} de {STEPS.length} · {STEPS[step]}
					</Text>
				</View>

				<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
					{/* ---------- Paso 1: perfil ---------- */}
					{step === 0 && (
						<>
							<Text style={styles.stepTitle}>Completá tu perfil</Text>
							<Text style={styles.stepSubtitle}>Así te reconocen los demás jugadores cuando te sumás a un partido.</Text>

							<View style={styles.avatarSection}>
								<TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} activeOpacity={0.7}>
									<View style={styles.avatarWrapper}>
										{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : <Ionicons name='person' size={56} color={colors.textSecondaryDark} />}
										{uploadingAvatar && (
											<View style={styles.avatarOverlay}>
												<ActivityIndicator color={colors.primary} />
											</View>
										)}
									</View>
									<View style={styles.avatarBadge}>
										<Ionicons name='camera' size={18} color={colors.backgroundDark} />
									</View>
								</TouchableOpacity>
								<Text style={styles.avatarHint}>{avatarUrl ? 'Tocá para cambiar la foto' : 'Tocá para agregar una foto'}</Text>
							</View>

							<Text style={styles.fieldLabel}>Nombre y apellido</Text>
							<TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder='Ej. Juan Pérez' placeholderTextColor={colors.textSecondaryDark} maxLength={50} />

							<Text style={styles.fieldLabel}>
								Teléfono <Text style={styles.fieldOptional}>(opcional)</Text>
							</Text>
							<TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder='Ej. 11 2345 6789' placeholderTextColor={colors.textSecondaryDark} keyboardType='phone-pad' maxLength={20} />
						</>
					)}

					{/* ---------- Paso 2: deportes y nivel ---------- */}
					{step === 1 && (
						<>
							<Text style={styles.stepTitle}>¿A qué jugás?</Text>
							<Text style={styles.stepSubtitle}>Elegí uno o varios. Usamos esto para recomendarte partidos.</Text>

							<View style={styles.chipsContainer}>
								{sports.map((sport) => {
									const isSelected = sport.key in draftLevels
									return (
										<TouchableOpacity key={sport.key} onPress={() => toggleSport(sport.key)} style={[styles.chip, isSelected && styles.chipActive]} activeOpacity={0.7}>
											<Ionicons name={sport.icon} size={18} color={isSelected ? colors.backgroundDark : colors.sports[sport.key]} />
											<Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{sport.label}</Text>
										</TouchableOpacity>
									)
								})}
							</View>

							{/* Un nivel por deporte: con un solo nivel global no se sabría a cuál
							    de los deportes elegidos hace referencia. */}
							{chosenSports.length > 0 && (
								<>
									<Text style={styles.stepTitle}>¿Cuál es tu nivel en cada uno?</Text>
									<Text style={styles.stepSubtitle}>Sirve para armar partidos parejos. Podés cambiarlo cuando quieras.</Text>

									<SportLevelEditor draft={draftLevels} onChangeLevel={setSportLevel} />
								</>
							)}
						</>
					)}

					{/* ---------- Paso 3: zona ---------- */}
					{step === 2 && (
						<>
							<Text style={styles.stepTitle}>¿Dónde jugás?</Text>
							<Text style={styles.stepSubtitle}>Buscá tu localidad y elegila del listado, o tocá el ícono de GPS para detectarla.</Text>

							<Text style={styles.fieldLabel}>Ciudad o localidad</Text>

							{/* Mismo buscador que el alta de partidos: el botón de GPS ya viene
							    integrado en el input, por eso no hay uno separado. */}
							<VenueZoneInput
								value={venueZone.inputText}
								coords={venueZone.coords}
								suggestions={venueZone.suggestions}
								searching={venueZone.searching}
								isDirty={venueZone.isDirty}
								onChangeText={(text) => {
									setError(null)
									venueZone.onChangeText(text)
								}}
								onSelect={venueZone.onSelect}
								onDetectGPS={handleDetectZone}
								onDismiss={venueZone.onDismiss}
								confirmedHint='Ubicación confirmada — vas a ver los partidos en un radio de 20 km'
							/>
						</>
					)}

					{error && <Text style={styles.errorText}>{error}</Text>}
				</ScrollView>

				{/* Footer */}
				<View style={styles.footer}>
					{step > 0 && (
						<TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={busy} activeOpacity={0.7}>
							<Text style={styles.backButtonText}>Atrás</Text>
						</TouchableOpacity>
					)}

					<TouchableOpacity style={[styles.nextButton, busy && styles.nextButtonDisabled]} onPress={handleNext} disabled={busy} activeOpacity={0.7}>
						{busy ? (
							<ActivityIndicator color={colors.backgroundDark} />
						) : (
							<>
								<Text style={styles.nextButtonText}>{isLastStep ? 'Finalizar' : 'Continuar'}</Text>
								<Ionicons name={isLastStep ? 'checkmark' : 'arrow-forward'} size={20} color={colors.backgroundDark} />
							</>
						)}
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	)
}
