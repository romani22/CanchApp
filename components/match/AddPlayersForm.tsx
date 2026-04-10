import { AddPlayerInput, matchPlayersService } from '@/services/matchPlayers.service'
import { TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { useAuth } from '@/context/AuthContext'

interface AddPlayersFormProps {
	matchId: string
	onPlayersAdded?: () => void
	onClose?: () => void
	maxPlayers?: number
	teamMode?: 'none' | 'two_teams'
}

interface PlayerForm extends AddPlayerInput {
	id: string
}

export function AddPlayersForm({ matchId, onPlayersAdded, onClose, maxPlayers = 10, teamMode = 'none' }: AddPlayersFormProps) {
	const { user } = useAuth()
	const [players, setPlayers] = useState<PlayerForm[]>([{ id: '1', player_name: '', user_id: null, team_slot: null }])
	const [isSearching, setIsSearching] = useState<string | null>(null)
	const [searchResults, setSearchResults] = useState<any[]>([])
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Agregar un nuevo campo de jugador
	const addPlayerField = () => {
		if (players.length >= maxPlayers) {
			Alert.alert('Límite alcanzado', `Solo puedes agregar hasta ${maxPlayers} jugadores a la vez`)
			return
		}

		setPlayers([...players, { id: Date.now().toString(), player_name: '', user_id: null, team_slot: null }])
	}

	// Eliminar un campo de jugador
	const removePlayerField = (id: string) => {
		if (players.length === 1) return
		setPlayers(players.filter((p) => p.id !== id))
	}

	// Actualizar el nombre de un jugador
	const updatePlayerName = (id: string, name: string) => {
		setPlayers(players.map((p) => (p.id === id ? { ...p, player_name: name } : p)))

		// Buscar usuarios si hay más de 2 caracteres
		if (name.length >= 2) {
			searchUsers(id, name)
		} else {
			setSearchResults([])
			setIsSearching(null)
		}
	}

	// Buscar usuarios registrados
	const searchUsers = async (playerId: string, query: string) => {
		try {
			setIsSearching(playerId)
			const results = await matchPlayersService.searchUsers(query, 5)
			setSearchResults(results)
		} catch (error) {
			console.error('Error searching users:', error)
		} finally {
			setIsSearching(null)
		}
	}

	// Seleccionar un usuario de la búsqueda
	const selectUser = (playerId: string, selectedUser: any) => {
		setPlayers(
			players.map((p) =>
				p.id === playerId
					? {
							...p,
							player_name: selectedUser.full_name,
							user_id: selectedUser.id,
						}
					: p,
			),
		)
		setSearchResults([])
	}

	// Cambiar equipo de un jugador
	const updatePlayerTeam = (id: string, team: TeamSlot | null) => {
		setPlayers(players.map((p) => (p.id === id ? { ...p, team_slot: team } : p)))
	}

	// Enviar formulario
	const handleSubmit = async () => {
		if (!user?.id) {
			Alert.alert('Error', 'Debes iniciar sesión')
			return
		}

		// Validar que todos tengan nombre
		const validPlayers = players.filter((p) => p.player_name.trim().length > 0)

		if (validPlayers.length === 0) {
			Alert.alert('Error', 'Debes agregar al menos un jugador')
			return
		}

		try {
			setIsSubmitting(true)

			// Preparar datos
			const playersToAdd: AddPlayerInput[] = validPlayers.map((p) => ({
				player_name: p.player_name.trim(),
				user_id: p.user_id,
				team_slot: teamMode === 'two_teams' ? p.team_slot : null,
			}))

			// Agregar jugadores
			const results = await matchPlayersService.addMultiplePlayers(matchId, user.id, playersToAdd)

			// Contar éxitos y errores
			const successes = results.filter((r) => r.success).length
			const failures = results.filter((r) => !r.success).length

			if (successes > 0) {
				Alert.alert('Éxito', `${successes} jugador(es) agregado(s)${failures > 0 ? `, ${failures} fallaron` : ''}`)
				onPlayersAdded?.()
				onClose?.()
			} else {
				Alert.alert('Error', 'No se pudo agregar ningún jugador')
			}
		} catch (error: any) {
			Alert.alert('Error', error.message || 'Error al agregar jugadores')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<View className='flex-1 bg-white'>
			<View className='p-4 border-b border-gray-200'>
				<View className='flex-row items-center justify-between'>
					<Text className='text-xl font-bold text-gray-900'>Agregar Jugadores</Text>
					{onClose && (
						<TouchableOpacity onPress={onClose}>
							<Ionicons name='close' size={24} color='#374151' />
						</TouchableOpacity>
					)}
				</View>
				<Text className='text-sm text-gray-500 mt-1'>Puedes agregar amigos o invitados</Text>
			</View>

			<ScrollView className='flex-1 p-4'>
				{players.map((player, index) => (
					<View key={player.id} className='mb-4 p-4 bg-gray-50 rounded-lg'>
						<View className='flex-row items-center justify-between mb-2'>
							<Text className='text-sm font-semibold text-gray-700'>Jugador {index + 1}</Text>
							{players.length > 1 && (
								<TouchableOpacity onPress={() => removePlayerField(player.id)}>
									<Ionicons name='trash-outline' size={20} color='#EF4444' />
								</TouchableOpacity>
							)}
						</View>

						{/* Nombre del jugador */}
						<View className='mb-3'>
							<Text className='text-xs text-gray-600 mb-1'>Nombre</Text>
							<View className='flex-row items-center'>
								<TextInput className='flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2' placeholder='Nombre del jugador' value={player.player_name} onChangeText={(text) => updatePlayerName(player.id, text)} autoCapitalize='words' />
								{isSearching === player.id && <ActivityIndicator className='ml-2' />}
							</View>

							{/* Resultados de búsqueda */}
							{searchResults.length > 0 && isSearching !== player.id && (
								<View className='mt-2 bg-white border border-gray-300 rounded-lg overflow-hidden'>
									{searchResults.map((searchUser) => (
										<TouchableOpacity key={searchUser.id} className='p-3 border-b border-gray-200' onPress={() => selectUser(player.id, searchUser)}>
											<Text className='font-medium text-gray-900'>{searchUser.full_name}</Text>
											<Text className='text-xs text-gray-500'>{searchUser.email}</Text>
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>

						{/* Selector de equipo (si aplica) */}
						{teamMode === 'two_teams' && (
							<View>
								<Text className='text-xs text-gray-600 mb-2'>Equipo</Text>
								<View className='flex-row space-x-2'>
									<TouchableOpacity className={`flex-1 py-2 px-3 rounded-lg border ${player.team_slot === 'A' ? 'bg-blue-500 border-blue-600' : 'bg-white border-gray-300'}`} onPress={() => updatePlayerTeam(player.id, 'A')}>
										<Text className={`text-center font-medium ${player.team_slot === 'A' ? 'text-white' : 'text-gray-700'}`}>Equipo A</Text>
									</TouchableOpacity>

									<TouchableOpacity className={`flex-1 py-2 px-3 rounded-lg border ${player.team_slot === 'B' ? 'bg-red-500 border-red-600' : 'bg-white border-gray-300'}`} onPress={() => updatePlayerTeam(player.id, 'B')}>
										<Text className={`text-center font-medium ${player.team_slot === 'B' ? 'text-white' : 'text-gray-700'}`}>Equipo B</Text>
									</TouchableOpacity>

									<TouchableOpacity className={`flex-1 py-2 px-3 rounded-lg border ${player.team_slot === null ? 'bg-gray-300 border-gray-400' : 'bg-white border-gray-300'}`} onPress={() => updatePlayerTeam(player.id, null)}>
										<Text className={`text-center font-medium ${player.team_slot === null ? 'text-white' : 'text-gray-700'}`}>Sin equipo</Text>
									</TouchableOpacity>
								</View>
							</View>
						)}

						{/* Indicador si es usuario registrado */}
						{player.user_id && (
							<View className='flex-row items-center mt-2'>
								<Ionicons name='checkmark-circle' size={16} color='#10B981' />
								<Text className='text-xs text-green-600 ml-1'>Usuario registrado</Text>
							</View>
						)}
					</View>
				))}

				{/* Botón para agregar más jugadores */}
				{players.length < maxPlayers && (
					<TouchableOpacity className='flex-row items-center justify-center py-3 border border-dashed border-gray-400 rounded-lg' onPress={addPlayerField}>
						<Ionicons name='add-circle-outline' size={20} color='#6B7280' />
						<Text className='text-gray-600 ml-2 font-medium'>Agregar otro jugador</Text>
					</TouchableOpacity>
				)}
			</ScrollView>

			{/* Botones de acción */}
			<View className='p-4 border-t border-gray-200'>
				<TouchableOpacity className={`py-3 rounded-lg ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`} onPress={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? <ActivityIndicator color='white' /> : <Text className='text-white text-center font-semibold'>Agregar Jugadores ({players.filter((p) => p.player_name.trim()).length})</Text>}
				</TouchableOpacity>
			</View>
		</View>
	)
}
