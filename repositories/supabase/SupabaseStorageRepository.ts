import { supabase } from '@/lib/supabase'
import type { IStorageRepository } from '../interfaces/IStorageRepository'

const BUCKET = 'avatars'

export class SupabaseStorageRepository implements IStorageRepository {
	async upload(path: string, data: ArrayBuffer, contentType: string): Promise<string> {
		const { error } = await supabase.storage.from(BUCKET).upload(path, data, { contentType, upsert: true })
		if (error) throw error

		const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
		return `${urlData.publicUrl}?t=${Date.now()}`
	}

	async delete(paths: string[]): Promise<void> {
		await supabase.storage.from(BUCKET).remove(paths)
	}

	getPublicUrl(path: string): string {
		const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
		return data.publicUrl
	}
}
