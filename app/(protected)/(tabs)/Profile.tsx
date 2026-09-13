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
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import HeadViewProfile from '../profile/HeadViewProfile'
import HeaderProfile from '../profile/HeaderProfile'
import SportModal from '../profile/SportModal'
import StatsProfile from '../profile/StatsProfile'
import ZonaProfile from '../profile/ZonaProfile'

export default function ProfileScreen() {
	const { user, profile, signOut, deleteAccount, refreshProfile } = useAuth()

	/**
	 * ¿Esta cuenta tiene contraseña?
	 *
	 * Quien entró sólo con Google no tiene ninguna, así que pedirle la "actual" le
	 * impediría ponerse una por primera vez. El default es `true` —pedirla— porque es
	 * el lado seguro: si por algún motivo no se puede saber, mejor pedir de más que
	 * dejar cambiar la contraseña sin prueba de identidad.
	 */
	const hasPasswordIdentity = user?.identities?.some((identity) => identity.provider === 'email') ?? true

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
	const [currentPassword, setCurrentPassword] = useState('')

	// Eliminar cuenta (028). Google Play exige que esto exista dentro de la app.
	const [deleteModalVisible, setDeleteModalVisible] = useState(false)
	const [deleteProof, setDeleteProof] = useState('')
	const [deleting, setDeleting] = useState(false)
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

	/**
	 * Cambiar la contraseña, pidiendo la actual.
	 *
	 * Antes sólo pedía la nueva dos veces. Con eso, cualquiera que agarrara el teléfono
	 * con la sesión abierta —o el bloqueo por inactividad todavía sin saltar— cambiaba
	 * la contraseña y dejaba al dueño afuera de su propia cuenta, sin haber tenido que
	 * probar en ningún momento que era él.
	 *
	 * La verificación se hace con un signIn contra la contraseña actual. No es sólo un
	 * chequeo nuestro: deja la sesión marcada como "recién autenticada", que es lo que
	 * pide `secure_password_change` del lado del servidor. Sin esto, activar esa opción
	 * haría fallar el cambio de contraseña con un error de reautenticación.
	 */
	const handleChangePassword = async () => {
		if (hasPasswordIdentity && !currentPassword) {
			Alert.alert('Falta un dato', 'Ingresá tu contraseña actual.')
			return
		}

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

			if (hasPasswordIdentity) {
				const email = user?.email
				if (!email) {
					Alert.alert('Error', 'No pudimos verificar tu identidad. Cerrá sesión y volvé a entrar.')
					return
				}

				const { error: reauthError } = await authService.signIn(email, currentPassword)
				if (reauthError) {
					Alert.alert('Contraseña incorrecta', 'La contraseña actual no coincide.')
					return
				}
			}

			const { error } = await authService.updatePassword(newPassword)
			if (error) throw error

			Alert.alert('Éxito', 'Contraseña actualizada correctamente')
			setPasswordModalVisible(false)
			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
		} catch (error) {
			Alert.alert('Error', 'No se pudo cambiar la contraseña')
			console.error('[Profile] Error cambiando contraseña:', error)
		} finally {
			setChangingPassword(false)
		}
	}

	/**
	 * Eliminar la cuenta. No tiene vuelta atrás.
	 *
	 * Pide una prueba de identidad antes, por el mismo motivo que el cambio de
	 * contraseña: el teléfono desbloqueado en la mano de otro no puede alcanzar para
	 * borrarle la cuenta a alguien. Para las cuentas con contraseña, esa prueba es la
	 * contraseña; para las de Google, que no tienen ninguna, es escribir ELIMINAR —
	 * más débil, pero al menos descarta el toque accidental.
	 */
	const handleDeleteAccount = async () => {
		if (hasPasswordIdentity) {
			if (!deleteProof) {
				Alert.alert('Falta un dato', 'Ingresá tu contraseña para confirmar.')
				return
			}
		} else if (deleteProof.trim().toUpperCase() !== 'ELIMINAR') {
			Alert.alert('Falta confirmar', 'Escribí ELIMINAR para confirmar.')
			return
		}

		try {
			setDeleting(true)

			if (hasPasswordIdentity) {
				const email = user?.email
				if (!email) {
					Alert.alert('Error', 'No pudimos verificar tu identidad. Cerrá sesión y volvé a entrar.')
					return
				}

				const { error: reauthError } = await authService.signIn(email, deleteProof)
				if (reauthError) {
					Alert.alert('Contraseña incorrecta', 'La contraseña no coincide.')
					return
				}
			}

			await deleteAccount()

			// No hay navegación explícita: al quedarse sin sesión, el layout de
			// (protected) redirige solo al login. Forzarla acá sería competir con él.
			setDeleteModalVisible(false)
			setDeleteProof('')
		} catch (error) {
			// Si falló, la cuenta SIGUE VIVA. Hay que decirlo: dejar a alguien creyendo
			// que borró sus datos cuando no se borraron es peor que el error.
			console.error('[Profile] Error eliminando la cuenta:', error)
			Alert.alert('No se pudo eliminar', 'Tu cuenta sigue activa. Revisá tu conexión e intentá de nuevo.')
		} finally {
			setDeleting(false)
		}
	}

	const closeDeleteModal = () => {
		setDeleteModalVisible(false)
		setDeleteProof('')
	}

	const closePasswordModal = () => {
		setPasswordModalVisible(false)
		// Que no queden contraseñas en el estado de la pantalla después de cerrar.
		setCurrentPassword('')
		setNewPassword('')
		setConfirmPassword('')
	}

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<HeadViewProfile isEditing={isEditing} onToggleEdit={handleToggleEdit} />
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<HeaderProfile isEditing={isEditing} name={editableName} onChangeName={handleChangeName} />

				{profile && <StatsProfile userId={profile.id} totalMatches={profile.total_matches} totalWins={profile.total_wins} rating={profile.rating} />}

				{/* Deportes */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Text style={styles.sectionTitle}>Deportes de interés</Text>
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

				{/* Eliminar cuenta. Separado del logout y en texto chico: Google pide que
				    sea fácil de encontrar, no que compita con las acciones de todos los
				    días. Lo que lo hace difícil de tocar por accidente es el modal. */}
				<TouchableOpacity style={localStyles.deleteLink} onPress={() => setDeleteModalVisible(true)}>
					<Text style={localStyles.deleteLinkText}>Eliminar mi cuenta</Text>
				</TouchableOpacity>
			</ScrollView>

			{/* Modal deportes */}
			<SportModal visible={sportsModalVisible} onClose={() => setSportsModalVisible(false)} onSelectSport={handleSelectSport} editableSports={draftSports(editableLevels)} />

			{/* Modal eliminar cuenta */}
			{deleteModalVisible && (
				<Modal visible={deleteModalVisible} animationType='fade' transparent>
					<View style={styles.modalOverlay}>
						<View style={styles.passwordModal}>
							<Text style={styles.modalTitle}>Eliminar mi cuenta</Text>

							{/* Decir qué pasa y qué no. La mitad de abajo importa tanto como la de
							    arriba: alguien que organiza todas las semanas tiene derecho a saber
							    que irse no le borra el historial al grupo. */}
							<Text style={localStyles.deleteWarning}>Esto no se puede deshacer.</Text>

							<View style={localStyles.deleteDetail}>
								<Text style={localStyles.deleteBullet}>•  Se borra tu cuenta y no vas a poder volver a entrar.</Text>
								<Text style={localStyles.deleteBullet}>•  Se eliminan tu mail, tu teléfono, tu foto y tu zona.</Text>
								<Text style={localStyles.deleteBullet}>•  Los partidos que organizaste siguen en el historial de quienes jugaron, pero sin tu nombre.</Text>
								<Text style={localStyles.deleteBullet}>•  Los partidos futuros que organizabas se cancelan y se les avisa a los jugadores.</Text>
							</View>

							{hasPasswordIdentity ? (
								<TextInput placeholder='Tu contraseña' placeholderTextColor='#999' style={styles.modalInput} secureTextEntry autoComplete='current-password' value={deleteProof} onChangeText={setDeleteProof} />
							) : (
								/* Las cuentas de Google no tienen contraseña que pedir. */
								<TextInput placeholder='Escribí ELIMINAR' placeholderTextColor='#999' style={styles.modalInput} autoCapitalize='characters' autoCorrect={false} value={deleteProof} onChangeText={setDeleteProof} />
							)}

							<TouchableOpacity style={[localStyles.deleteConfirmButton, deleting && { opacity: 0.6 }]} onPress={handleDeleteAccount} disabled={deleting}>
								{deleting ? <ActivityIndicator color='white' /> : <Text style={localStyles.deleteConfirmText}>Eliminar mi cuenta</Text>}
							</TouchableOpacity>

							<TouchableOpacity style={styles.modalCancel} onPress={closeDeleteModal} disabled={deleting}>
								<Text style={styles.modalCancelText}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>
			)}

			{/* Modal cambiar contraseña */}
			{passwordModalVisible && (
				<Modal visible={passwordModalVisible} animationType='fade' transparent>
					<View style={styles.modalOverlay}>
						<View style={styles.passwordModal}>
							<Text style={styles.modalTitle}>Cambiar contraseña</Text>

							{/* Sólo para cuentas con contraseña: quien entró con Google no tiene una
							    actual que pedirle, y se estaría poniendo la primera. */}
							{hasPasswordIdentity && <TextInput placeholder='Contraseña actual' placeholderTextColor='#999' style={styles.modalInput} secureTextEntry autoComplete='current-password' value={currentPassword} onChangeText={setCurrentPassword} />}

							<TextInput placeholder='Nueva contraseña' placeholderTextColor='#999' style={styles.modalInput} secureTextEntry autoComplete='new-password' value={newPassword} onChangeText={setNewPassword} />

							<TextInput placeholder='Confirmar contraseña' placeholderTextColor='#999' style={styles.modalInput} secureTextEntry autoComplete='new-password' value={confirmPassword} onChangeText={setConfirmPassword} />

							<TouchableOpacity style={[styles.modalButton, changingPassword && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={changingPassword}>
								{changingPassword ? <ActivityIndicator color='white' /> : <Text style={styles.modalButtonText}>Guardar</Text>}
							</TouchableOpacity>

							<TouchableOpacity style={styles.modalCancel} onPress={closePasswordModal}>
								<Text style={styles.modalCancelText}>Cancelar</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>
			)}

			{/* Modal confirmar cambios */}
			<ConfirmChangesModal visible={confirmVisible} title='¿Guardar cambios?' description='Se actualizarán tu nombre, deportes favoritos y tu zona.' onConfirm={handleConfirmSave} onDiscard={handleDiscardChanges} onCancel={() => setConfirmVisible(false)} loading={saving} />
		</SafeAreaView>
	)
}

// Eliminar cuenta (028). Van acá y no en Profile.styles porque son de esta pantalla
// y de ninguna otra.
const localStyles = StyleSheet.create({
	// Enlace discreto, no botón: tiene que ser fácil de encontrar —Google lo exige—
	// sin quedar al lado de "Cerrar Sesión" invitando a errarle.
	deleteLink: {
		alignItems: 'center',
		paddingVertical: 18,
	},
	deleteLinkText: {
		color: colors.textSecondaryDark,
		fontSize: 13,
		textDecorationLine: 'underline',
	},
	deleteWarning: {
		color: colors.error,
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
		marginBottom: 10,
	},
	deleteDetail: {
		marginBottom: 16,
		gap: 6,
	},
	deleteBullet: {
		color: colors.textSecondaryDark,
		fontSize: 13,
		lineHeight: 18,
	},
	deleteConfirmButton: {
		backgroundColor: colors.error,
		borderRadius: 10,
		paddingVertical: 13,
		alignItems: 'center',
		marginTop: 4,
	},
	deleteConfirmText: {
		color: 'white',
		fontSize: 15,
		fontWeight: '600',
	},
})
