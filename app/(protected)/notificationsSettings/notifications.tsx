import { useAuth } from '@/context/AuthContext'
import { usePushNotifications } from '@/hooks/usePushnotifications'
import { notificationsService } from '@/services/notifications.service'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native'

const RADIUS_OPTIONS = [
	{ value: 5000, label: '5 km' },
	{ value: 10000, label: '10 km' },
	{ value: 20000, label: '20 km' },
	{ value: 30000, label: '30 km' },
	{ value: 50000, label: '50 km' },
]

export default function NotificationSettingsScreen() {
	const { user } = useAuth()
	const { checkPermissions, requestPermissions, expoPushToken } = usePushNotifications()

	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [hasPermissions, setHasPermissions] = useState(false)

	// Estados de configuración
	const [settings, setSettings] = useState({
		notifications_enabled: true,
		notification_radius: 20000,
		notify_new_matches: true,
		notify_join_requests: true,
		notify_request_response: true,
		notify_player_joined: true,
		notify_match_reminder: true,
	})

	useEffect(() => {
		loadSettings()
		checkNotificationPermissions()
	}, [])

	const checkNotificationPermissions = async () => {
		const granted = await checkPermissions()
		setHasPermissions(granted)
	}

	const loadSettings = async () => {
		if (!user?.id) return

		try {
			setLoading(true)
			const data = await notificationsService.getSettings(user.id)
			setSettings(data)
		} catch (error) {
			console.error('Error loading settings:', error)
			Alert.alert('Error', 'No se pudieron cargar las configuraciones')
		} finally {
			setLoading(false)
		}
	}

	const saveSettings = async () => {
		if (!user?.id) return

		try {
			setSaving(true)
			await notificationsService.updateSettings(user.id, settings)
			Alert.alert('Guardado', 'Tus preferencias se actualizaron correctamente')
		} catch (error) {
			console.error('Error saving settings:', error)
			Alert.alert('Error', 'No se pudieron guardar las configuraciones')
		} finally {
			setSaving(false)
		}
	}

	const handleRequestPermissions = async () => {
		await requestPermissions()
		const granted = await checkPermissions()
		setHasPermissions(granted)

		if (!granted) {
			Alert.alert('Permisos denegados', 'Para recibir notificaciones push, debes habilitar los permisos en la configuración de tu dispositivo.', [
				{ text: 'Cancelar', style: 'cancel' },
				{ text: 'Ir a Configuración', onPress: () => {} },
			])
		}
	}

	const updateSetting = (key: string, value: any) => {
		setSettings((prev) => ({ ...prev, [key]: value }))
	}

	if (loading) {
		return (
			<View className='flex-1 bg-white items-center justify-center'>
				<ActivityIndicator size='large' color='#3B82F6' />
			</View>
		)
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Configuración de Notificaciones',
					headerBackTitle: 'Atrás',
				}}
			/>

			<ScrollView className='flex-1 bg-gray-50'>
				{/* Estado de permisos */}
				<View className='bg-white p-4 mb-4'>
					<View className='flex-row items-center justify-between mb-3'>
						<View className='flex-row items-center flex-1'>
							<Ionicons name={hasPermissions ? 'checkmark-circle' : 'alert-circle'} size={24} color={hasPermissions ? '#10B981' : '#F59E0B'} />
							<Text className='text-gray-900 font-semibold ml-3 flex-1'>Permisos de Notificaciones</Text>
						</View>
						{hasPermissions ? (
							<View className='bg-green-100 px-3 py-1 rounded-full'>
								<Text className='text-green-700 text-xs font-medium'>Activo</Text>
							</View>
						) : (
							<TouchableOpacity className='bg-blue-600 px-4 py-2 rounded-lg' onPress={handleRequestPermissions}>
								<Text className='text-white text-xs font-semibold'>Activar</Text>
							</TouchableOpacity>
						)}
					</View>

					{expoPushToken && (
						<View className='bg-gray-50 p-3 rounded-lg'>
							<Text className='text-xs text-gray-500 mb-1'>Token del dispositivo:</Text>
							<Text className='text-xs text-gray-700 font-mono' numberOfLines={1} ellipsizeMode='middle'>
								{expoPushToken}
							</Text>
						</View>
					)}
				</View>

				{/* Switch principal */}
				<View className='bg-white mb-4'>
					<View className='flex-row items-center justify-between p-4 border-b border-gray-200'>
						<View className='flex-1 mr-3'>
							<Text className='text-gray-900 font-semibold text-base'>Notificaciones Push</Text>
							<Text className='text-gray-500 text-sm mt-1'>Recibir notificaciones en tu dispositivo</Text>
						</View>
						<Switch value={settings.notifications_enabled} onValueChange={(value) => updateSetting('notifications_enabled', value)} trackColor={{ false: '#D1D5DB', true: '#3B82F6' }} thumbColor='#FFFFFF' />
					</View>
				</View>

				{/* Radio de búsqueda */}
				<View className='bg-white mb-4'>
					<View className='p-4 border-b border-gray-200'>
						<View className='flex-row items-center mb-2'>
							<Ionicons name='location' size={20} color='#3B82F6' />
							<Text className='text-gray-900 font-semibold text-base ml-2'>Radio de Notificación</Text>
						</View>
						<Text className='text-gray-500 text-sm'>Recibe notificaciones de partidos dentro de esta distancia</Text>
					</View>

					<View className='flex-row flex-wrap p-2'>
						{RADIUS_OPTIONS.map((option) => (
							<TouchableOpacity key={option.value} className={`m-2 px-4 py-2 rounded-full border ${settings.notification_radius === option.value ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`} onPress={() => updateSetting('notification_radius', option.value)} disabled={!settings.notifications_enabled}>
								<Text className={`font-medium ${settings.notification_radius === option.value ? 'text-white' : 'text-gray-700'}`}>{option.label}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{/* Tipos de notificaciones */}
				<View className='bg-white mb-4'>
					<View className='p-4 border-b border-gray-200'>
						<Text className='text-gray-900 font-semibold text-base'>Tipos de Notificaciones</Text>
						<Text className='text-gray-500 text-sm mt-1'>Elige qué notificaciones quieres recibir</Text>
					</View>

					<NotificationOption icon='football' title='Nuevos partidos cercanos' description='Cuando se crea un partido cerca de tu ubicación' value={settings.notify_new_matches} onValueChange={(value) => updateSetting('notify_new_matches', value)} disabled={!settings.notifications_enabled} />

					<NotificationOption icon='person-add' title='Solicitudes de unión' description='Cuando alguien quiere unirse a tu partido' value={settings.notify_join_requests} onValueChange={(value) => updateSetting('notify_join_requests', value)} disabled={!settings.notifications_enabled} />

					<NotificationOption icon='checkmark-circle' title='Respuestas a solicitudes' description='Cuando aceptan o rechazan tu solicitud' value={settings.notify_request_response} onValueChange={(value) => updateSetting('notify_request_response', value)} disabled={!settings.notifications_enabled} />

					<NotificationOption icon='people' title='Jugadores agregados' description='Cuando te agregan a un partido' value={settings.notify_player_joined} onValueChange={(value) => updateSetting('notify_player_joined', value)} disabled={!settings.notifications_enabled} />

					<NotificationOption icon='alarm' title='Recordatorios de partido' description='10 minutos antes de que comience tu partido' value={settings.notify_match_reminder} onValueChange={(value) => updateSetting('notify_match_reminder', value)} disabled={!settings.notifications_enabled} isLast />
				</View>

				{/* Información adicional */}
				<View className='bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4 mb-6'>
					<View className='flex-row items-start'>
						<Ionicons name='information-circle' size={20} color='#3B82F6' />
						<View className='ml-3 flex-1'>
							<Text className='text-blue-900 font-medium text-sm'>Acerca de las notificaciones</Text>
							<Text className='text-blue-700 text-xs mt-1'>Las notificaciones te ayudan a estar al tanto de partidos, solicitudes y recordatorios importantes. Puedes desactivarlas en cualquier momento.</Text>
						</View>
					</View>
				</View>
			</ScrollView>

			{/* Botón guardar */}
			<View className='bg-white border-t border-gray-200 p-4'>
				<TouchableOpacity className={`py-3 rounded-lg ${saving ? 'bg-gray-400' : 'bg-blue-600'}`} onPress={saveSettings} disabled={saving || !hasPermissions}>
					{saving ? <ActivityIndicator color='white' /> : <Text className='text-white text-center font-semibold text-base'>Guardar Cambios</Text>}
				</TouchableOpacity>
			</View>
		</>
	)
}

interface NotificationOptionProps {
	icon: keyof typeof Ionicons.glyphMap
	title: string
	description: string
	value: boolean
	onValueChange: (value: boolean) => void
	disabled?: boolean
	isLast?: boolean
}

function NotificationOption({ icon, title, description, value, onValueChange, disabled, isLast }: NotificationOptionProps) {
	return (
		<View className={`flex-row items-center justify-between p-4 ${!isLast ? 'border-b border-gray-200' : ''}`}>
			<View className='flex-row items-center flex-1 mr-3'>
				<View className={`w-10 h-10 rounded-full items-center justify-center ${value && !disabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
					<Ionicons name={icon} size={20} color={value && !disabled ? '#3B82F6' : '#9CA3AF'} />
				</View>
				<View className='ml-3 flex-1'>
					<Text className={`font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{title}</Text>
					<Text className='text-gray-500 text-xs mt-1'>{description}</Text>
				</View>
			</View>
			<Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: '#D1D5DB', true: '#3B82F6' }} thumbColor='#FFFFFF' />
		</View>
	)
}
