import { useAuth } from '@/context/AuthContext'
import { MaterialIcons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

export default function TabsLayout() {
	const { isAuthenticated, isLoading } = useAuth()

	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<ActivityIndicator />
			</View>
		)
	}

	if (!isAuthenticated) {
		return <Redirect href='/(auth)/Login' />
	}

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: { backgroundColor: '#0b0b0b' },
				tabBarActiveTintColor: '#22c55e',
			}}
		>
			<Tabs.Screen
				name='Dashboard'
				options={{
					title: 'Inicio',
					tabBarIcon: ({ color, size }) => <MaterialIcons name='home' size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name='My-Matches'
				options={{
					title: 'Mis Turnos',
					tabBarIcon: ({ color, size }) => <MaterialIcons name='calendar-today' size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name='Explore'
				options={{
					title: 'Explorar',
					tabBarIcon: ({ color, size }) => <MaterialIcons name='search' size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name='Notifications'
				options={{
					title: 'Notificaciones',
					tabBarIcon: ({ color, size }) => <MaterialIcons name='notifications' size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name='Profile'
				options={{
					title: 'Perfil',
					tabBarIcon: ({ color, size }) => <MaterialIcons name='person' size={size} color={color} />,
				}}
			/>
		</Tabs>
	)
}
