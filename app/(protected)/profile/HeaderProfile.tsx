import { styles } from '@/assets/styles/Profile.styles'
import { useAuth } from '@/context/AuthContext'
import { profilesService } from '@/services/profiles.service'
import { storageService } from '@/services/storage.service'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

type Props = {
	isEditing: boolean
	name: string
	onChangeName: (value: string) => void
}

function HeaderProfile({ isEditing, name, onChangeName }: Props) {
	const { profile, refreshProfile } = useAuth()
	const [uploadingAvatar, setUploadingAvatar] = useState(false)

	// URL local optimista — se muestra inmediatamente después del upload
	// sin esperar a que refreshProfile actualice el contexto
	const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)

	const avatarUrl = localAvatarUrl || profile?.avatar_url || null

	const handleAvatarPress = async () => {
		if (!isEditing || !profile?.id) return

		try {
			setUploadingAvatar(true)
			const url = await storageService.pickAndUploadAvatar(profile.id)

			if (!url) return // usuario canceló el picker

			// Actualizar avatar_url en la DB
			await profilesService.updateProfile(profile.id, { avatar_url: url })

			// Mostrar inmediatamente sin esperar al refresh
			setLocalAvatarUrl(url)

			// Actualizar el contexto en background
			refreshProfile()
		} catch (err: any) {
			console.error('[HeaderProfile] Error subiendo avatar:', err)
			Alert.alert('Error al subir foto', err?.message || 'No se pudo subir la imagen. Intentá de nuevo.')
		} finally {
			setUploadingAvatar(false)
		}
	}

	const skillLevelLabel: Record<string, string> = {
		principiante: 'Principiante',
		intermedio: 'Intermedio',
		avanzado: 'Avanzado',
	}

	return (
		<View style={styles.profileHeader}>
			{/* Avatar — tappable solo en modo edición */}
			<TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPress} disabled={!isEditing || uploadingAvatar} activeOpacity={isEditing ? 0.7 : 1}>
				<View style={styles.avatarWrapper}>
					{avatarUrl ? (
						<Image source={{ uri: avatarUrl }} style={styles.avatar} />
					) : (
						<View style={styles.avatarPlaceholder}>
							<Ionicons name='person' size={48} color={colors.textSecondaryDark} />
						</View>
					)}

					{/* Overlay de carga mientras sube */}
					{uploadingAvatar && (
						<View style={localStyles.uploadOverlay}>
							<ActivityIndicator size='large' color={colors.primary} />
						</View>
					)}

					{/* Ícono de cámara cuando está en modo edición */}
					{isEditing && !uploadingAvatar && (
						<View style={localStyles.cameraOverlay}>
							<View style={localStyles.cameraBadge}>
								<Ionicons name='camera' size={16} color={colors.backgroundDark} />
							</View>
						</View>
					)}
				</View>

				<View style={styles.verifiedBadge}>
					<Ionicons name='checkmark' size={14} color={colors.backgroundDark} />
				</View>
			</TouchableOpacity>

			{/* Nombre editable */}
			{isEditing ? <TextInput value={name} onChangeText={onChangeName} style={localStyles.nameInput} placeholder='Tu nombre' placeholderTextColor={colors.textSecondaryDark} /> : <Text style={styles.profileName}>{name || 'Usuario'}</Text>}

			<Text style={styles.memberSince}>
				Miembro desde{' '}
				{profile?.created_at
					? new Date(profile.created_at).toLocaleDateString('es-ES', {
							month: 'short',
							year: 'numeric',
						})
					: 'Feb 2023'}
			</Text>

			<View style={styles.levelBadge}>
				<Text style={styles.levelBadgeText}>Nivel {skillLevelLabel[profile?.skill_level || 'intermedio']}</Text>
			</View>
		</View>
	)
}

const localStyles = StyleSheet.create({
	uploadOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.5)',
		borderRadius: 60,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cameraOverlay: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 60,
		alignItems: 'center',
		justifyContent: 'flex-end',
		paddingBottom: 6,
	},
	cameraBadge: {
		backgroundColor: colors.primary,
		borderRadius: 14,
		width: 28,
		height: 28,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: colors.backgroundDark,
	},
	nameInput: {
		fontSize: 22,
		fontWeight: 'bold',
		color: colors.textPrimaryDark,
		borderBottomWidth: 1,
		borderBottomColor: colors.primary,
		paddingVertical: 4,
		textAlign: 'center',
		minWidth: 180,
	},
})

export default HeaderProfile
