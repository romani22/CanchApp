import { Chip } from '@/components/ui/Chip'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'; // ajustá path si hace falta

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

	const testConnection = async () => {
		const { data, error } = await supabase.from('matches').select('*')

		console.log('DATA:', data)
		console.log('ERROR:', error)
	}

	useEffect(() => {
		testConnection()
	}, [])

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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.surfaceDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	editButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: `${colors.primary}20`,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: 120,
	},
	profileHeader: {
		alignItems: 'center',
		paddingVertical: spacing.xl,
	},
	avatarContainer: {
		position: 'relative',
		marginBottom: spacing.lg,
	},
	avatarWrapper: {
		width: 128,
		height: 128,
		borderRadius: 64,
		borderWidth: 4,
		borderColor: `${colors.primary}30`,
		padding: 4,
	},
	avatar: {
		width: '100%',
		height: '100%',
		borderRadius: 60,
	},
	avatarPlaceholder: {
		width: '100%',
		height: '100%',
		borderRadius: 60,
		backgroundColor: colors.surfaceDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	verifiedBadge: {
		position: 'absolute',
		bottom: 4,
		right: 4,
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 4,
		borderColor: colors.backgroundDark,
	},
	profileName: {
		...typography.h2,
		color: colors.textPrimaryDark,
	},
	memberSince: {
		...typography.bodySmall,
		color: colors.primary,
		opacity: 0.7,
		marginTop: spacing.xs,
	},
	levelBadge: {
		marginTop: spacing.md,
		backgroundColor: `${colors.primary}10`,
		borderWidth: 1,
		borderColor: `${colors.primary}20`,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		borderRadius: borderRadius.full,
	},
	levelBadgeText: {
		...typography.labelSmall,
		color: colors.primary,
		fontWeight: '700',
	},
	statsGrid: {
		flexDirection: 'row',
		gap: spacing.md,
		marginBottom: spacing.xl,
	},
	statCard: {
		flex: 1,
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		alignItems: 'center',
	},
	statValue: {
		...typography.h2,
		color: colors.primary,
	},
	statLabel: {
		...typography.labelSmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.xs,
	},
	section: {
		marginBottom: spacing.xl,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: spacing.md,
	},
	sectionTitle: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	sportsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	zoneCard: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		gap: spacing.lg,
	},
	zoneHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
	},
	zoneIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: `${colors.primary}20`,
		alignItems: 'center',
		justifyContent: 'center',
	},
	zoneInfo: {
		flex: 1,
	},
	zoneTitle: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '600',
	},
	zoneHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	mapPlaceholder: {
		height: 100,
		borderRadius: borderRadius.md,
		backgroundColor: colors.backgroundDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		alignItems: 'center',
		justifyContent: 'center',
	},
	zoneBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: `${colors.backgroundDark}E6`,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		borderColor: `${colors.primary}20`,
	},
	zoneBadgeText: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
	},
	notificationRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: colors.backgroundDark,
		padding: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	notificationInfo: {
		flex: 1,
	},
	notificationLabel: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
	},
	notificationHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	actionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		height: 56,
		borderRadius: borderRadius.full,
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		marginBottom: spacing.md,
	},
	actionButtonText: {
		...typography.button,
		color: colors.textSecondaryDark,
	},
	logoutButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		height: 56,
		borderRadius: borderRadius.full,
		backgroundColor: `${colors.error}10`,
		borderWidth: 1,
		borderColor: `${colors.error}20`,
	},
	logoutButtonText: {
		...typography.button,
		color: colors.error,
	},
	versionText: {
		...typography.labelSmall,
		color: colors.textSecondaryDark,
		textAlign: 'center',
		marginTop: spacing.xl,
		opacity: 0.6,
	},
})
