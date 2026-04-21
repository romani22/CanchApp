export interface ITeamRepository {
	create(data: Record<string, unknown>): Promise<{ error: Error | null }>
	addMember(teamId: string, userId: string): Promise<{ error: Error | null }>
	listByTournament(tournamentId: string): Promise<{ data: unknown[] | null; error: Error | null }>
}
