import { styles } from '@/assets/styles/Profile.styles'
import { Chip } from '@/components/ui/Chip'
import ConfirmChangesModal from '@/components/ui/ConfirmChangesModal'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'
import { profilesService, UserStats } from '@/services/profiles.service'
import { colors } from '@/theme/colors'
import { SportType } from '@/types/database.types'
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

const sportOptions: {
	key: SportType
	label: string
	icon: keyof typeof Ionicons.glyphMap
}[] = [
	{ key: 'padel', label: 'Padel', icon: 'tennisball' },
	{ key: 'futbol', label: 'Futbol', icon: 'football' },
	{ key: 'tenis', label: 'Tenis', icon: 'tennisball' },
	{ key: 'basquet', label: 'Basquet', icon: 'basketball' },
]

export default function ProfileScreen() {
	const { profile, signOut, updateProfile } = useAuth()

	const [stats, setStats] = useState<UserStats | null>(null)
	const [loadingStats, setLoadingStats] = useState(true)
	const [isEditing, setIsEditing] = useState(false)

	const [editableName, setEditableName] = useState('')
	const [editableSports, setEditableSports] = useState<SportType[]>([])
	const [editableZone, setEditableZone] = useState<string | null>(null)
	const [editableZoneCoords, setEditableZoneCoords] = useState<{ x: number; y: number } | null>(null)

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
			setEditableSports(profile.favorite_sports || [])
			setEditableZone(profile.zone || null)
			setEditableZoneCoords(profile.zone_coordinates || null)
		}
	}, [profile])

	useEffect(() => {
		const fetchStats = async () => {
			if (!profile?.id) return
			try {
				const data = await profilesService.getUserStats(profile.id)
				setStats(data)
			} finally {
				setLoadingStats(false)
			}
		}
		fetchStats()
	}, [profile?.id])

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

		try {
			setSaving(true)
			const updated = await profilesService.updateProfile(profile.id, {
				full_name: editableName,
				favorite_sports: editableSports,
				zone: editableZone,
				zone_coordinates: editableZoneCoords,
			})

			await updateProfile(updated)
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
		setEditableSports(profile?.favorite_sports || [])
		setEditableZone(profile?.zone || null)
		setEditableZoneCoords(profile?.zone_coordinates || null)
		setIsEditing(false)
		setConfirmVisible(false)
	}

	const handleSelectSport = (sport: SportType) => {
		if (editableSports.includes(sport)) {
			setEditableSports(editableSports.filter((s) => s !== sport))
		} else {
			setEditableSports([...editableSports, sport])
		}
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

				{loadingStats ? (
					<ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
				) : (
					stats && (
						<StatsProfile
							totalMatches={stats.total_matches}
							totalWins={stats.total_wins}
							rating={stats.rating}
						/>
					)
				)}

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

					<View style={styles.sportsRow}>
						{editableSports.map((sport) => {
							const option = sportOptions.find((s) => s.key === sport)
							return <Chip key={sport} label={option?.label || sport} icon={option?.icon || 'football'} selected size='md' />
						})}
					</View>
				</View>

				{/* Zona de juego */}
				<ZonaProfile
					zone={editableZone}
					zoneCoordinates={editableZoneCoords}
					isEditing={isEditing}
					onChangeZone={(zone, coords) => {
						setEditableZone(zone)
						setEditableZoneCoords(coords)
					}}
				/>

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
			<SportModal
				visible={sportsModalVisible}
				onClose={() => setSportsModalVisible(false)}
				onSelectSport={handleSelectSport}
				editableSports={editableSports}
				sportOptions={sportOptions}
			/>

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
