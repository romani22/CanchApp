import { styles } from '@/assets/styles/Dashboard.styles'
import NotificationButton from '@/components/ui/NotificationButton'
import { useAuth } from '@/context/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

export default function Header() {
	const { profile } = useAuth()

	return (
		<View style={styles.header}>
			<View style={styles.headerLeft}>
				<View style={styles.avatar}>
					<Ionicons name='person-outline' size={24} color='#34d399' />
				</View>
				<View style={styles.headerText}>
					<Text style={styles.welcomeText}>Bienvenido de nuevo</Text>
					<Text style={styles.userName}>Hola, {profile?.full_name || profile?.email}</Text>
				</View>
			</View>
			<NotificationButton />
		</View>
	)
}
