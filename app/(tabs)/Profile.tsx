import { styles } from '@/assets/styles/Profile.styles'
import { Chip } from '@/components/ui/Chip'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const sportOptions: { key: SportType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
	{ key: 'padel', label: 'Padel', icon: 'tennisball' },
	{ key: 'futbol', label: 'Futbol', icon: 'football' },
	{ key: 'tenis', label: 'Tenis', icon: 'tennisball' },
	{ key: 'basquet', label: 'Basquet', icon: 'basketball' },
]

export default function ProfileScreen() {
	const { profile, signOut, updateProfile } = useAuth()
	const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notifications_enabled ?? true)

	const handleSignOut = () => {
		Alert.alert('Cerrar Sesion', 'Estas seguro que deseas cerrar sesion?', [
			{ text: 'Cancelar', style: 'cancel' },
			{ text: 'Cerrar Sesion', style: 'destructive', onPress: signOut },
		])
	}

	const toggleNotifications = async (value: boolean) => {
		setNotificationsEnabled(value)
		await updateProfile({ notifications_enabled: value })
	}

	const skillLevelLabel = {
		principiante: 'Principiante',
		intermedio: 'Intermedio',
		avanzado: 'Avanzado',
	}

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
					<Ionicons name='chevron-back' size={24} color={colors.textPrimaryDark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Mi Perfil Deportivo</Text>
				<TouchableOpacity style={styles.editButton}>
					<Ionicons name='pencil' size={18} color={colors.primary} />
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Profile Header */}
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
					<Text style={styles.profileName}>{profile?.full_name || 'Usuario'}</Text>
					<Text style={styles.memberSince}>Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Feb 2023'}</Text>
					<View style={styles.levelBadge}>
						<Text style={styles.levelBadgeText}>Nivel {skillLevelLabel[profile?.skill_level || 'intermedio']}</Text>
					</View>
				</View>

				{/* Stats */}
				<View style={styles.statsGrid}>
					<View style={styles.statCard}>
						<Text style={styles.statValue}>{profile?.total_matches || 0}</Text>
						<Text style={styles.statLabel}>Partidos</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statValue}>{profile?.total_wins || 0}</Text>
						<Text style={styles.statLabel}>Victorias</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statValue}>{profile?.rating || '5.0'}</Text>
						<Text style={styles.statLabel}>Rating</Text>
					</View>
				</View>

				{/* Favorite Sports */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Text style={styles.sectionTitle}>Deportes Favoritos</Text>
						<TouchableOpacity>
							<Ionicons name='add-circle' size={24} color={colors.primary} />
						</TouchableOpacity>
					</View>
					<View style={styles.sportsRow}>
						{(profile?.favorite_sports || ['padel', 'futbol']).map((sport, index) => {
							const sportOption = sportOptions.find((s) => s.key === sport)
							return <Chip key={sport} label={sportOption?.label || sport} icon={sportOption?.icon || 'football'} selected={index === 0} size='md' />
						})}
					</View>
				</View>

				{/* Zone Configuration */}
				<View style={styles.section}>
					<View style={styles.zoneCard}>
						<View style={styles.zoneHeader}>
							<View style={styles.zoneIconContainer}>
								<Ionicons name='location' size={28} color={colors.primary} />
							</View>
							<View style={styles.zoneInfo}>
								<Text style={styles.zoneTitle}>Zona de juego preferida</Text>
								<Text style={styles.zoneHint}>Recibe notificaciones de tu zona</Text>
							</View>
						</View>

						<View style={styles.mapPlaceholder}>
							<View style={styles.zoneBadge}>
								<Text style={styles.zoneBadgeText}>{profile?.zone || 'Palermo, CABA'}</Text>
								<Ionicons name='chevron-down' size={14} color={colors.primary} />
							</View>
						</View>

						<View style={styles.notificationRow}>
							<View style={styles.notificationInfo}>
								<Text style={styles.notificationLabel}>Notificaciones Personalizadas</Text>
								<Text style={styles.notificationHint}>Alertas de turnos disponibles</Text>
							</View>
							<Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ false: colors.borderDark, true: colors.primary }} thumbColor={colors.textPrimaryDark} />
						</View>
					</View>
				</View>

				{/* Actions */}
				<View style={styles.section}>
					<TouchableOpacity style={styles.actionButton}>
						<Ionicons name='settings-outline' size={22} color={colors.textSecondaryDark} />
						<Text style={styles.actionButtonText}>Configuracion Avanzada</Text>
					</TouchableOpacity>

					<TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
						<Ionicons name='log-out-outline' size={22} color={colors.error} />
						<Text style={styles.logoutButtonText}>Cerrar Sesion</Text>
					</TouchableOpacity>

					<Text style={styles.versionText}>Version 2.4.12 - Pro Player</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}
