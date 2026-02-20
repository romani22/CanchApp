import { supabase } from '@/lib/supabase'
import { authService } from '@/services/auth.service'
import { colors } from '@/theme/colors'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { styles } from '../../assets/styles/Register.styles'; // Importación de estilos externos

const sports = [
	{ id: 'futbol', label: 'Fútbol', icon: 'soccer' },
	{ id: 'tenis', label: 'Tenis', icon: 'tennis' },
	{ id: 'padel', label: 'Pádel', icon: 'human-handsup' },
	{ id: 'basquet', label: 'Básquet', icon: 'basketball' },
	{ id: 'voley', label: 'Vóley', icon: 'volleyball' },
]

const levels = [
	{ label: 'Principiante', value: 'principiante' as const },
	{ label: 'Intermedio', value: 'intermedio' as const },
	{ label: 'Avanzado', value: 'avanzado' as const },
]

export default function Register() {
	const [selectedSports, setSelectedSports] = useState(['futbol'])
	const [level, setLevel] = useState<'principiante' | 'intermedio' | 'avanzado'>('intermedio')
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [zone, setZone] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const toggleSport = (id: string) => {
		setSelectedSports((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
	}

	const handleRegister = async () => {
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

			// 1️⃣ Crear usuario (esto dispara el trigger)
			const { error: signUpError, data } = await authService.signUp(email, password, fullName)

			if (signUpError) throw signUpError

			const userId = data?.id
			if (!userId) throw new Error('No se pudo obtener el usuario')

			// 2️⃣ Actualizar perfil ya creado por el trigger
			const { error: updateError } = await supabase
				.from('profiles')
				.update({
					favorite_sports: selectedSports,
					skill_level: level.toLowerCase(), // importante
					zone,
				})
				.eq('id', userId)

			if (updateError) throw updateError

			router.replace('/(tabs)/Dashboard')
		} catch (err: any) {
			setError(err.message)
		} finally {
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
				<Text style={styles.mainTitle}>Crea tu perfil deportivo</Text>
				<Text style={styles.subtitle}>Únete para competir y reservar turnos en los mejores clubes.</Text>

				{/* Formulario */}
				<View style={styles.formSection}>
					<TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder='Ej. Juan Pérez' placeholderTextColor={colors.primary} />

					<TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder='usuario@ejemplo.com' placeholderTextColor={colors.primary} keyboardType='email-address' autoCapitalize='none' />

					<TextInput style={styles.inputInner} value={password} onChangeText={setPassword} placeholder='Mínimo 8 caracteres' placeholderTextColor={colors.primary} secureTextEntry />

					{/* Deportes Favoritos */}
					<Text style={styles.inputLabel}>Deportes Favoritos</Text>
					<View style={styles.sportsContainer}>
						{sports.map((sport) => (
							<TouchableOpacity key={sport.id} onPress={() => toggleSport(sport.id)} style={[styles.sportChip, selectedSports.includes(sport.id) && styles.sportChipActive]}>
								<MaterialCommunityIcons
									name={sport.icon as any}
									size={18}
									color={
										selectedSports.includes(sport.id)
											? colors.backgroundDark // Icono oscuro si está seleccionado
											: colors.sports[sport.id as keyof typeof colors.sports] || colors.textPrimaryDark // Color del deporte si no
									}
								/>
								<Text style={[styles.sportChipText, selectedSports.includes(sport.id) && styles.sportChipTextActive]}>{sport.label}</Text>
							</TouchableOpacity>
						))}
					</View>

					{/* Nivel */}
					<Text style={styles.inputLabel}>Tu Nivel</Text>
					<View style={styles.levelSelector}>
						{levels.map((l) => (
							<TouchableOpacity key={l.value} onPress={() => setLevel(l.value)} style={[styles.levelOption, level === l.value && styles.levelOptionActive]}>
								<Text style={[styles.levelText, level === l.value && styles.levelTextActive]}>{l.label}</Text>
							</TouchableOpacity>
						))}
					</View>

					{/* Zona de Juego */}
					<TextInput style={styles.inputInner} value={zone} onChangeText={setZone} placeholder='Buscar ciudad o barrio' placeholderTextColor={colors.primary} />
				</View>

				{error && <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>}

				{/* Botón Acción */}
				<TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
					<Text style={styles.submitButtonText}>{loading ? 'Creando cuenta...' : 'Crear Cuenta'}</Text>
				</TouchableOpacity>

				<View style={styles.footerLinks}>
					<Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>
					<TouchableOpacity>
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
