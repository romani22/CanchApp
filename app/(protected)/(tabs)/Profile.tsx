import { styles } from '@/assets/styles/Profile.styles'
import { Chip } from '@/components/ui/Chip'
import ConfirmChangesModal from '@/components/ui/ConfirmChangesModal'
import { SportLevelDraft, SportLevelEditor, draftSports, draftToSportLevels, sportLevelsToDraft, sportsMissingLevel, toggleDraftSport } from '@/components/ui/SportLevelEditor'
import { levelLabels, sports as sportOptions } from '@/constants/matches'
import { useAuth } from '@/context/AuthContext'
import { parseCoords, useVenueZone } from '@/hooks/useVenueZone'
import { authService } from '@/services/auth.service'
import { profilesService } from '@/services/profiles.service'
import { colors } from '@/theme/colors'
import { SkillLevel, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import HeadViewProfile from '../profile/HeadViewProfile'
import HeaderProfile from '../profile/HeaderProfile'
import SportModal from '../profile/SportModal'
import StatsProfile from '../profile/StatsProfile'
import ZonaProfile from '../profile/ZonaProfile'

export default function ProfileScreen() {
	const { profile, signOut, refreshProfile } = useAuth()

	const [isEditing, setIsEditing] = useState(false)

	const [editableName, setEditableName] = useState('')
	const [editableLevels, setEditableLevels] = useState<SportLevelDraft>({})

	// Valores iniciales de la zona en state (no derivados en cada render): useVenueZone
	// los tiene como dependencia de su efecto de sincronización, y un objeto nuevo por
	// render lo dispararía en bucle.
	const [initialZone, setInitialZone] = useState('')
	const [initialZoneCoords, setInitialZoneCoords] = useState<{ x: number; y: number } | null>(null)
	const venueZone = useVenueZone(initialZone, initialZoneCoords)

	const [sportsModalVisible, setSportsModalVisible] = useState(false)
	const [confirmVisible, setConfirmVisible] = useState(false)
	const [saving, setSaving] = useState(false)

	const [passwordModalVisible, setPasswordModalVisible] = useState(false)
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [changingPassword, setChangingPassword] = useState(false)

	useEffect(() => {
		if (profile) {
			setEditableName(profile.full_name || '')
			setEditableLevels(sportLevelsToDraft(profile.sport_levels))
			setInitialZone(profile.zone || '')
			// parseCoords es obligatorio: Supabase entrega POINT como string "(lon,lat)".
			// Guardar el string crudo y reenviarlo en el update lo serializaba a NULL,
			// borrando las coordenadas con sólo editar cualquier otro campo del perfil.
			setInitialZoneCoords(parseCoords(profile.zone_coordinates))
		}
	}, [profile])

	// FIX: no cerrar el form hasta que el usuario confirme o descarte
	const handleToggleEdit = () => {
		if (isEditing) {
			setConfirmVisible(true) // Solo abrir modal, no cambiar isEditing todavía
		} else {
			setIsEditing(true)
		}
	}

	const handleConfirmSave = async () => {
		if (!profile?.id) return

		// Validar nombre antes de guardar
		if (!editableName.trim()) {
			Alert.alert('Error', 'El nombre no puede estar vacío')
			return
		}

		// Un deporte sin nivel se descartaría al guardar, así que lo avisamos
		// en vez de dejar que desaparezca en silencio.
		const sinNivel = sportsMissingLevel(editableLevels)
		if (sinNivel.length > 0) {
			const nombres = sinNivel.map((s) => sportOptions.find((o) => o.key === s)?.label ?? s).join(', ')
			Alert.alert('Falta el nivel', `Elegí tu nivel en: ${nombres}.`)
			setConfirmVisible(false)
			return
		}

		try {
			setSaving(true)
			await profilesService.updateProfile(profile.id, {
				full_name: editableName,
				sport_levels: draftToSportLevels(editableLevels),
				zone: venueZone.inputText.trim() || null,
				zone_coordinates: venueZone.coords,
			})

			// refreshProfile, no updateProfile(updated): esto último reenviaba la fila
			// completa devuelta por el update como si fuera un segundo cambio, lo que
			// además de duplicar la escritura volvía a mandar zone_coordinates y la
			// borraba. Acá alcanza con releer.
			await refreshProfile()
			setIsEditing(false)
		} catch (error) {
			Alert.alert('Error', 'No se pudieron guardar los cambios')
			console.error('[Profile] Error guardando:', error)
		} finally {
			setSaving(false)
			setConfirmVisible(false)
		}
	}

	const handleDiscardChanges = () => {
		// Restaurar valores originales
		setEditableName(profile?.full_name || '')
		setEditableLevels(sportLevelsToDraft(profile?.sport_levels))
		// reset() explícito: el efecto de sincronización de useVenueZone sólo reacciona
		// a cambios en los valores iniciales, y al descartar esos siguen siendo los mismos.
		venueZone.reset(profile?.zone || '', parseCoords(profile?.zone_coordinates))
		setIsEditing(false)
		setConfirmVisible(false)
	}

	const handleSelectSport = (sport: SportType) => {
		setEditableLevels((prev) => toggleDraftSport(prev, sport))
	}

	const handleChangeSportLevel = (sport: SportType, level: SkillLevel) => {
		setEditableLevels((prev) => ({ ...prev, [sport]: level }))
	}

	const handleSignOut = () => {
		Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
			{ text: 'Cancelar', style: 'cancel' },
			{ text: 'Cerrar Sesión', style: 'destructive', onPress: signOut },
		])
	}

	// FIX: permitir borrar el campo, validar solo al guardar
	const handleChangeName = (value: string) => {
		if (value.length > 50) return
		if (!/^[a-zA-Z\sáéíóúüñÁÉÍÓÚÜÑ]*$/.test(value)) return
		setEditableName(value)
	}

	const handleChangePassword = async () => {
		if (newPassword !== confirmPassword) {
			Alert.alert('Error', 'Las contraseñas no coinciden')
			return
		}

		const validation = authService.validatePassword(newPassword)
		if (!validation.isValid) {
			Alert.alert('Contraseña inválida', validation.errors.join('\n'))
			return
		}

		try {
			setChangingPassword(true)
			const { error } = await authService.updatePassword(newPassword)
			if (error) throw error

			Alert.alert('Éxito', 'Contraseña actualizada correctamente')
			setPasswordModalVisible(false)
			setNewPassword('')
			setConfirmPassword('')
		} catch (error) {
			Alert.alert('Error', 'No se pudo cambiar la contraseña')
			console.error('[Profile] Error cambiando contraseña:', error)
		} finally {
			setChangingPassword(false)
		}
	}

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<HeadViewProfile isEditing={isEditing} onToggleEdit={handleToggleEdit} />
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<HeaderProfile isEditing={isEditing} name={editableName} onChangeName={handleChangeName} />

				{/* AuthContext.loadFullProfile ya mergea user_stats dentro de `profile`,
				    así que no hace falta un segundo fetch ni un spinner propio. */}
				{profile && <StatsProfile totalMatches={profile.total_matches} totalWins={profile.total_wins} rating={profile.rating} />}

				{/* Deportes */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Text style={styles.sectionTitle}>Deportes Favoritos</Text>
						{isEditing && (
							<TouchableOpacity onPress={() => setSportsModalVisible(true)}>
								<Ionicons name='add-circle' size={24} color={colors.primary} />
							</TouchableOpacity>
						)}
					</View>

					{isEditing ? (
						<SportLevelEditor draft={editableLevels} onChangeLevel={handleChangeSportLevel} />
					) : (
						<View style={styles.sportsRow}>
							{draftSports(editableLevels).map((sport) => {
								const option = sportOptions.find((s) => s.key === sport)
								const level = editableLevels[sport]
								const label = option?.label ?? sport
								return <Chip key={sport} label={level ? `${label} · ${levelLabels[level]}` : label} icon={option?.icon || 'football'} selected size='md' />
							})}
						</View>
					)}
				</View>

				{/* Zona de juego */}
				<ZonaProfile venueZone={venueZone} isEditing={isEditing} />

				<View style={styles.section}>
					<TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(protected)/notificationsSettings/notifications')}>
						<Ionicons name='notifications-outline' size={22} color={colors.primary} />
						<Text style={styles.actionButtonText}>Configurar notificaciones</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.actionButton} onPress={() => setPasswordModalVisible(true)}>
						<Ionicons name='key-outline' size={22} color={colors.primary} />
						<Text style={styles.actionButtonText}>Cambiar contraseña</Text>
					</TouchableOpacity>
				</View>

				{/* Logout */}
				<View style={styles.section}>
					<TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
						<Ionicons name='log-out-outline' size={22} color={colors.error} />
						<Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>

			{/* Modal deportes */}
			<SportModal visible={sportsModalVisible} onClose={() => setSportsModalVisible(false)} onSelectSport={handleSelectSport} editableSports={draftSports(editableLevels)} />

			{/* Modal cambiar contraseña */}
			{passwordModalVisible && (
				<Modal visible={passwordModalVisible} animationType='fade' transparent>
					<View style={styles.modalOverlay}>
						<View style={styles.passwordModal}>
							<Text style={styles.modalTitle}>Cambiar contraseña</Text>

							<TextInput
								placeholder='Nueva contraseña'
								placeholderTextColor='#999'
								style={styles.modalInput}
								secureTextEntry
								value={newPassword}
								onChangeText={setNewPassword}
							/>

							<TextInput
								placeholder='Confirmar contraseña'
								placeholderTextColor='#999'
								style={styles.modalInput}
								secureTextEntry
								value={confirmPassword}
								onChangeText={setConfirmPassword}
							/>

							<TouchableOpacity
								style={[styles.modalButton, changingPassword && { opacity: 0.6 }]}
								onPress={handleChangePassword}
								disabled={changingPassword}
							>
								{changingPassword ? (
									<ActivityIndicator color='white' />
								) : (
									<Text style={styles.modalButtonText}>Guardar</Text>
								)}
							</TouchableOpacity>

							<TouchableOpacity style={styles.modalCancel} onPress={() => setPasswordModalVisible(false)}>
								<Text style={styles.modalCancelText}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>
			)}

			{/* Modal confirmar cambios */}
			<ConfirmChangesModal
				visible={confirmVisible}
				title='¿Guardar cambios?'
				description='Se actualizarán tu nombre, deportes favoritos y tu zona.'
				onConfirm={handleConfirmSave}
				onDiscard={handleDiscardChanges}
				onCancel={() => setConfirmVisible(false)}
				loading={saving}
			/>
		</SafeAreaView>
	)
}
