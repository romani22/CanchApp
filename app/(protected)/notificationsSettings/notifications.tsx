import { notificationSettingsStyles as styles } from '@/assets/styles/NotificationSettings.styles'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import { pushNotificationService } from '@/services/pushnotifications.service'
import { colors } from '@/theme/colors'
import { NotificationSettings } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const RADIUS_OPTIONS = [
	{ value: 5000, label: '5 km' },
	{ value: 10000, label: '10 km' },
	{ value: 20000, label: '20 km' },
	{ value: 30000, label: '30 km' },
	{ value: 50000, label: '50 km' },
]

// ─── Notification type definitions (easily extensible) ──────────────────────
type NotificationToggleKey = Exclude<keyof NotificationSettings, 'notifications_enabled' | 'notification_radius'>

interface NotificationTypeConfig {
	key: NotificationToggleKey
	icon: keyof typeof Ionicons.glyphMap
	title: string
	description: string
}

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
	{
		key: 'notify_new_matches',
		icon: 'football-outline',
		title: 'Partidos cercanos',
		description: 'Cuando se crea un partido cerca de tu zona',
	},
	{
		key: 'notify_join_requests',
		icon: 'person-add-outline',
		title: 'Solicitudes de unión',
		description: 'Cuando alguien quiere sumarse a tu partido',
	},
	{
		key: 'notify_request_response',
		icon: 'checkmark-circle-outline',
		title: 'Respuestas a solicitudes',
		description: 'Cuando aceptan o rechazan tu solicitud',
	},
	{
		key: 'notify_player_joined',
		icon: 'people-outline',
		title: 'Jugadores agregados',
		description: 'Cuando te agregan directamente a un partido',
	},
	{
		key: 'notify_match_reminder',
		icon: 'alarm-outline',
		title: 'Recordatorios',
		description: '10 minutos antes de que empiece tu partido',
	},
]

