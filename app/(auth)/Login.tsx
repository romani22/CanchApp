import { styles } from '@/assets/styles/Login.styles'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../theme/colorsLogin'

const images = [require('@/assets/images/cancha_basquet.png'), require('@/assets/images/cancha_futbol.png'), require('@/assets/images/cancha_padle.png'), require('@/assets/images/cancha_tenis.png')]

export default function LoginScreen() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [index, setIndex] = useState(0)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [biometricAvailable, setBiometricAvailable] = useState(false)
	const [biometricEnabled, setBiometricEnabled] = useState(false)

	const { signIn, isAuthenticated } = useAuth()
	const { isAvailable, isEnabled, enable, authenticate } = useBiometricAuth()
	const [pendingNav, setPendingNav] = useState(false)

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex((prev) => (prev + 1) % images.length)
		}, 10000)
		return () => clearInterval(interval)
	}, [])

	useEffect(() => {
		const checkBiometrics = async () => {
			const available = await isAvailable()
			setBiometricAvailable(available)
			if (available) {
				const enabled = await isEnabled()
				setBiometricEnabled(enabled)
			}
		}
		checkBiometrics()
	}, [isAvailable, isEnabled])

	// Navega solo cuando el AuthContext confirma que isAuthenticated es true
	useEffect(() => {
		if (pendingNav && isAuthenticated) {
			router.replace('/(protected)/(tabs)/Dashboard')
		}
	}, [pendingNav, isAuthenticated])

	const triggerNavigation = () => setPendingNav(true)

	const offerBiometricSetup = (emailVal: string, passwordVal: string) => {
		Alert.alert('Acceso con huella', '¿Querés activar el inicio de sesión con huella dactilar?', [
			{ text: 'Ahora no', style: 'cancel', onPress: triggerNavigation },
			{
				text: 'Activar',
				onPress: async () => {
					await enable(emailVal, passwordVal)
					setBiometricEnabled(true)
					triggerNavigation()
				},
			},
		])
	}

	const handleLogin = async () => {
		setLoading(true)
		setError(null)

		const trimmedEmail = email.trim()

		if (!trimmedEmail || !password) {
			setError('Por favor ingresa email y contraseña')
			setLoading(false)
			return
		}

		const { error } = await signIn(trimmedEmail, password)
		if (error) {
			if (error.message.includes('Invalid login credentials')) {
				setError('Email o contraseña incorrectos')
			} else if (error.message.includes('Email not confirmed')) {
				setError('Debes confirmar tu email antes de ingresar')
			} else {
				setError('Ocurrió un error inesperado')
			}
			setLoading(false)
			return
		}

		if (biometricAvailable && !biometricEnabled) {
			setLoading(false)
			offerBiometricSetup(trimmedEmail, password)
		} else {
			triggerNavigation()
		}
	}

	const handleBiometricLogin = async () => {
		setError(null)

		try {
			const credentials = await authenticate()
			if (!credentials) return

			setLoading(true)
			const { error } = await signIn(credentials.email, credentials.password)

			if (error) {
				setError('No se pudo iniciar sesión con huella. Ingresá manualmente.')
				setLoading(false)
				return
			}

			triggerNavigation()
		} catch {
			setLoading(false)
			setError('Error al autenticar con huella. Ingresá manualmente.')
		}
	}

	const handleForgotPassword = () => {
		router.push('/(auth)/ForgotPassword')
	}

	return (
		<>
			{loading ? (
				<Loader title='Iniciando Sesion...' />
			) : (
				<ImageBackground source={images[index]} style={styles.background} resizeMode='cover'>
					<SafeAreaView style={styles.container}>
						<StatusBar barStyle='light-content' backgroundColor={colors.background} />
						<View style={styles.backgroundGradient} />
						<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
							<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
								{/* Logo */}
								<View style={styles.logoContainer}>
									<View style={styles.logoBox}>
										<Ionicons name='football-outline' size={40} color={colors.primaryForeground} />
									</View>
								</View>

								{/* Title */}
								<Text style={styles.title}>Bienvenido de nuevo</Text>
								<Text style={styles.subtitle}>Accede a tu cuenta para gestionar tus turnos</Text>

								{/* Form */}
								<View style={styles.form}>
									{/* Email Field */}
									<View style={styles.fieldContainer}>
										<Text style={styles.label}>Email</Text>
										<View style={styles.inputContainer}>
											<Ionicons name='mail-outline' size={20} color={colors.mutedForeground} style={styles.inputIcon} />
											<TextInput style={styles.input} placeholder='ejemplo@correo.com' placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType='email-address' autoCapitalize='none' autoCorrect={false} />
										</View>
									</View>

									{/* Password Field */}
									<View style={styles.fieldContainer}>
										<Text style={styles.label}>Contraseña</Text>
										<View style={styles.inputContainer}>
											<Ionicons name='lock-closed-outline' size={20} color={colors.mutedForeground} style={styles.inputIcon} />
											<TextInput style={styles.input} placeholder='••••••••' placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize='none' />
											<TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
												<Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.mutedForeground} />
											</TouchableOpacity>
										</View>
									</View>

									{/* Forgot Password */}
									<TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
										<Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
									</TouchableOpacity>

									{/* Login Button */}
									<TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
										<Text style={styles.loginButtonText}>Iniciar Sesión</Text>
									</TouchableOpacity>

									{error && <Text style={{ color: 'red', textAlign: 'center', marginBottom: 12 }}>{error}</Text>}

									{/* Biometric login */}
									{biometricAvailable && biometricEnabled && (
										<>
											<View style={styles.dividerContainer}>
												<View style={styles.dividerLine} />
												<Text style={styles.dividerText}>O INGRESÁ CON</Text>
												<View style={styles.dividerLine} />
											</View>
											<View style={styles.biometricContainer}>
												<TouchableOpacity style={styles.biometricButton} onPress={handleBiometricLogin}>
													<Ionicons name='finger-print' size={32} color={colors.primaryForeground} />
												</TouchableOpacity>
												<Text style={styles.biometricText}>Huella dactilar</Text>
											</View>
										</>
									)}

									{/* Register Link */}
									<View style={styles.registerContainer}>
										<Text style={styles.registerText}>¿No tienes una cuenta? </Text>
										<TouchableOpacity onPress={() => router.push('/(auth)/Register')}>
											<Text style={styles.registerLink}>Regístrate</Text>
										</TouchableOpacity>
									</View>
								</View>
							</ScrollView>
						</KeyboardAvoidingView>
					</SafeAreaView>
				</ImageBackground>
			)}
		</>
	)
}
