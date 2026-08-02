import { styles } from '@/assets/styles/Register.styles'; // Importación de estilos externos
import { authService } from '@/services/auth.service'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	return 'Ocurrió un error inesperado'
}

export default function Register() {
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const isSubmittingRef = useRef(false)

	const handleRegister = async () => {
		if (isSubmittingRef.current) return
		isSubmittingRef.current = true

		try {
			setError(null)

			if (!fullName || !email || !password) {
				setError('Todos los campos son obligatorios')
				return
			}

			if (!authService.validateEmail(email)) {
				setError('Email inválido')
				return
			}

			const passwordValidation = authService.validatePassword(password)
			if (!passwordValidation.isValid) {
				setError(passwordValidation.errors[0])
				return
			}

			setLoading(true)

			// Crear usuario. El trigger handle_new_user() crea el perfil con
			// onboarding_completed = false, así que el guard de (protected) manda
			// al onboarding, que es donde se piden deportes, nivel, zona y foto.
			const { error: signUpError, data } = await authService.signUp(email, password, fullName)

			if (signUpError) throw signUpError
			if (!data?.id) throw new Error('No se pudo obtener el usuario')

			router.replace('/(protected)/(tabs)/Dashboard')
		} catch (err: unknown) {
			setError(getErrorMessage(err))
		} finally {
			isSubmittingRef.current = false
			setLoading(false)
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()}>
					<Ionicons name='chevron-back' size={28} color={colors.borderDark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Registro</Text>
				<View style={{ width: 28 }} />
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<Text style={styles.mainTitle}>Creá tu cuenta</Text>
				<Text style={styles.subtitle}>En el próximo paso armamos tu perfil deportivo.</Text>

				{/* Formulario */}
				<View style={styles.formSection}>
					<TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder='Ej. Juan Pérez' placeholderTextColor={colors.primary} maxLength={50} />

					<TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder='usuario@ejemplo.com' placeholderTextColor={colors.primary} keyboardType='email-address' autoCapitalize='none' />

					<TextInput style={styles.inputInner} value={password} onChangeText={setPassword} placeholder='Mínimo 8 caracteres' placeholderTextColor={colors.primary} secureTextEntry />
				</View>

				{error && <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>}

				{/* Botón Acción */}
				<TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
					<Text style={styles.submitButtonText}>{loading ? 'Creando cuenta...' : 'Crear Cuenta'}</Text>
				</TouchableOpacity>

				<View style={styles.footerLinks}>
					<Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>
					<TouchableOpacity onPress={() => router.replace('/(auth)/Login')}>
						<Text style={styles.linkText}>Inicia sesión</Text>
					</TouchableOpacity>
				</View>

				<Text style={styles.legalText}>
					Al registrarte, aceptas nuestros <Text style={styles.footerLinks}>Términos de Servicio</Text> y <Text style={styles.footerLinks}>Política de Privacidad</Text>.
				</Text>
			</ScrollView>
		</SafeAreaView>
	)
}