// ─── Main screen ────────────────────────────────────────────────────────────
export default function NotificationSettingsScreen() {
	const { settings, loading, saving, saveError, updateSetting, flush } = useNotificationSettings()
	const [hasPermissions, setHasPermissions] = useState(true)

	useEffect(() => {
		pushNotificationService.checkPermissions().then(setHasPermissions)
	}, [])

	const handleRequestPermissions = async () => {
		const token = await pushNotificationService.registerForPushNotifications()
		if (token) {
			setHasPermissions(true)
		} else {
			Alert.alert('Permisos denegados', 'Habilitá las notificaciones desde la configuración de tu dispositivo.', [
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Ir a Ajustes',
					onPress: () => {
						if (Platform.OS === 'ios') {
							Linking.openURL('app-settings:')
						} else {
							Linking.openSettings()
						}
					},
				},
			])
		}
	}

	const handleBack = () => {
		flush()
		router.back()
	}

	if (loading) {
		return (
			<SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]} edges={['top']}>
				<ActivityIndicator size='large' color={colors.primary} />
			</SafeAreaView>
		)
	}

	if (!settings) return null

	const globalEnabled = settings.notifications_enabled

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity style={styles.headerButton} onPress={handleBack}>
					<Ionicons name='chevron-back' size={24} color={colors.textPrimaryDark} />
				</TouchableOpacity>

				<Text style={styles.headerTitle}>Notificaciones</Text>

				{/* Saving indicator */}
				<View style={styles.savingSlot}>
					{saving && <ActivityIndicator size='small' color={colors.primary} />}
				</View>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
				{/* Permission banner — only shown when permissions are denied */}
				{!hasPermissions && (
					<View style={styles.permissionBanner}>
						<Ionicons name='alert-circle-outline' size={22} color={colors.warning} />
						<View style={styles.permissionText}>
							<Text style={styles.permissionTitle}>Permisos desactivados</Text>
							<Text style={styles.permissionDescription}>Activá los permisos para recibir notificaciones push en este dispositivo.</Text>
						</View>
						<TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermissions}>
							<Text style={styles.permissionButtonText}>Activar</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Error banner */}
				{saveError && (
					<View style={styles.errorBanner}>
						<Ionicons name='warning-outline' size={18} color={colors.error} />
						<Text style={styles.errorText}>{saveError}</Text>
					</View>
				)}

				{/* ── General ── */}
				<Text style={styles.sectionLabel}>General</Text>
				<View style={styles.card}>
					<SettingRow
						icon='notifications-outline'
						iconColor={globalEnabled ? colors.primary : colors.textSecondaryDark}
						title='Notificaciones push'
						description='Recibir notificaciones en este dispositivo'
						value={globalEnabled}
						onValueChange={(v) => updateSetting('notifications_enabled', v)}
					/>
				</View>

				{/* ── Radius ── */}
				<Text style={styles.sectionLabel}>Radio de búsqueda</Text>
				<View style={styles.card}>
					<View style={styles.radiusHeader}>
						<Text style={[styles.radiusTitle, !globalEnabled && styles.rowTitleDisabled]}>Partidos dentro de</Text>
						<Text style={styles.radiusDescription}>Solo recibirás alertas de partidos creados en este radio desde tu zona</Text>
					</View>
					<View style={styles.radiusOptions}>
						{RADIUS_OPTIONS.map((option) => {
							const isActive = settings.notification_radius === option.value
							return (
								<TouchableOpacity
									key={option.value}
									style={[styles.radiusChip, isActive && styles.radiusChipActive, !globalEnabled && styles.radiusChipDisabled]}
									onPress={() => updateSetting('notification_radius', option.value)}
									disabled={!globalEnabled}
								>
									<Text style={[styles.radiusChipText, isActive && styles.radiusChipTextActive]}>{option.label}</Text>
								</TouchableOpacity>
							)
						})}
					</View>
				</View>

				{/* ── Types ── */}
				<Text style={styles.sectionLabel}>Tipos de notificaciones</Text>
				<View style={styles.card}>
					{NOTIFICATION_TYPES.map((type, index) => {
						const isLast = index === NOTIFICATION_TYPES.length - 1
						const isActive = settings[type.key] as boolean
						return (
							<SettingRow
								key={type.key}
								icon={type.icon}
								iconColor={isActive && globalEnabled ? colors.primary : colors.textSecondaryDark}
								title={type.title}
								description={type.description}
								value={isActive}
								onValueChange={(v) => updateSetting(type.key, v)}
								disabled={!globalEnabled}
								bordered={!isLast}
							/>
						)
					})}
				</View>

				{/* ── Info ── */}
				<View style={styles.infoBox}>
					<Ionicons name='information-circle-outline' size={20} color={colors.info} />
					<View style={styles.infoText}>
						<Text style={styles.infoTitle}>Los cambios se guardan automáticamente</Text>
						<Text style={styles.infoDescription}>Podés activar o desactivar cada tipo en cualquier momento. Las notificaciones en la app siempre estarán disponibles independientemente de estas opciones.</Text>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}

// ─── Reusable row component ──────────────────────────────────────────────────
interface SettingRowProps {
	icon: keyof typeof Ionicons.glyphMap
	iconColor: string
	title: string
	description: string
	value: boolean
	onValueChange: (value: boolean) => void
	disabled?: boolean
	bordered?: boolean
}

function SettingRow({ icon, iconColor, title, description, value, onValueChange, disabled = false, bordered = false }: SettingRowProps) {
	return (
		<View style={[styles.cardRow, bordered && styles.cardRowBordered]}>
			<View style={styles.rowLeft}>
				<View style={[styles.rowIcon, { backgroundColor: `${iconColor}20` }]}>
					<Ionicons name={icon} size={20} color={iconColor} />
				</View>
				<View style={styles.rowText}>
					<Text style={[styles.rowTitle, disabled && styles.rowTitleDisabled]}>{title}</Text>
					<Text style={styles.rowDescription}>{description}</Text>
				</View>
			</View>
			<Switch
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
				trackColor={{ false: colors.borderDark, true: `${colors.primary}80` }}
				thumbColor={value && !disabled ? colors.primary : colors.textSecondaryDark}
				ios_backgroundColor={colors.surfaceDark}
			/>
		</View>
	)
}
