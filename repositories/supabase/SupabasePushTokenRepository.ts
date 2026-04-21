import { supabase } from '@/lib/supabase'
import type { DevicePlatform } from '@/types/database.types'
import type { IPushTokenRepository } from '../interfaces/IPushTokenRepository'

export class SupabasePushTokenRepository implements IPushTokenRepository {
	async save(userId: string, token: string, platform: DevicePlatform, deviceName: string): Promise<void> {
		// Desactivar tokens antiguos del mismo dispositivo
		await supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId).eq('device_name', deviceName)

		// Insertar o actualizar el token actual
		const { error } = await supabase
			.from('push_tokens')
			.upsert(
				{ user_id: userId, token, platform, device_name: deviceName, is_active: true, last_used_at: new Date().toISOString() },
				{ onConflict: 'user_id,token' },
			)
			.select()
		if (error) throw error

		// También actualizar el campo legacy push_token en profiles
		await supabase.from('profiles').update({ push_token: token }).eq('id', userId)
	}

	async remove(userId: string): Promise<void> {
		await supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId)
		await supabase.from('profiles').update({ push_token: null }).eq('id', userId)
	}
}
