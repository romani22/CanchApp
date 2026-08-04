export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SportType = 'futbol' | 'padel' | 'tenis' | 'basquet' | 'voley'
export type TeamMode = 'none' | 'two_teams'
export type TeamSlot = 'A' | 'B'
export type SkillLevel = 'principiante' | 'intermedio' | 'avanzado'
/**
 * Mapa deporte -> nivel. Las claves son los deportes que juega el usuario:
 * reemplazan a la vieja columna favorite_sports, que era una segunda fuente
 * de verdad para la misma información.
 */
export type SportLevels = Partial<Record<SportType, SkillLevel>>
export type MatchStatus = 'open' | 'full' | 'completed' | 'cancelled'
export type RequestStatus = 'pending' | 'accepted' | 'rejected'
export type NotificationType = 'new_match' | 'join_request' | 'request_accepted' | 'request_rejected' | 'match_reminder' | 'match_cancelled' | 'player_joined' | 'match_result'
/** Resultado de un jugador en un partido (021_match_results.sql). */
export type MatchOutcome = 'win' | 'loss' | 'draw'
/** Un set, con la misma orientación que score_a / score_b del resultado. */
export type MatchSetScore = { a: number; b: number }
export type DevicePlatform = 'ios' | 'android' | 'web'

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string
					email: string
					full_name: string
					avatar_url: string | null
					phone: string | null
					bio: string | null
					sport_levels: SportLevels
					zone: string | null
					zone_coordinates: { x: number; y: number } | null
					total_matches: number
					total_wins: number
					rating: number
					rating_count: number
					// Agregada en 003_level_up_db.sql. Faltaba en el tipo, pero varios
					// select() la piden y el modal de participante la muestra.
					elo_rating: number
					push_token: string | null
					notifications_enabled: boolean
					notification_radius: number
					notify_new_matches: boolean
					notify_join_requests: boolean
					notify_request_response: boolean
					notify_player_joined: boolean
					notify_match_reminder: boolean
					onboarding_completed: boolean
					created_at: string
					updated_at: string
				}
				Insert: {
					id: string
					email: string
					full_name: string
					avatar_url?: string | null
					phone?: string | null
					bio?: string | null
					sport_levels?: SportLevels
					zone?: string | null
					zone_coordinates?: { x: number; y: number } | null
					total_matches?: number
					total_wins?: number
					rating?: number
					rating_count?: number
					elo_rating?: number
					push_token?: string | null
					notifications_enabled?: boolean
					notification_radius?: number
					notify_new_matches?: boolean
					notify_join_requests?: boolean
					notify_request_response?: boolean
					notify_player_joined?: boolean
					notify_match_reminder?: boolean
					onboarding_completed?: boolean
					created_at?: string
					updated_at?: string
				}
				Update: {
					id?: string
					email?: string
					full_name?: string
					avatar_url?: string | null
					phone?: string | null
					bio?: string | null
					sport_levels?: SportLevels
					zone?: string | null
					zone_coordinates?: { x: number; y: number } | null
					total_matches?: number
					total_wins?: number
					rating?: number
					rating_count?: number
					elo_rating?: number
					push_token?: string | null
					notifications_enabled?: boolean
					notification_radius?: number
					notify_new_matches?: boolean
					notify_join_requests?: boolean
					notify_request_response?: boolean
					notify_player_joined?: boolean
					notify_match_reminder?: boolean
					onboarding_completed?: boolean
					updated_at?: string
				}
			}
			matches: {
				Row: {
					id: string
					creator_id: string
					sport: SportType
					title: string
					description: string | null
					starts_at: string
					end_time: string | null
					venue_name: string
					venue_address: string | null
					venue_coordinates: { x: number; y: number } | null
					venue_zone: string | null
					total_players: number
					players_needed: number
					current_players: number
					skill_level: SkillLevel
					is_mixed: boolean
					team_mode: TeamMode
					status: MatchStatus
					amenities: string[]
					// winner_id: 003_level_up_db.sql. Lo usa la vista user_stats para
					// contar victorias y hay selects que lo traen; faltaba en el tipo.
					winner_id: string | null
					// Campos de torneo (001_initial_schema.sql). El feature está sin
					// implementar, pero las columnas existen.
					tournament_id: string | null
					round: number | null
					home_team_id: string | null
					away_team_id: string | null
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					creator_id: string
					sport: SportType
					title: string
					description?: string | null
					starts_at: string
					end_time?: string | null
					venue_name: string
					venue_address?: string | null
					venue_coordinates?: { x: number; y: number } | null
					venue_zone?: string | null
					total_players: number
					players_needed: number
					current_players?: number
					skill_level?: SkillLevel
					is_mixed?: boolean
					team_mode?: TeamMode
					status?: MatchStatus
					amenities?: string[]
					winner_id?: string | null
					tournament_id?: string | null
					round?: number | null
					home_team_id?: string | null
					away_team_id?: string | null
					created_at?: string
					updated_at?: string
				}
				Update: {
					creator_id?: string
					sport?: SportType
					title?: string
					description?: string | null
					starts_at?: string
					end_time?: string | null
					venue_name?: string
					venue_address?: string | null
					venue_coordinates?: { x: number; y: number } | null
					venue_zone?: string | null
					total_players?: number
					players_needed?: number
					current_players?: number
					skill_level?: SkillLevel
					is_mixed?: boolean
					team_mode?: TeamMode
					status?: MatchStatus
					amenities?: string[]
					winner_id?: string | null
					tournament_id?: string | null
					round?: number | null
					home_team_id?: string | null
					away_team_id?: string | null
					updated_at?: string
				}
			}
			match_participants: {
				Row: {
					id: string
					// 004_change_user_participans.sql volvió user_id nullable y agregó
					// guest_name, con un CHECK de exclusión mutua: o hay usuario
					// registrado, o hay nombre de invitado. Nunca ambos ni ninguno.
					user_id: string | null
					guest_name: string | null
					match_id: string
					joined_at: string
					is_creator: boolean
					team_slot: TeamSlot | null
				}
				Insert: {
					id?: string
					user_id?: string | null
					guest_name?: string | null
					match_id: string
					joined_at?: string
					is_creator?: boolean
					team_slot?: TeamSlot | null
				}
				Update: {
					user_id?: string | null
					guest_name?: string | null
					match_id?: string
					joined_at?: string
					is_creator?: boolean
					team_slot?: TeamSlot | null
				}
			}
			join_requests: {
				Row: {
					id: string
					match_id: string
					user_id: string
					status: RequestStatus
					message: string | null
					// 022: equipo que pidió el jugador. Al aceptarlo entra con ese equipo,
					// en vez de quedar sin asignar. null si el partido no usa equipos.
					team_slot: TeamSlot | null
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					match_id: string
					user_id: string
					status?: RequestStatus
					message?: string | null
					team_slot?: TeamSlot | null
					created_at?: string
					updated_at?: string
				}
				Update: {
					match_id?: string
					user_id?: string
					status?: RequestStatus
					message?: string | null
					team_slot?: TeamSlot | null
					updated_at?: string
				}
			}
			notifications: {
				Row: {
					id: string
					user_id: string
					type: NotificationType
					title: string
					body: string
					data: Json
					is_read: boolean
					created_at: string
				}
				Insert: {
					id?: string
					user_id: string
					type: NotificationType
					title: string
					body: string
					data?: Json
					is_read?: boolean
					created_at?: string
				}
				Update: {
					user_id?: string
					type?: NotificationType
					match_id?: string
					title?: string
					body?: string
					data?: Json
					is_read?: boolean
				}
			}
			match_ratings: {
				Row: {
					id: string
					match_id: string
					rater_id: string
					rated_user_id: string
					rating: number
					comment: string | null
					created_at: string
				}
				Insert: {
					id?: string
					match_id: string
					rater_id: string
					rated_user_id: string
					rating: number
					comment?: string | null
					created_at?: string
				}
				Update: {
					match_id?: string
					rater_id?: string
					rated_user_id?: string
					rating?: number
					comment?: string | null
				}
			}
			match_players: {
				Row: {
					id: string
					match_id: string
					added_by_user_id: string
					user_id: string | null
					player_name: string
					team_slot: TeamSlot | null
					created_at: string
				}
				Insert: {
					id?: string
					match_id: string
					added_by_user_id: string
					user_id?: string | null
					player_name: string
					team_slot?: TeamSlot | null
					created_at?: string
				}
				Update: {
					match_id?: string
					added_by_user_id?: string
					user_id?: string | null
					player_name?: string
					team_slot?: TeamSlot | null
				}
			}
			// 021_match_results.sql. Marcador del partido; el detalle por jugador va
			// en match_player_stats. Reemplaza a match_scores, que nunca se usó.
			match_results: {
				Row: {
					id: string
					match_id: string
					// score_a es el Equipo A si el partido usa equipos; si no, el lado
					// ganador (en un empate los dos números son iguales). NULL cuando el
					// deporte se cuenta por sets o sólo se cargó quién ganó.
					score_a: number | null
					score_b: number | null
					sets: MatchSetScore[]
					notes: string | null
					reported_by: string | null
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					match_id: string
					score_a?: number | null
					score_b?: number | null
					sets?: MatchSetScore[]
					notes?: string | null
					reported_by?: string | null
					created_at?: string
					updated_at?: string
				}
				Update: {
					score_a?: number | null
					score_b?: number | null
					sets?: MatchSetScore[]
					notes?: string | null
					updated_at?: string
				}
			}
			match_player_stats: {
				Row: {
					id: string
					match_id: string
					// null en las filas de invitados: se cargan igual, pero no alimentan
					// ningún perfil.
					user_id: string | null
					display_name: string
					outcome: MatchOutcome
					// null significa "no se cargó", distinto de un 0 real: los promedios
					// del perfil sólo dividen por los partidos donde la métrica existe.
					goals: number | null
					assists: number | null
					saves: number | null
					points: number | null
					extra: Json
					created_at: string
				}
				Insert: {
					id?: string
					match_id: string
					user_id?: string | null
					display_name: string
					outcome: MatchOutcome
					goals?: number | null
					assists?: number | null
					saves?: number | null
					points?: number | null
					extra?: Json
					created_at?: string
				}
				Update: {
					outcome?: MatchOutcome
					goals?: number | null
					assists?: number | null
					saves?: number | null
					points?: number | null
					extra?: Json
				}
			}
			push_tokens: {
				Row: {
					id: string
					user_id: string
					token: string
					platform: DevicePlatform
					device_name: string | null
					is_active: boolean
					created_at: string
					last_used_at: string
				}
				Insert: {
					id?: string
					user_id: string
					token: string
					platform: DevicePlatform
					device_name?: string | null
					is_active?: boolean
					created_at?: string
					last_used_at?: string
				}
				Update: {
					user_id?: string
					token?: string
					platform?: DevicePlatform
					device_name?: string | null
					is_active?: boolean
					last_used_at?: string
				}
			}
		}
		Views: {
			// Totales del usuario sumando todos los deportes (021_match_results.sql).
			user_stats: { Row: UserTotals }
			// Los mismos números, pero abiertos por deporte: es lo que consumen las
			// cards del perfil y el modal de participante.
			user_sport_stats: { Row: SportStats }
		}
		// Record<string, never> en vez de {}: el tipo {} acepta cualquier valor no
		// nulo (0, '', etc.), no "objeto vacío".
		Functions: Record<string, never>
		Enums: {
			sport_type: SportType
			skill_level: SkillLevel
			match_status: MatchStatus
			request_status: RequestStatus
			notification_type: NotificationType
			match_outcome: MatchOutcome
		}
	}
}

