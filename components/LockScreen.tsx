import { useAppLock } from '@/context/AppLockContext'
import { useAuth } from '@/context/AuthContext'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Pantalla de bloqueo por inactividad (ver AppLockContext).
 *
 * No es un login: la sesión sigue abierta detrás. Sólo pide confirmar identidad
 * con el desbloqueo del teléfono.
 */
export function LockScreen() {
	const { unlock } = useAppLock()
	const { signOut, profile } = useAuth()
	const [authenticating, setAuthenticating] = useState(false)
	// El prompt automático va una sola vez: si el usuario lo cancela, queda el
	// botón. Reintentar solo sería una pelea de diálogos.
	const promptedRef = useRef(false)

	const handleUnlock = async () => {
		if (authenticating) return
		setAuthenticating(true)
		try {
			await unlock()
		} finally {
			setAuthenticating(false)
		}
	}

	useEffect(() => {
		if (promptedRef.current) return
		promptedRef.current = true
		void handleUnlock()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleSignOut = () => {
		Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
			{ text: 'Cancelar', style: 'cancel' },
			{ text: 'Cerrar Sesión', style: 'destructive', onPress: () => void signOut() },
		])
	}

	const firstName = profile?.full_name?.split(' ')[0]

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<View style={styles.iconCircle}>
					<Ionicons name='lock-closed' size={38} color={colors.primary} />
				</View>

				<Text style={styles.title}>{firstName ? `Hola de nuevo, ${firstName}` : 'Sesión bloqueada'}</Text>
				<Text style={styles.subtitle}>Pasaron más de 15 minutos sin actividad. Desbloqueá con tu huella, cara o PIN para seguir donde estabas.</Text>

				<TouchableOpacity style={[styles.unlockButton, authenticating && styles.unlockButtonDisabled]} onPress={handleUnlock} disabled={authenticating}>
					{authenticating ? (
						<ActivityIndicator color={colors.backgroundDark} />
					) : (
						<>
							<Ionicons name='finger-print' size={20} color={colors.backgroundDark} />
							<Text style={styles.unlockButtonText}>Desbloquear</Text>
						</>
					)}
				</TouchableOpacity>

				<TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
					<Text style={styles.signOutText}>Cerrar sesión</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.backgroundDark,
	},
	content: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
		gap: 14,
	},
	iconCircle: {
		width: 84,
		height: 84,
		borderRadius: 42,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: `${colors.primary}18`,
		borderWidth: 1,
		borderColor: `${colors.primary}40`,
		marginBottom: 6,
	},
	title: {
		color: colors.textPrimaryDark,
		fontSize: 22,
		fontWeight: '700',
		textAlign: 'center',
	},
	subtitle: {
		color: colors.textSecondaryDark,
		fontSize: 14,
		lineHeight: 20,
		textAlign: 'center',
		marginBottom: 10,
	},
	unlockButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		alignSelf: 'stretch',
		backgroundColor: colors.primary,
		borderRadius: 14,
		paddingVertical: 15,
	},
	unlockButtonDisabled: {
		opacity: 0.6,
	},
	unlockButtonText: {
		color: colors.backgroundDark,
		fontSize: 16,
		fontWeight: '700',
	},
	signOutButton: {
		paddingVertical: 10,
	},
	signOutText: {
		color: colors.textSecondaryDark,
		fontSize: 14,
		fontWeight: '500',
	},
})
