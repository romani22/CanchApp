import { useAuth } from '@/context/AuthContext'
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
export default function TabsLayout() {
	const { isAuthenticated, isLoading } = useAuth()

	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b0b0b' }}>
				<ActivityIndicator color='#22c55e' />
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
				tabBarActiveTintColor: '#22c55e',
				tabBarInactiveTintColor: '#ADADAD',
				tabBarStyle: {
					backgroundColor: 'transparent', // Importante: transparente para ver el degradado
					borderTopWidth: 1,
					borderTopColor: '#156D35',
					position: 'absolute', // Permite que el contenido se vea por debajo si lo deseas
					elevation: 0,
					height: Platform.OS === 'ios' ? 90 : 70,
				},
				// AQUÍ ESTÁ EL TRUCO: El fondo con degradado
				tabBarBackground: () => <LinearGradient colors={['#092413', '#000000', '#000000']} style={{ flex: 1 }} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />,
				tabBarLabelStyle: {
					fontSize: 10,
					fontWeight: '700',
					marginBottom: 10,
				},
			}}
		>
			<Tabs.Screen
				name='Dashboard'
				options={{
					title: 'INICIO',
					tabBarIcon: ({ focused, color, size }) => (
						<View style={focused ? styles.selectTab : null}>
							<MaterialIcons name='home' size={size} color={focused ? '#fff' : color} />
						</View>
					),
				}}
			/>
			<Tabs.Screen
				name='My-Matches'
				options={{
					title: 'Mis Turnos',
					tabBarIcon: ({ focused, color, size }) => (
						<View style={focused ? styles.selectTab : null}>
							<MaterialIcons name='calendar-today' size={size} color={focused ? '#fff' : color} />
						</View>
					),
				}}
			/>
			<Tabs.Screen
				name='Explore'
				options={{
					title: 'Explorar',
					tabBarIcon: ({ focused, color, size }) => (
						<View style={focused ? styles.selectTab : null}>
							<FontAwesome5 name='search' size={size} color={focused ? '#fff' : color} />
						</View>
					),
				}}
			/>
			<Tabs.Screen
				name='Notifications'
				options={{
					title: 'Notificaciones',
					tabBarIcon: ({ focused, color, size }) => (
						<View style={focused ? styles.selectTab : null}>
							<MaterialIcons name='notifications' size={size} color={focused ? '#fff' : color} />
						</View>
					),
				}}
			/>
			<Tabs.Screen
				name='Profile'
				options={{
					title: 'Perfil',
					tabBarIcon: ({ focused, color, size }) => (
						<View style={focused ? styles.selectTab : null}>
							<MaterialIcons name='person' size={size} color={focused ? '#fff' : color} />
						</View>
					),
				}}
			/>
		</Tabs>
	)
}

const styles = StyleSheet.create({
	selectTab: {
		top: -15, // Eleva el icono
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#22c55e', // Fondo verde si está activo
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 5, // Sombra en Android
		shadowColor: '#22c55e', // Resplandor en iOS
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 5,
		borderWidth: 2,
		borderColor: '#0b0b0b',
	},
})
