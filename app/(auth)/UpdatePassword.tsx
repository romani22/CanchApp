import { styles } from '@/assets/styles/ForgotPassword.styles'
import { useAuth } from '@/context/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native'

const images = [require('@/assets/images/cancha_basquet.png'), require('@/assets/images/cancha_futbol.png'), require('@/assets/images/cancha_padle.png'), require('@/assets/images/cancha_tenis.png')]

export default function UpdatePassword() {
	const router = useRouter()
	const { updatePassword } = useAuth()

	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [index, setIndex] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex((prev) => (prev + 1) % images.length)
		}, 40000)
		return () => clearInterval(interval)
	}, [])

	const handleUpdate = async () => {
		if (!password || !confirmPassword) {
			Alert.alert('Error', 'Completá ambos campos')
			return
		}

		if (password !== confirmPassword) {
			Alert.alert('Error', 'Las contraseñas no coinciden')
			return
		}

		if (password.length < 8) {
			Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres')
			return
		}

		setLoading(true)
		const { error } = await updatePassword(password)
		setLoading(false)

		if (error) {
			Alert.alert('Error', error.message)
			return
		}

		Alert.alert('Éxito', 'Tu contraseña fue actualizada correctamente', [{ text: 'OK', onPress: () => router.replace('/(auth)/Login') }])
	}

	return (
		<ImageBackground source={images[index]} style={styles.background} blurRadius={2}>
			<View style={styles.overlay} />

			<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<View style={styles.content}>
					<Ionicons name='lock-closed-outline' size={60} color='#22c55e' style={{ marginBottom: 20 }} />

					<Text style={styles.title}>Nueva contraseña</Text>

					<Text style={styles.subtitle}>Ingresá tu nueva contraseña para continuar.</Text>

					<View style={styles.inputContainer}>
						<Ionicons name='lock-closed-outline' size={20} color='#9ca3af' style={{ marginRight: 10 }} />
						<TextInput
							style={styles.input}
							placeholder='Nueva contraseña'
							placeholderTextColor='#9ca3af'
							value={password}
							onChangeText={setPassword}
							secureTextEntry={!showPassword}
							autoCapitalize='none'
						/>
						<TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
							<Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color='#9ca3af' />
						</TouchableOpacity>
					</View>

					<View style={styles.inputContainer}>
						<Ionicons name='lock-closed-outline' size={20} color='#9ca3af' style={{ marginRight: 10 }} />
						<TextInput
							style={styles.input}
							placeholder='Confirmar contraseña'
							placeholderTextColor='#9ca3af'
							value={confirmPassword}
							onChangeText={setConfirmPassword}
							secureTextEntry={!showPassword}
							autoCapitalize='none'
						/>
					</View>

					<TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={loading}>
						<Text style={styles.buttonText}>{loading ? 'Actualizando...' : 'Actualizar contraseña'}</Text>
					</TouchableOpacity>

					<TouchableOpacity onPress={() => router.replace('/(auth)/Login')}>
						<Text style={styles.backText}>Volver al inicio</Text>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</ImageBackground>
	)
}
