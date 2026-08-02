import { levelLabels, sports } from '@/constants/matches'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { SkillLevel, SportLevels, SportType } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

/**
 * Borrador de niveles por deporte.
 *
 * `null` significa "deporte elegido, nivel todavía sin definir" — un estado que
 * SportLevels no puede representar porque sus valores son SkillLevel. Tener la
 * selección y el nivel en una sola estructura evita que se desincronicen.
 */
export type SportLevelDraft = Partial<Record<SportType, SkillLevel | null>>

const LEVEL_KEYS: SkillLevel[] = ['principiante', 'intermedio', 'avanzado']

/** Deportes del borrador, en el orden canónico de `sports`, no el de inserción. */
export const draftSports = (draft: SportLevelDraft): SportType[] => sports.filter((s) => s.key in draft).map((s) => s.key)

/** Deportes elegidos a los que todavía les falta el nivel. */
export const sportsMissingLevel = (draft: SportLevelDraft): SportType[] => draftSports(draft).filter((s) => draft[s] == null)

/** Agrega el deporte (sin nivel) si no estaba, o lo quita si ya estaba. */
export const toggleDraftSport = (draft: SportLevelDraft, sport: SportType): SportLevelDraft => {
	if (sport in draft) {
		const { [sport]: _removed, ...rest } = draft
		return rest
	}
	return { ...draft, [sport]: null }
}

/**
 * Estrecha el borrador a SportLevels descartando los deportes sin nivel.
 * Validá antes con sportsMissingLevel() si no querés perder ninguno.
 */
export const draftToSportLevels = (draft: SportLevelDraft): SportLevels =>
	Object.fromEntries(draftSports(draft).filter((s) => draft[s] != null).map((s) => [s, draft[s]])) as SportLevels

/** Construye un borrador a partir de lo que ya está guardado en el perfil. */
export const sportLevelsToDraft = (sportLevels: SportLevels | null | undefined): SportLevelDraft => ({ ...(sportLevels ?? {}) })

type Props = {
	draft: SportLevelDraft
	onChangeLevel: (sport: SportType, level: SkillLevel) => void
}

/**
 * Una tarjeta por deporte elegido, con un selector de nivel de 3 opciones.
 * Compartido entre el onboarding y la edición de perfil para que el control
 * se vea y se comporte igual en los dos lados.
 */
export function SportLevelEditor({ draft, onChangeLevel }: Props) {
	const chosen = draftSports(draft)
	if (chosen.length === 0) return null

	return (
		<>
			{chosen.map((sportKey) => {
				const sport = sports.find((s) => s.key === sportKey)
				const current = draft[sportKey]

				return (
					<View key={sportKey} style={styles.card}>
						<View style={styles.header}>
							<Ionicons name={sport?.icon ?? 'football'} size={18} color={colors.sports[sportKey]} />
							<Text style={styles.name}>{sport?.label ?? sportKey}</Text>
							{current == null && <Text style={styles.pending}>Falta elegir</Text>}
						</View>

						<View style={styles.segmented}>
							{LEVEL_KEYS.map((levelKey) => {
								const isSelected = current === levelKey
								return (
									<TouchableOpacity key={levelKey} onPress={() => onChangeLevel(sportKey, levelKey)} style={[styles.segment, isSelected && styles.segmentActive]} activeOpacity={0.7}>
										<Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{levelLabels[levelKey]}</Text>
									</TouchableOpacity>
								)
							})}
						</View>
					</View>
				)
			})}
		</>
	)
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderColor: colors.borderDark,
		borderRadius: borderRadius.md,
		padding: spacing.lg,
		marginBottom: spacing.md,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	name: {
		...typography.labelLarge,
		color: colors.textPrimaryDark,
		flex: 1,
	},
	pending: {
		...typography.bodySmall,
		color: colors.warning,
	},
	segmented: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	segment: {
		flex: 1,
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.xs,
		borderRadius: borderRadius.sm,
		borderWidth: 1,
		borderColor: colors.borderDark,
		backgroundColor: colors.backgroundDark,
		alignItems: 'center',
	},
	segmentActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	segmentText: {
		fontSize: 12,
		fontWeight: '600',
		color: colors.textSecondaryDark,
		textAlign: 'center',
	},
	segmentTextActive: {
		color: colors.backgroundDark,
	},
})
