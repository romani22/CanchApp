// components/ui/Loader.tsx
import { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

const Loader = () => {
	const rotation = useSharedValue(0)

	useEffect(() => {
		rotation.value = withRepeat(
			withTiming(360, { duration: 1200 }),
			-1, // repite infinito
			false, // no reversa
		)
	}, [])

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}))

	return (
		<View style={styles.container}>
			{/* Logo de cancha */}
			<Image source={require('@/assets/images/cancha_futbol.png')} style={styles.logo} resizeMode='contain' />

			{/* Loader circular */}
			<Animated.View style={[styles.circle, animatedStyle]} />

			<Text style={styles.text}>Iniciando sesión...</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#0A0A0A',
		justifyContent: 'center',
		alignItems: 'center',
	},
	logo: {
		width: 120,
		height: 120,
		marginBottom: 30,
	},
	circle: {
		width: 60,
		height: 60,
		borderWidth: 6,
		borderColor: '#00FF5F',
		borderTopColor: 'transparent',
		borderRadius: 30,
		marginBottom: 20,
	},
	text: {
		color: '#FFFFFF',
		fontSize: 16,
		marginTop: 10,
	},
})

export default Loader
