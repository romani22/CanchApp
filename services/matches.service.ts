import { repositories } from '@/repositories'
import type { InsertMatch, Match, MatchListFilters, MatchUpdate, MatchWithCreator } from '@/types/database.types'
import { format } from 'date-fns'

export interface MatchCard {
	id: string
	title: string
	sport: string
	location: string
	dateTime: string
	spotsLeft: number
	level: string
	isMixed: boolean
}

const mapMatchToCard = (match: Match): MatchCard => ({
	id: match.id,
	title: match.title,
	sport: match.sport,
	location: match.venue_name,
	dateTime: format(new Date(match.starts_at), 'dd/MM/yyyy HH:mm'),
	spotsLeft: match.total_players - match.current_players,
	level: match.skill_level,
	isMixed: match.is_mixed,
})

// Re-export so existing consumers keep working
export type { ZoneListFilter, MatchListFilters } from '@/types/database.types'

export const matchesService = {
	async list(filters?: MatchListFilters) {
		return repositories.matches.list(filters)
	},

	async getById(matchId: string) {
		return repositories.matches.getById(matchId)
	},

	async getCreatedByUser(userId: string) {
		return repositories.matches.getCreatedByUser(userId)
	},

	async getJoined(userId: string) {
		return repositories.matches.getJoined(userId)
	},

	async getRecommendedMatches(limit = 5): Promise<MatchCard[]> {
		const data = await repositories.matches.getRecommended(limit)
		return data.map(mapMatchToCard)
	},

	async getNextMatchForUser(userId: string) {
		return repositories.matches.getNextForUser(userId)
	},

	async create(match: InsertMatch): Promise<Match> {
		return repositories.matches.create(match)
	},

	async update(matchId: string, data: MatchUpdate) {
		return repositories.matches.update(matchId, data)
	},

	async cancel(matchId: string): Promise<void> {
		return repositories.matches.cancel(matchId)
	},

	async remove(matchId: string) {
		return repositories.matches.remove(matchId)
	},
}
