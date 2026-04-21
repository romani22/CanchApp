import type { DevicePlatform } from '@/types/database.types'

export interface IPushTokenRepository {
	save(userId: string, token: string, platform: DevicePlatform, deviceName: string): Promise<void>
	remove(userId: string): Promise<void>
}
