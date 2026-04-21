import { repositories } from '@/repositories'

export const teamsService = {
	create(data: Record<string, unknown>) {
		return repositories.teams.create(data)
	},

	addMember(teamId: string, userId: string) {
		return repositories.teams.addMember(teamId, userId)
	},

	listByTournament(tournamentId: string) {
		return repositories.teams.listByTournament(tournamentId)
	},
}
