import Loader from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { Redirect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'

WebBrowser.maybeCompleteAuthSession()

export default function AuthCallback() {
	const { isAuthenticated, isLoading } = useAuth()
	// Esperar un momento antes de redirigir para que la sesión se establezca
	const [ready, setReady] = useState(false)

	useEffect(() => {
		const timer = setTimeout(() => setReady(true), 1500)
		return () => clearTimeout(timer)
	}, [])

	if (isLoading || !ready) {
		return <Loader title='Iniciando sesión...' />
	}

	if (isAuthenticated) {
		return <Redirect href='/(protected)/(tabs)/Dashboard' />
	}

	return <Redirect href='/(auth)/Login' />
}
