import { styles } from '@/assets/styles/Profile.styles'
import { Chip } from '@/components/ui/Chip'
import ConfirmChangesModal from '@/components/ui/ConfirmChangesModal'
import { useAuth } from '@/context/AuthContext'
import { profilesService, UserStats } from '@/services/profiles.service'
import { colors } from '@/theme/colors'
import { SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import HeadViewProfile from '../profile/HeadViewProfile'
import HeaderProfile from '../profile/HeaderProfile'
import SportModal from '../profile/SportModal'
import StatsProfile from '../profile/StatsProfile'

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

	const [sportsModalVisible, setSportsModalVisible] = useState(false)

	const [confirmVisible, setConfirmVisible] = useState(false)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		if (profile) {
			setEditableName(profile.full_name || '')
			setEditableSports(profile.favorite_sports || [])
			setEditableZone(profile.zone || null)
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

	const handleToggleEdit = async () => {
		if (isEditing) {
			if (!profile?.id) return
			setConfirmVisible(true)
		}
		setIsEditing(!isEditing)
	}

	const handleConfirmSave = async () => {
		if (!profile?.id) return

		try {
			setSaving(true)
			const updated = await profilesService.updateProfile(profile.id, {
				full_name: editableName,
				favorite_sports: editableSports,
				zone: editableZone,
			})

			await updateProfile(updated)
			setIsEditing(false)
		} catch (error) {
			Alert.alert('Error', 'No se pudieron guardar los cambios')
			console.log(error)
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
		Alert.alert('Cerrar Sesion', 'Estas seguro?', [
			{ text: 'Cancelar', style: 'cancel' },
			{ text: 'Cerrar Sesion', style: 'destructive', onPress: signOut },
		])
	}

	const handleChangeName = (value: string) => {
		if (value.length > 50) return // Limitar longitud del nombre
		if (!/^[a-zA-Z\sáéíóúüñ]*$/.test(value)) return // Permitir solo letras y espacios y tildes

		if (value.trim() === '') return // No permitir solo espacios
		setEditableName(value)
	}
	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<HeadViewProfile isEditing={isEditing} onToggleEdit={handleToggleEdit} />
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<HeaderProfile isEditing={isEditing} name={editableName} onChangeName={handleChangeName} />

				{loadingStats ? <Text>Cargando estadísticas...</Text> : stats && <StatsProfile totalMatches={stats.total_matches} totalWins={stats.total_wins} eloRating={stats.elo_rating} rating={stats.rating} ratingCount={stats.rating_count} winRate={stats.total_matches > 0 ? (stats.total_wins / stats.total_matches) * 100 : 0} />}

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

				{/* <ZonaProfile zone={editableZone} isEditing={isEditing} onChangeZone={setEditableZone} /> */}

				{/* Logout */}
				<View style={styles.section}>
					<TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
						<Ionicons name='log-out-outline' size={22} color={colors.error} />
						<Text style={styles.logoutButtonText}>Cerrar Sesion</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
			{/* MODAL DEPORTES */}
			<SportModal visible={sportsModalVisible} onClose={() => setSportsModalVisible(false)} onSelectSport={handleSelectSport} editableSports={editableSports} sportOptions={sportOptions} />

			{/* MODAL CONFIRMAR CAMBIOS */}
			<ConfirmChangesModal visible={confirmVisible} title='¿Guardar cambios?' description='Se actualizarán tus deportes favoritos y tu zona.' onConfirm={handleConfirmSave} onDiscard={handleDiscardChanges} onCancel={() => setConfirmVisible(false)} loading={saving} />
		</SafeAreaView>
	)
}
