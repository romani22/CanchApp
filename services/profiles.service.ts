import { supabase } from '@/lib/supabase'

export const profilesService = {
	getById(userId: string) {
		return supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
	},

	updateProfile(userId: string, data: Partial<any>) {
		return supabase.from('profiles').update(data).eq('id', userId)
	},

	listBySport(sport: string) {
		return supabase.from('profiles').select('*').contains('favorite_sports', [sport])
	},
}
