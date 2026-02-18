// import { supabase } from '@/lib/supabase'
// import { makeRedirectUri } from 'expo-auth-session'
// import * as Google from 'expo-auth-session/providers/google'
// import * as WebBrowser from 'expo-web-browser'

// WebBrowser.maybeCompleteAuthSession()

// /**
//  * Hook para login con Google usando Expo + Supabase
//  */
// export const useGoogleAuth = () => {
// 	const redirectTo = makeRedirectUri({
// 		scheme: 'canchapp',
// 	})

// 	const [request, response, promptAsync] = Google.useAuthRequest({
// 		clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
// 	})

// 	const signInWithGoogle = async () => {
// 		const result = await promptAsync()

// 		if (result.type !== 'success') {
// 			throw new Error('Login cancelado')
// 		}

// 		const idToken = result.params?.id_token

// 		if (!idToken) {
// 			throw new Error('No se recibió id_token desde Google')
// 		}

// 		const { data, error } = await supabase.auth.signInWithIdToken({
// 			provider: 'google',
// 			token: idToken,
// 		})

// 		if (error) {
// 			throw error
// 		}

// 		return data
// 	}

// 	return {
// 		signInWithGoogle,
// 		request,
// 	}
// }

// /**
//  * Validar formato de email
//  */
// export const validateEmail = (email: string): boolean => {
// 	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 	return emailRegex.test(email)
// }

// /**
//  * Validar contraseña
//  */
// export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
// 	const errors: string[] = []

// 	if (password.length < 8) {
// 		errors.push('La contraseña debe tener al menos 8 caracteres')
// 	}
// 	if (!/[A-Z]/.test(password)) {
// 		errors.push('Debe incluir al menos una letra mayúscula')
// 	}
// 	if (!/[a-z]/.test(password)) {
// 		errors.push('Debe incluir al menos una letra minúscula')
// 	}
// 	if (!/[0-9]/.test(password)) {
// 		errors.push('Debe incluir al menos un número')
// 	}

// 	return {
// 		isValid: errors.length === 0,
// 		errors,
// 	}
// }

// /**
//  * Checkear si un usuario existe en Supabase
//  * (workaround recomendado por Supabase)
//  */
// export const checkUserExists = async (email: string): Promise<boolean> => {
// 	const { error } = await supabase.auth.signInWithOtp({
// 		email,
// 		options: {
// 			shouldCreateUser: false,
// 		},
// 	})

// 	return !error
// }

// export const redirectTo = makeRedirectUri({
// 	scheme: 'canchapp',
// })

// export const authService = {
// 	signInWithEmail(email: string, password: string) {
// 		return supabase.auth.signInWithPassword({ email, password })
// 	},

// 	signUp(email: string, password: string, fullName?: string) {
// 		return supabase.auth.signUp({
// 			email,
// 			password,
// 			options: {
// 				emailRedirectTo: redirectTo,
// 				data: {
// 					full_name: fullName,
// 				},
// 			},
// 		})
// 	},

// 	signOut() {
// 		return supabase.auth.signOut()
// 	},

// 	getSession() {
// 		return supabase.auth.getSession()
// 	},

// 	onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
// 		return supabase.auth.onAuthStateChange(callback)
// 	},
// }