/* ============================
   ESTADÍSTICAS (vistas de 021_match_results.sql)
============================ */

/** Vista user_stats: totales del usuario sumando todos los deportes. */
export interface UserTotals {
	user_id: string
	total_matches: number
	total_wins: number
	total_losses: number
	total_draws: number
	elo_rating: number
	rating: number
	rating_count: number
}

/**
 * Vista user_sport_stats: una fila por usuario y deporte. Sólo cuenta partidos
 * finalizados con resultado cargado, así que un usuario sin partidos jugados en
 * ese deporte simplemente no tiene fila.
 */
export interface SportStats {
	user_id: string
	sport: SportType
	matches_played: number
	wins: number
	losses: number
	draws: number
	win_rate: number
	/**
	 * Totales de métricas individuales. null cuando no se cargó ninguna: el
	 * promedio correspondiente también es null, y la UI no muestra la card en vez
	 * de mostrar un 0 que parecería un dato real.
	 */
	goals: number | null
	assists: number | null
	saves: number | null
	points: number | null
	goals_per_match: number | null
	assists_per_match: number | null
	saves_per_match: number | null
	points_per_match: number | null
	/** Partidos en los que la métrica sí se cargó (denominador de los promedios). */
	matches_with_goals: number
	matches_with_assists: number
	matches_with_saves: number
	matches_with_points: number
}

