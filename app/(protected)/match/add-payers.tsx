import { AddPlayersForm } from '@/components/match/AddPlayersForm'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'

export default function AddPlayersModal() {
	const { matchId, teamMode, maxPlayers } = useLocalSearchParams()
	const router = useRouter()

	const handlePlayersAdded = () => {
		// Navegar de vuelta al detalle del partido
		router.back()
	}

	const handleClose = () => {
		router.back()
	}

	return (
		<>
			<Stack.Screen
				options={{
					presentation: 'modal',
					headerShown: false,
				}}
			/>

			<View className='flex-1'>
				<AddPlayersForm matchId={matchId as string} onPlayersAdded={handlePlayersAdded} onClose={handleClose} maxPlayers={maxPlayers ? parseInt(maxPlayers as string) : 10} teamMode={teamMode as 'none' | 'two_teams'} />
			</View>
		</>
	)
}
