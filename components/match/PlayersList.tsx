import { useAuth } from '@/context/AuthContext'
import { MatchPlayerWithUser, TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'

interface PlayersListProps {
	players: MatchPlayerWithUser[]
	isCreator: boolean
	onRemovePlayer?: (playerId: string) => void
	onUpdateTeam?: (playerId: string, team: TeamSlot | null) => void
	teamMode?: 'none' | 'two_teams'
	showTeams?: boolean
}

export function PlayersList({ players, isCreator, onRemovePlayer, onUpdateTeam, teamMode = 'none', showTeams = false }: PlayersListProps) {
	const { user } = useAuth()

	const handleRemove = (player: MatchPlayerWithUser) => {
		Alert.alert('Eliminar jugador', `¿Estás seguro de eliminar a ${player.player_name}?`, [
			{ text: 'Cancelar', style: 'cancel' },
			{
				text: 'Eliminar',
				style: 'destructive',
				onPress: () => onRemovePlayer?.(player.id),
			},
		])
	}

	const canRemove = (player: MatchPlayerWithUser) => {
		// El creador puede eliminar a cualquiera
		if (isCreator) return true
		// El usuario que agregó al jugador puede eliminarlo
		if (player.added_by_user_id === user?.id) return true
		return false
	}

	const groupByTeam = () => {
		if (!showTeams || teamMode === 'none') return { all: players }

		return {
			A: players.filter((p) => p.team_slot === 'A'),
			B: players.filter((p) => p.team_slot === 'B'),
			none: players.filter((p) => p.team_slot === null),
		}
	}

	const renderPlayer = (player: MatchPlayerWithUser) => (
		<View key={player.id} className='flex-row items-center justify-between py-3 px-4 bg-white border-b border-gray-100'>
			{/* Avatar y nombre */}
			<View className='flex-row items-center flex-1'>
				{player.user ? (
					player.user.avatar_url ? (
						<Image source={{ uri: player.user.avatar_url }} className='w-10 h-10 rounded-full' />
					) : (
						<View className='w-10 h-10 rounded-full bg-blue-100 items-center justify-center'>
							<Text className='text-blue-600 font-bold text-lg'>{player.player_name.charAt(0).toUpperCase()}</Text>
						</View>
					)
				) : (
					<View className='w-10 h-10 rounded-full bg-gray-200 items-center justify-center'>
						<Ionicons name='person' size={20} color='#6B7280' />
					</View>
				)}

				<View className='ml-3 flex-1'>
					<Text className='text-gray-900 font-medium'>{player.player_name}</Text>
					<View className='flex-row items-center mt-1'>
						{player.user ? (
							<View className='flex-row items-center'>
								<Ionicons name='checkmark-circle' size={12} color='#10B981' />
								<Text className='text-xs text-green-600 ml-1'>Registrado</Text>
							</View>
						) : (
							<View className='flex-row items-center'>
								<Ionicons name='person-add-outline' size={12} color='#6B7280' />
								<Text className='text-xs text-gray-500 ml-1'>Invitado</Text>
							</View>
						)}

						{player.added_by_user_id !== user?.id && <Text className='text-xs text-gray-400 ml-2'>por {player.added_by.full_name}</Text>}
					</View>
				</View>
			</View>

			{/* Acciones */}
			<View className='flex-row items-center space-x-2'>
				{/* Selector de equipo */}
				{teamMode === 'two_teams' && onUpdateTeam && (
					<View className='flex-row space-x-1'>
						<TouchableOpacity className={`px-2 py-1 rounded ${player.team_slot === 'A' ? 'bg-blue-500' : 'bg-gray-200'}`} onPress={() => onUpdateTeam(player.id, player.team_slot === 'A' ? null : 'A')}>
							<Text className={`text-xs font-medium ${player.team_slot === 'A' ? 'text-white' : 'text-gray-600'}`}>A</Text>
						</TouchableOpacity>

						<TouchableOpacity className={`px-2 py-1 rounded ${player.team_slot === 'B' ? 'bg-red-500' : 'bg-gray-200'}`} onPress={() => onUpdateTeam(player.id, player.team_slot === 'B' ? null : 'B')}>
							<Text className={`text-xs font-medium ${player.team_slot === 'B' ? 'text-white' : 'text-gray-600'}`}>B</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Botón eliminar */}
				{canRemove(player) && (
					<TouchableOpacity onPress={() => handleRemove(player)} className='p-2'>
						<Ionicons name='close-circle' size={20} color='#EF4444' />
					</TouchableOpacity>
				)}
			</View>
		</View>
	)

	const groups = groupByTeam()

	if (!showTeams || teamMode === 'none') {
		return (
			<View className='bg-gray-50'>
				{players.length === 0 ? (
					<View className='py-8 px-4 items-center'>
						<Ionicons name='people-outline' size={48} color='#D1D5DB' />
						<Text className='text-gray-400 mt-2'>No hay jugadores adicionales</Text>
					</View>
				) : (
					<ScrollView className='max-h-96'>{players.map(renderPlayer)}</ScrollView>
				)}
			</View>
		)
	}

	return (
		<View className='bg-gray-50'>
			{/* Equipo A */}
			{groups.A && groups.A.length > 0 && (
				<View className='mb-4'>
					<View className='bg-blue-100 px-4 py-2 flex-row items-center'>
						<View className='w-3 h-3 rounded-full bg-blue-600 mr-2' />
						<Text className='text-blue-900 font-bold'>Equipo A ({groups.A.length})</Text>
					</View>
					{groups.A.map(renderPlayer)}
				</View>
			)}

			{/* Equipo B */}
			{groups.B && groups.B.length > 0 && (
				<View className='mb-4'>
					<View className='bg-red-100 px-4 py-2 flex-row items-center'>
						<View className='w-3 h-3 rounded-full bg-red-600 mr-2' />
						<Text className='text-red-900 font-bold'>Equipo B ({groups.B.length})</Text>
					</View>
					{groups.B.map(renderPlayer)}
				</View>
			)}

			{/* Sin equipo */}
			{groups.none && groups.none.length > 0 && (
				<View>
					<View className='bg-gray-200 px-4 py-2 flex-row items-center'>
						<Ionicons name='help-circle-outline' size={16} color='#6B7280' />
						<Text className='text-gray-700 font-bold ml-2'>Sin equipo asignado ({groups.none.length})</Text>
					</View>
					{groups.none.map(renderPlayer)}
				</View>
			)}

			{players.length === 0 && (
				<View className='py-8 px-4 items-center'>
					<Ionicons name='people-outline' size={48} color='#D1D5DB' />
					<Text className='text-gray-400 mt-2'>No hay jugadores adicionales</Text>
				</View>
			)}
		</View>
	)
}