// Utility types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type MatchParticipant = Database['public']['Tables']['match_participants']['Row']
export type MatchPlayer = Database['public']['Tables']['match_players']['Row']
export type JoinRequest = Database['public']['Tables']['join_requests']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type MatchRating = Database['public']['Tables']['match_ratings']['Row']
export type PushToken = Database['public']['Tables']['push_tokens']['Row']
export type MatchResult = Database['public']['Tables']['match_results']['Row']
export type MatchPlayerStat = Database['public']['Tables']['match_player_stats']['Row']
export type InsertMatch = Database['public']['Tables']['matches']['Insert']
export type MatchUpdate = Database['public']['Tables']['matches']['Update']
export type Guest = { id: string; name: string }

// Extended types with relations
export type MatchWithCreator = Match & {
	creator: Profile
	// user es null para los invitados (participantes sin cuenta): en esas filas el
	// nombre viene en guest_name. El tipo lo declaraba siempre presente.
	participants: (MatchParticipant & { user: Profile | null })[]
	players: (MatchPlayer & { user?: Profile; added_by: Profile })[]
}

export type MatchResultWithPlayers = MatchResult & {
	players: MatchPlayerStat[]
}

/** Una fila del formulario de resultado, tal como la recibe save_match_result. */
export type MatchPlayerStatInput = {
	/** null para los invitados: la fila se identifica por display_name. */
	user_id: string | null
	display_name: string
	outcome: MatchOutcome
	goals?: number | null
	assists?: number | null
	saves?: number | null
	points?: number | null
	extra?: Record<string, unknown>
}

export type MatchResultInput = {
	score_a?: number | null
	score_b?: number | null
	sets?: MatchSetScore[]
	notes?: string | null
	players: MatchPlayerStatInput[]
}

export type JoinRequestWithUser = JoinRequest & {
	user: Profile
	match: Match
}

export type NotificationWithData = Notification & {
	match?: Match
	user?: Profile
}

export type MatchPlayerWithUser = MatchPlayer & {
	user?: Profile
	added_by: Profile
}

// Notification preferences
export type NotificationSettings = {
	notifications_enabled: boolean
	notification_radius: number
	notify_new_matches: boolean
	notify_join_requests: boolean
	notify_request_response: boolean
	notify_player_joined: boolean
	notify_match_reminder: boolean
}

// Match listing filter types
export type ZoneListFilter = { type: 'coordinates'; lng: number; lat: number; radiusKm: number } | { type: 'name'; zoneName: string }

export interface MatchListFilters {
	sport?: SportType
	zone?: ZoneListFilter
}
