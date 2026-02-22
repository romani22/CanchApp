import { styles } from '@/assets/styles/ForgotPassword.styles'
import { useAuth } from '@/context/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native'

const images = [require('@/assets/images/cancha_basquet.png'), require('@/assets/images/cancha_futbol.png'), require('@/assets/images/cancha_padle.png'), require('@/assets/images/cancha_tenis.png')]

export default function ForgotPassword() {
	const router = useRouter()
	const { resetPassword } = useAuth()

	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)

	const [index, setIndex] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex((prev) => (prev + 1) % images.length)
		}, 40000) // 4 segundos

		return () => clearInterval(interval)
	}, [])

	const handleReset = async () => {
		if (!email) {
			Alert.alert('Error', 'Ingresa tu correo electrónico')
			return
		}

		setLoading(true)
		const { error } = await resetPassword(email)
		setLoading(false)

		if (error) {
			Alert.alert('Error', error.message)
			return
		}

		Alert.alert('Éxito', 'Te enviamos un enlace para restablecer tu contraseña')
	}

	return (
		<ImageBackground
			source={images[index]} // tu imagen de fondo
			style={styles.background}
			blurRadius={2}
		>
			<View style={styles.overlay} />

			<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<View style={styles.content}>
					<Ionicons name='football-outline' size={60} color='#22c55e' style={{ marginBottom: 20 }} />

					<Text style={styles.title}>¿Olvidaste tu contraseña?</Text>

					<Text style={styles.subtitle}>Ingresa tu correo electrónico para recibir un enlace de recuperación.</Text>

					<View style={styles.inputContainer}>
						<Ionicons name='mail-outline' size={20} color='#9ca3af' style={{ marginRight: 10 }} />
						<TextInput style={styles.input} placeholder='ejemplo@correo.com' placeholderTextColor='#9ca3af' value={email} onChangeText={setEmail} keyboardType='email-address' autoCapitalize='none' />
					</View>

					<TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
						<Text style={styles.buttonText}>{loading ? 'Enviando...' : 'Enviar Enlace'}</Text>
					</TouchableOpacity>

					<TouchableOpacity onPress={() => router.replace('/(auth)/Login')}>
						<Text style={styles.backText}>Volver al inicio</Text>
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</ImageBackground>
	)
}
