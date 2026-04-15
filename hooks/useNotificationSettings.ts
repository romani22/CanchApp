import { useAuth } from '@/context/AuthContext'
import { notificationsService } from '@/services/notifications.service'
import { NotificationSettings } from '@/types/database.types'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 600

/**
 * Manages notification preference state with auto-save (debounced).
 * Initializes from the profile already in AuthContext to avoid an extra
 * network request on mount; falls back to a direct fetch if the profile
 * hasn't loaded yet.
 */
export function useNotificationSettings() {
	const { user, profile } = useAuth()

	const [settings, setSettings] = useState<NotificationSettings | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	const pendingRef = useRef<NotificationSettings | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const initializedRef = useRef(false)

	// Single effect keyed only on user id.
	// Using profile as a snapshot at call time (not as a dep) avoids a race
	// where the reset path of this same effect would undo the init path.
	useEffect(() => {
		if (!user?.id) {
			// User logged out — reset
			initializedRef.current = false
			setSettings(null)
			setLoading(true)
			setSaveError(null)
			return
		}

		if (initializedRef.current) return

		// Snapshot profile from closure — not a reactive dependency
		const currentProfile = profile

		if (currentProfile) {
			setSettings({
				notifications_enabled: currentProfile.notifications_enabled,
				notification_radius: currentProfile.notification_radius,
				notify_new_matches: currentProfile.notify_new_matches,
				notify_join_requests: currentProfile.notify_join_requests,
				notify_request_response: currentProfile.notify_request_response,
				notify_player_joined: currentProfile.notify_player_joined,
				notify_match_reminder: currentProfile.notify_match_reminder,
			})
			setLoading(false)
			initializedRef.current = true
		} else {
			// Profile not yet in context — fetch directly
			notificationsService
				.getSettings(user.id)
				.then((data) => {
					setSettings(data)
					initializedRef.current = true
				})
				.catch(() => setSaveError('No se pudieron cargar las preferencias'))
				.finally(() => setLoading(false))
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id])

	const persist = useCallback(
		async (next: NotificationSettings) => {
			if (!user?.id) return
			try {
				setSaving(true)
				setSaveError(null)
				await notificationsService.updateSettings(user.id, next)
			} catch {
				setSaveError('No se pudieron guardar los cambios')
			} finally {
				setSaving(false)
			}
		},
		[user?.id],
	)

	/**
	 * Update a single setting key. The change is reflected immediately
	 * in local state (optimistic) and persisted after a short debounce.
	 */
	const updateSetting = useCallback(
		<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
			setSettings((prev) => {
				if (!prev) return prev
				const next = { ...prev, [key]: value }
				pendingRef.current = next

				if (timerRef.current) clearTimeout(timerRef.current)
				timerRef.current = setTimeout(() => {
					if (pendingRef.current) {
						persist(pendingRef.current)
						pendingRef.current = null
					}
				}, DEBOUNCE_MS)

				return next
			})
		},
		[persist],
	)

	// Flush any pending save immediately (useful on back navigation)
	const flush = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current)
		if (pendingRef.current) {
			persist(pendingRef.current)
			pendingRef.current = null
		}
	}, [persist])

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current)
		}
	}, [])

	return { settings, loading, saving, saveError, updateSetting, flush }
}
