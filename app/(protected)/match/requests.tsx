import { requestsService } from '@/services/requests.service'
import { JoinRequestWithUser } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'

export default function MatchRequestsScreen() {
	const { id } = useLocalSearchParams()
	const [requests, setRequests] = useState<JoinRequestWithUser[]>([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [processingId, setProcessingId] = useState<string | null>(null)

	useEffect(() => {
		loadRequests()

		// Suscribirse a cambios en tiempo real
		const subscription = requestsService.subscribe(id as string, (payload) => {
			console.log('Request change:', payload)
			loadRequests()
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [id])

	const loadRequests = async () => {
		try {
			setLoading(true)
			const data = await requestsService.getMatch(id as string)
			setRequests(data)
		} catch (error) {
			console.error('Error loading requests:', error)
			Alert.alert('Error', 'No se pudieron cargar las solicitudes')
		} finally {
			setLoading(false)
			setRefreshing(false)
		}
	}

	const handleAccept = async (requestId: string, userName: string) => {
		Alert.alert('Aceptar solicitud', `¿Quieres aceptar a ${userName}?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Aceptar',
				onPress: async () => {
					try {
						setProcessingId(requestId)
						await requestsService.accept(requestId)
						Alert.alert('¡Listo!', `${userName} se unió al partido`)
						loadRequests()
					} catch (error: any) {
						Alert.alert('Error', error.message || 'No se pudo aceptar la solicitud')
					} finally {
						setProcessingId(null)
					}
				},
			},
		])
	}

	const handleReject = async (requestId: string, userName: string) => {
		Alert.alert('Rechazar solicitud', `¿Estás seguro de rechazar a ${userName}?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Rechazar',
				style: 'destructive',
				onPress: async () => {
					try {
						setProcessingId(requestId)
						await requestsService.reject(requestId)
						Alert.alert('Rechazado', `Se rechazó la solicitud de ${userName}`)
						loadRequests()
					} catch (error: any) {
						Alert.alert('Error', error.message || 'No se pudo rechazar la solicitud')
					} finally {
						setProcessingId(null)
					}
				},
			},
		])
	}

	const onRefresh = () => {
		setRefreshing(true)
		loadRequests()
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
					title: 'Solicitudes Pendientes',
					headerBackTitle: 'Atrás',
				}}
			/>

			<ScrollView className='flex-1 bg-gray-50' refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
				{requests.length === 0 ? (
					<View className='flex-1 items-center justify-center py-20'>
						<Ionicons name='people-outline' size={64} color='#D1D5DB' />
						<Text className='text-gray-400 text-lg mt-4'>No hay solicitudes pendientes</Text>
						<Text className='text-gray-400 text-sm mt-2'>Aquí aparecerán cuando alguien quiera unirse</Text>
					</View>
				) : (
					<View className='p-4'>
						<View className='bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex-row items-center'>
							<Ionicons name='information-circle' size={20} color='#3B82F6' />
							<Text className='text-blue-700 text-sm ml-2 flex-1'>Tienes {requests.length} solicitud(es) pendiente(s)</Text>
						</View>

						{requests.map((request) => (
							<RequestCard key={request.id} request={request} onAccept={() => handleAccept(request.id, request.user.full_name)} onReject={() => handleReject(request.id, request.user.full_name)} isProcessing={processingId === request.id} />
						))}
					</View>
				)}
			</ScrollView>
		</>
	)
}

interface RequestCardProps {
	request: JoinRequestWithUser
	onAccept: () => void
	onReject: () => void
	isProcessing: boolean
}

function RequestCard({ request, onAccept, onReject, isProcessing }: RequestCardProps) {
	return (
		<View className='bg-white rounded-lg shadow-sm mb-3 overflow-hidden'>
			{/* Header del usuario */}
			<View className='p-4 border-b border-gray-100'>
				<View className='flex-row items-center'>
					{request.user.avatar_url ? (
						<Image source={{ uri: request.user.avatar_url }} className='w-14 h-14 rounded-full' />
					) : (
						<View className='w-14 h-14 rounded-full bg-blue-100 items-center justify-center'>
							<Text className='text-blue-600 font-bold text-xl'>{request.user.full_name.charAt(0).toUpperCase()}</Text>
						</View>
					)}

					<View className='ml-3 flex-1'>
						<Text className='text-gray-900 font-semibold text-base'>{request.user.full_name}</Text>
						<View className='flex-row items-center mt-1'>
							<Ionicons name='star' size={14} color='#F59E0B' />
							<Text className='text-gray-600 text-sm ml-1'>{request.user.rating.toFixed(1)}</Text>
							<Text className='text-gray-400 text-sm ml-2'>
								{request.user.total_matches} {request.user.total_matches === 1 ? 'partido' : 'partidos'}
							</Text>
						</View>
					</View>

					<View className='bg-gray-100 px-3 py-1 rounded-full'>
						<Text className='text-gray-600 text-xs font-medium capitalize'>{request.user.skill_level}</Text>
					</View>
				</View>
			</View>

			{/* Mensaje (si hay) */}
			{request.message && (
				<View className='px-4 py-3 bg-gray-50'>
					<View className='flex-row items-start'>
						<Ionicons name='chatbubble-outline' size={16} color='#6B7280' />
						<Text className='text-gray-700 text-sm ml-2 flex-1 italic'>{request.message}</Text>
					</View>
				</View>
			)}

			{/* Info adicional */}
			<View className='px-4 py-3 border-t border-gray-100'>
				<View className='flex-row items-center'>
					<Ionicons name='time-outline' size={16} color='#9CA3AF' />
					<Text className='text-gray-500 text-xs ml-1'>Solicitó hace {format(new Date(request.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}</Text>
				</View>

				{request.user.zone && (
					<View className='flex-row items-center mt-1'>
						<Ionicons name='location-outline' size={16} color='#9CA3AF' />
						<Text className='text-gray-500 text-xs ml-1'>{request.user.zone}</Text>
					</View>
				)}
			</View>

			{/* Botones de acción */}
			<View className='flex-row p-3 bg-gray-50 space-x-3'>
				<TouchableOpacity className={`flex-1 py-3 rounded-lg border ${isProcessing ? 'bg-gray-200 border-gray-300' : 'bg-white border-red-300'}`} onPress={onReject} disabled={isProcessing}>
					<View className='flex-row items-center justify-center'>
						<Ionicons name='close-circle' size={20} color={isProcessing ? '#9CA3AF' : '#EF4444'} />
						<Text className={`ml-2 font-semibold ${isProcessing ? 'text-gray-400' : 'text-red-600'}`}>Rechazar</Text>
					</View>
				</TouchableOpacity>

				<TouchableOpacity className={`flex-1 py-3 rounded-lg ${isProcessing ? 'bg-gray-400' : 'bg-blue-600'}`} onPress={onAccept} disabled={isProcessing}>
					{isProcessing ? (
						<ActivityIndicator color='white' />
					) : (
						<View className='flex-row items-center justify-center'>
							<Ionicons name='checkmark-circle' size={20} color='white' />
							<Text className='text-white ml-2 font-semibold'>Aceptar</Text>
						</View>
					)}
				</TouchableOpacity>
			</View>
		</View>
	)
}
