import { ActivityIndicator, ImageBackground, StyleSheet, Text, View } from 'react-native'

const Loader = () => {
	return (
		<ImageBackground source={require('@/assets/images/cancha_futbol.png')} style={styles.background} resizeMode='cover'>
			<View style={styles.container}>
				<ActivityIndicator size='large' color='#00FF5F' />

				<Text style={styles.text}>Iniciando sesión...</Text>
			</View>
		</ImageBackground>
	)
}

const styles = StyleSheet.create({
	background: {
		flex: 1,
		width: '100%',
		height: '100%',
	},
	container: {
		flex: 1,
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
