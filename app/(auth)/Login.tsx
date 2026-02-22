import { styles } from '@/assets/styles/Login.styles'
import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../theme/colorsLogin'

const images = [require('@/assets/images/cancha_basquet.png'), require('@/assets/images/cancha_futbol.png'), require('@/assets/images/cancha_padle.png'), require('@/assets/images/cancha_tenis.png')]

export default function LoginScreen({ navigation }: { navigation?: any }) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [index, setIndex] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex((prev) => (prev + 1) % images.length)
		}, 40000) // 4 segundos

		return () => clearInterval(interval)
	}, [])

	const { signIn } = useAuth()
	// const { signIn, signInWithGoogle } = useAuth()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleLogin = async () => {
		setLoading(true)
		setError(null)

		const { error } = await signIn(email, password)
		if (error) {
			setError(error.message)
		}
		setLoading(false)
		router.replace('/(protected)/(tabs)/Dashboard')
	}

	// const handleGoogleLogin = async () => {
	// 	try {
	// 		setLoading(true)
	// 		await signInWithGoogle()
	// 	} catch (err: any) {
	// 		setError(err.message)
	// 	} finally {
	// 		setLoading(false)
	// 	}
	// }
	const handleForgotPassword = () => {
		router.push('/(auth)/ForgotPassword')
	}
	return (
		<>
			{loading ? (
				<>
					<Loader />
				</>
			) : (
				<ImageBackground source={images[index]} style={styles.background} resizeMode='cover'>
					<SafeAreaView style={styles.container}>
						<StatusBar barStyle='light-content' backgroundColor={colors.background} />
						<View style={styles.backgroundGradient} />
						<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
							<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
								<>
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
										{/* Divider */}
										<View style={styles.dividerContainer}>
											<View style={styles.dividerLine} />
											<Text style={styles.dividerText}>O CONTINUAR CON</Text>
											<View style={styles.dividerLine} />
										</View>

										{/* Google Button */}
										{/* <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
										<Text style={styles.googleIcon}>G</Text>
										<Text style={styles.googleButtonText}>Google</Text>
									</TouchableOpacity> */}

										{/* Register Link */}
										<View style={styles.registerContainer}>
											<Text style={styles.registerText}>¿No tienes una cuenta? </Text>
											<TouchableOpacity onPress={() => router.push('/(auth)/Register')}>
												<Text style={styles.registerLink}>Regístrate</Text>
											</TouchableOpacity>
										</View>
									</View>
								</>
							</ScrollView>
						</KeyboardAvoidingView>
					</SafeAreaView>
				</ImageBackground>
			)}
		</>
	)
}
