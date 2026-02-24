export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SportType = 'futbol' | 'padel' | 'tenis' | 'basquet' | 'voley'
export type SkillLevel = 'principiante' | 'intermedio' | 'avanzado'
export type MatchStatus = 'open' | 'full' | 'completed' | 'cancelled'
export type RequestStatus = 'pending' | 'accepted' | 'rejected'
export type NotificationType = 'new_match' | 'join_request' | 'request_accepted' | 'request_rejected' | 'match_reminder' | 'match_cancelled'

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
					favorite_sports: SportType[]
					skill_level: SkillLevel
					zone: string | null
					zone_coordinates: { x: number; y: number } | null
					total_matches: number
					total_wins: number
					rating: number
					rating_count: number
					push_token: string | null
					notifications_enabled: boolean
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
					favorite_sports?: SportType[]
					skill_level?: SkillLevel
					zone?: string | null
					zone_coordinates?: { x: number; y: number } | null
					total_matches?: number
					total_wins?: number
					rating?: number
					rating_count?: number
					push_token?: string | null
					notifications_enabled?: boolean
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
					favorite_sports?: SportType[]
					skill_level?: SkillLevel
					zone?: string | null
					zone_coordinates?: { x: number; y: number } | null
					total_matches?: number
					total_wins?: number
					rating?: number
					rating_count?: number
					push_token?: string | null
					notifications_enabled?: boolean
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
					date: string
					start_time: string
					end_time: string | null
					venue_name: string
					venue_address: string | null
					venue_coordinates: { x: number; y: number } | null
					total_players: number
					players_needed: number
					current_players: number
					skill_level: SkillLevel
					is_mixed: boolean
					status: MatchStatus
					amenities: string[]
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					creator_id: string
					sport: SportType
					title: string
					description?: string | null
					date: string
					start_time: string
					end_time?: string | null
					venue_name: string
					venue_address?: string | null
					venue_coordinates?: { x: number; y: number } | null
					total_players: number
					players_needed: number
					current_players?: number
					skill_level?: SkillLevel
					is_mixed?: boolean
					status?: MatchStatus
					amenities?: string[]
					created_at?: string
					updated_at?: string
				}
				Update: {
					creator_id?: string
					sport?: SportType
					title?: string
					description?: string | null
					date?: string
					start_time?: string
					end_time?: string | null
					venue_name?: string
					venue_address?: string | null
					venue_coordinates?: { x: number; y: number } | null
					total_players?: number
					players_needed?: number
					current_players?: number
					skill_level?: SkillLevel
					is_mixed?: boolean
					status?: MatchStatus
					amenities?: string[]
					updated_at?: string
				}
			}
			match_participants: {
				Row: {
					id: string
					match_id: string
					user_id: string
					joined_at: string
					is_creator: boolean
				}
				Insert: {
					id?: string
					match_id: string
					user_id: string
					joined_at?: string
					is_creator?: boolean
				}
				Update: {
					match_id?: string
					user_id?: string
					joined_at?: string
					is_creator?: boolean
				}
			}
			join_requests: {
				Row: {
					id: string
					match_id: string
					user_id: string
					status: RequestStatus
					message: string | null
					created_at: string
					updated_at: string
				}
				Insert: {
					id?: string
					match_id: string
					user_id: string
					status?: RequestStatus
					message?: string | null
					created_at?: string
					updated_at?: string
				}
				Update: {
					match_id?: string
					user_id?: string
					status?: RequestStatus
					message?: string | null
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
		}
		Views: {}
		Functions: {}
		Enums: {
			sport_type: SportType
			skill_level: SkillLevel
			match_status: MatchStatus
			request_status: RequestStatus
			notification_type: NotificationType
		}
	}
}

// Utility types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type MatchParticipant = Database['public']['Tables']['match_participants']['Row']
export type JoinRequest = Database['public']['Tables']['join_requests']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type MatchRating = Database['public']['Tables']['match_ratings']['Row']
export type InsertMatch = Database['public']['Tables']['matches']['Insert']
// Extended types with relations
export type MatchWithCreator = Match & {
	creator: Profile
	participants: (MatchParticipant & { user: Profile })[]
}

export type JoinRequestWithUser = JoinRequest & {
	user: Profile
	match: Match
}

export type NotificationWithData = Notification & {
	match?: Match
	user?: Profile
}
