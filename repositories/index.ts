/**
 * Repositorios — punto único de inyección de dependencias.
 *
 * Para cambiar de base de datos basta con reemplazar las implementaciones
 * de Supabase por las de la nueva tecnología (MySQL, Firebase, etc.) en este
 * archivo. El resto del código (servicios, hooks, contextos) no necesita cambios.
 */
import { SupabaseAuthRepository } from './supabase/SupabaseAuthRepository'
import { SupabaseJoinRequestRepository } from './supabase/SupabaseJoinRequestRepository'
import { SupabaseMatchParticipantRepository } from './supabase/SupabaseMatchParticipantRepository'
import { SupabaseMatchPlayerRepository } from './supabase/SupabaseMatchPlayerRepository'
import { SupabaseMatchRepository } from './supabase/SupabaseMatchRepository'
import { SupabaseNotificationRepository } from './supabase/SupabaseNotificationRepository'
import { SupabaseProfileRepository } from './supabase/SupabaseProfileRepository'
import { SupabasePushTokenRepository } from './supabase/SupabasePushTokenRepository'
import { SupabaseRatingRepository } from './supabase/SupabaseRatingRepository'
import { SupabaseStorageRepository } from './supabase/SupabaseStorageRepository'
import { SupabaseTeamRepository } from './supabase/SupabaseTeamRepository'

export const repositories = {
	auth: new SupabaseAuthRepository(),
	matches: new SupabaseMatchRepository(),
	profiles: new SupabaseProfileRepository(),
	notifications: new SupabaseNotificationRepository(),
	matchPlayers: new SupabaseMatchPlayerRepository(),
	matchParticipants: new SupabaseMatchParticipantRepository(),
	joinRequests: new SupabaseJoinRequestRepository(),
	storage: new SupabaseStorageRepository(),
	pushTokens: new SupabasePushTokenRepository(),
	ratings: new SupabaseRatingRepository(),
	teams: new SupabaseTeamRepository(),
}
