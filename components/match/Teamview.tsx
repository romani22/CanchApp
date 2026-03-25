import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type ParticipantRow = {
	id: string
	user_id: string | null
	guest_name: string | null
	team_slot: TeamSlot | null
	user: {
		id: string
		full_name: string
		avatar_url: string | null
		skill_level?: string
	} | null
}

interface Props {
	participants: ParticipantRow[]
	totalPlayers: number
	currentUserId?: string
	isCreator: boolean
	/** Si true, el usuario puede mover jugadores entre equipos */
	canManage: boolean
	/** Mostrar botones para que el usuario actual elija equipo */
	showJoinTeam?: boolean
	onJoinTeam?: (slot: TeamSlot) => void
	onMovePlayer?: (participantId: string, toSlot: TeamSlot) => void
}

const TEAM_CONFIG = {
	A: { label: 'Equipo A', color: colors.info, bg: `${colors.info}18`, border: `${colors.info}40` },
	B: { label: 'Equipo B', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
} as const

const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4']
const getColor = (name?: string | null) => avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length]

function PlayerRow({ p, isCreator, canManage, currentUserId, onMove }: { p: ParticipantRow; isCreator: boolean; canManage: boolean; currentUserId?: string; onMove?: (toSlot: TeamSlot) => void }) {
	const name = p.user?.full_name ?? p.guest_name ?? 'Invitado'
	const isMe = p.user_id === currentUserId
	const otherSlot: TeamSlot = p.team_slot === 'A' ? 'B' : 'A'
	const teamCfg = TEAM_CONFIG[p.team_slot ?? 'A']

	return (
		<View style={localStyles.playerRow}>
			{p.user?.avatar_url ? (
				<Image source={{ uri: p.user.avatar_url }} style={localStyles.avatar} />
			) : (
				<View style={[localStyles.avatar, { backgroundColor: getColor(name) }]}>
					<Text style={localStyles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
				</View>
			)}
			<View style={{ flex: 1 }}>
				<Text style={localStyles.playerName} numberOfLines={1}>
					{name}
					{isMe && <Text style={{ color: colors.primary }}> (vos)</Text>}
				</Text>
				{!p.user_id && <Text style={localStyles.guestBadge}>Invitado</Text>}
			</View>
			{canManage && p.user_id && onMove && (
				<TouchableOpacity style={[localStyles.moveBtn, { borderColor: TEAM_CONFIG[otherSlot].color }]} onPress={() => onMove(otherSlot)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
					<Ionicons name='swap-horizontal' size={14} color={TEAM_CONFIG[otherSlot].color} />
					<Text style={[localStyles.moveBtnText, { color: TEAM_CONFIG[otherSlot].color }]}>{TEAM_CONFIG[otherSlot].label}</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}

function TeamColumn({ slot, participants, totalSlots, isCreator, canManage, currentUserId, onMove }: { slot: TeamSlot; participants: ParticipantRow[]; totalSlots: number; isCreator: boolean; canManage: boolean; currentUserId?: string; onMove?: (participantId: string, toSlot: TeamSlot) => void }) {
	const cfg = TEAM_CONFIG[slot]
	const empty = Math.max(0, totalSlots - participants.length)

	return (
		<View style={[localStyles.teamCol, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
			<View style={localStyles.teamHeader}>
				<View style={[localStyles.teamDot, { backgroundColor: cfg.color }]} />
				<Text style={[localStyles.teamTitle, { color: cfg.color }]}>{cfg.label}</Text>
				<Text style={[localStyles.teamCount, { color: cfg.color }]}>
					{participants.length}/{totalSlots}
				</Text>
			</View>

			{participants.map((p) => (
				<PlayerRow key={p.id} p={p} isCreator={isCreator} canManage={canManage} currentUserId={currentUserId} onMove={onMove ? (toSlot) => onMove(p.id, toSlot) : undefined} />
			))}

			{Array.from({ length: empty }, (_, i) => (
				<View key={`empty-${i}`} style={localStyles.emptySlot}>
					<Ionicons name='person-add-outline' size={14} color={cfg.color} style={{ opacity: 0.4 }} />
					<Text style={[localStyles.emptyText, { color: cfg.color }]}>Lugar libre</Text>
				</View>
			))}
		</View>
	)
}

export function TeamView({ participants, totalPlayers, currentUserId, isCreator, canManage, showJoinTeam, onJoinTeam, onMovePlayer }: Props) {
	const perTeam = Math.floor(totalPlayers / 2)
	const teamA = participants.filter((p) => p.team_slot === 'A')
	const teamB = participants.filter((p) => p.team_slot === 'B')
	const unassigned = participants.filter((p) => !p.team_slot)

	return (
		<View>
			{/* Columnas de equipos */}
			<View style={localStyles.teamsRow}>
				<TeamColumn slot='A' participants={teamA} totalSlots={perTeam} isCreator={isCreator} canManage={canManage} currentUserId={currentUserId} onMove={onMovePlayer} />
				<TeamColumn slot='B' participants={teamB} totalSlots={perTeam} isCreator={isCreator} canManage={canManage} currentUserId={currentUserId} onMove={onMovePlayer} />
			</View>

			{/* Jugadores sin equipo asignado (si los hay) */}
			{unassigned.length > 0 && (
				<View style={localStyles.unassignedSection}>
					<Text style={localStyles.unassignedTitle}>Sin equipo</Text>
					{unassigned.map((p) => (
						<PlayerRow key={p.id} p={p} isCreator={isCreator} canManage={canManage} currentUserId={currentUserId} onMove={onMovePlayer ? (toSlot) => onMovePlayer(p.id, toSlot) : undefined} />
					))}
				</View>
			)}

			{/* Botones para elegir equipo (usuario que se quiere unir) */}
			{showJoinTeam && onJoinTeam && (
				<View style={localStyles.joinTeamRow}>
					<Text style={localStyles.joinTeamLabel}>¿A qué equipo te unís?</Text>
					<View style={localStyles.joinTeamBtns}>
						<TouchableOpacity style={[localStyles.joinTeamBtn, { backgroundColor: TEAM_CONFIG.A.bg, borderColor: TEAM_CONFIG.A.border }]} onPress={() => onJoinTeam('A')} disabled={teamA.length >= perTeam}>
							<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.A.color }]} />
							<Text style={[localStyles.joinTeamBtnText, { color: TEAM_CONFIG.A.color }]}>Equipo A {teamA.length >= perTeam ? '(lleno)' : ''}</Text>
						</TouchableOpacity>
						<TouchableOpacity style={[localStyles.joinTeamBtn, { backgroundColor: TEAM_CONFIG.B.bg, borderColor: TEAM_CONFIG.B.border }]} onPress={() => onJoinTeam('B')} disabled={teamB.length >= perTeam}>
							<View style={[localStyles.teamDot, { backgroundColor: TEAM_CONFIG.B.color }]} />
							<Text style={[localStyles.joinTeamBtnText, { color: TEAM_CONFIG.B.color }]}>Equipo B {teamB.length >= perTeam ? '(lleno)' : ''}</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}
		</View>
	)
}

const localStyles = StyleSheet.create({
	teamsRow: {
		flexDirection: 'row',
		gap: spacing.md,
	},
	teamCol: {
		flex: 1,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		padding: spacing.md,
		gap: spacing.xs,
	},
	teamHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: spacing.sm,
	},
	teamDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	teamTitle: {
		...typography.body,
		fontWeight: '600',
		flex: 1,
	},
	teamCount: {
		...typography.bodySmall,
		fontWeight: '600',
	},
	playerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: 5,
	},
	avatar: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
	avatarInitial: {
		color: 'white',
		fontWeight: '700',
		fontSize: 12,
	},
	playerName: {
		...typography.bodySmall,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	guestBadge: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontSize: 10,
	},
	moveBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	moveBtnText: {
		fontSize: 10,
		fontWeight: '600',
	},
	emptySlot: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingVertical: 5,
		opacity: 0.5,
	},
	emptyText: {
		...typography.bodySmall,
		fontSize: 11,
	},
	unassignedSection: {
		marginTop: spacing.md,
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.md,
	},
	unassignedTitle: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontWeight: '600',
		marginBottom: spacing.sm,
	},
	joinTeamRow: {
		marginTop: spacing.lg,
	},
	joinTeamLabel: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	joinTeamBtns: {
		flexDirection: 'row',
		gap: spacing.md,
	},
	joinTeamBtn: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		paddingVertical: 14,
	},
	joinTeamBtnText: {
		...typography.body,
		fontWeight: '700',
	},
})
