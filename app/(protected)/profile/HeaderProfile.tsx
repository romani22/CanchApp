import { styles } from '@/assets/styles/Profile.styles'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { Image, Text, TextInput, View } from 'react-native'

type Props = {
	isEditing: boolean
	name: string
	onChangeName: (value: string) => void
}

function HeaderProfile({ isEditing, name, onChangeName }: Props) {
	const { profile } = useAuth()

	const skillLevelLabel = {
		principiante: 'Principiante',
		intermedio: 'Intermedio',
		avanzado: 'Avanzado',
	}

	return (
		<View style={styles.profileHeader}>
			<View style={styles.avatarContainer}>
				<View style={styles.avatarWrapper}>
					{profile?.avatar_url ? (
						<Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
					) : (
						<View style={styles.avatarPlaceholder}>
							<Ionicons name='person' size={48} color={colors.textSecondaryDark} />
						</View>
					)}
				</View>

				<View style={styles.verifiedBadge}>
					<Ionicons name='checkmark' size={14} color={colors.backgroundDark} />
				</View>
			</View>

			{/* 🔥 NOMBRE EDITABLE */}
			{isEditing ? (
				<TextInput
					value={name}
					onChangeText={onChangeName}
					style={{
						fontSize: 22,
						fontWeight: 'bold',
						color: colors.textPrimaryDark,
						borderBottomWidth: 1,
						borderBottomColor: colors.primary,
						paddingVertical: 4,
						textAlign: 'center',
						minWidth: 180,
					}}
					placeholder='Tu nombre'
					placeholderTextColor={colors.textSecondaryDark}
				/>
			) : (
				<Text style={styles.profileName}>{name || 'Usuario'}</Text>
			)}

			<Text style={styles.memberSince}>Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Feb 2023'}</Text>

			<View style={styles.levelBadge}>
				<Text style={styles.levelBadgeText}>Nivel {skillLevelLabel[profile?.skill_level || 'intermedio']}</Text>
			</View>
		</View>
	)
}

export default HeaderProfile
