import { styles } from '@/assets/styles/Profile.styles'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

type Props = {
	isEditing: boolean
	onToggleEdit: () => void
}

function HeadViewProfile({ isEditing, onToggleEdit }: Props) {
	return (
		<View style={styles.header}>
			<TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
				<Ionicons name='chevron-back' size={24} color={colors.textPrimaryDark} />
			</TouchableOpacity>

			<Text style={styles.headerTitle}>Mi Perfil Deportivo</Text>

			<TouchableOpacity onPress={onToggleEdit} style={styles.editButton}>
				{isEditing ? <Ionicons name='save' size={18} color={colors.primary} /> : <Ionicons name='pencil' size={18} color={colors.primary} />}
			</TouchableOpacity>
		</View>
	)
}

export default HeadViewProfile
