import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import 'react-native-url-polyfill/auto'

// Custom storage adapter using expo-secure-store
const ExpoSecureStoreAdapter = {
	getItem: async (key: string): Promise<string | null> => {
		try {
			return await SecureStore.getItemAsync(key)
		} catch (error) {
			console.error('SecureStore getItem error:', error)
			return null
		}
	},
	setItem: async (key: string, value: string): Promise<void> => {
		try {
			await SecureStore.setItemAsync(key, value)
		} catch (error) {
			console.error('SecureStore setItem error:', error)
		}
	},
	removeItem: async (key: string): Promise<void> => {
		try {
			await SecureStore.deleteItemAsync(key)
		} catch (error) {
			console.error('SecureStore removeItem error:', error)
		}
	},
}

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_KEY!, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
})

// Helper to get current user
export const getCurrentUser = async () => {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser()
	if (error) throw error
	return user
}

// Helper to get current session
export const getCurrentSession = async () => {
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession()
	if (error) throw error
	return session
}
