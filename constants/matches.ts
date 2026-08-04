import { colors } from '@/theme/colors';
import { SkillLevel, SportLevels, SportType } from '@/types/database.types';
import { Ionicons } from '@expo/vector-icons';

export const sports: { key: SportType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
	{ key: 'futbol', label: 'Futbol', icon: 'football' },
	{ key: 'padel', label: 'Padel', icon: 'tennisball' },
	{ key: 'basquet', label: 'Basquet', icon: 'basketball' },
	{ key: 'voley', label: 'Voley', icon: 'baseball' },
	{ key: 'tenis', label: 'Tenis', icon: 'tennisball' },
]

/**
 * Equivalentes en MaterialCommunityIcons, para las pantallas que usan esa familia
 * en vez de Ionicons. Existe para que no haga falta mantener una segunda lista de
 * deportes sólo por el set de iconos.
 */
export const sportsMaterialIcons: Record<SportType, string> = {
	futbol: 'soccer',
	padel: 'tennis-ball',
	basquet: 'basketball',
	voley: 'volleyball',
	tenis: 'tennis',
}

export const levels: { key: SkillLevel; label: string }[] = [
	{ key: 'principiante', label: 'Bajo' },
	{ key: 'intermedio', label: 'Medio' },
	{ key: 'avanzado', label: 'Alto' },
]

export const levelLabels: Record<SkillLevel, string> = {
	principiante: 'Principiante',
	intermedio: 'Intermedio',
	avanzado: 'Avanzado',
}

/* ============================
   SPORT LEVELS
   Helpers sobre profiles.sport_levels (mapa deporte -> nivel).
============================ */

/**
 * Deportes que juega el usuario, derivados de las claves del mapa.
 * Recorre `sports` en vez de Object.keys() para que el orden sea siempre el
 * canónico y no dependa de cómo Postgres serialice el JSONB.
 */
export const sportsFromLevels = (sportLevels: SportLevels | null | undefined): SportType[] => sports.filter((s) => sportLevels?.[s.key] != null).map((s) => s.key)

/** Nivel en un deporte concreto, o null si el usuario no lo juega. */
export const levelForSport = (sportLevels: SportLevels | null | undefined, sport: SportType): SkillLevel | null => sportLevels?.[sport] ?? null

/** Resumen legible para contextos sin deporte: "Futbol Intermedio · Padel Avanzado". */
export const describeSportLevels = (sportLevels: SportLevels | null | undefined): string =>
	sportsFromLevels(sportLevels)
		.map((key) => {
			const label = sports.find((s) => s.key === key)?.label ?? key
			const level = sportLevels?.[key]
			return level ? `${label} ${levelLabels[level]}` : label
		})
		.join(' · ')

/**
 * Duración estimada de un partido, por deporte, en minutos.
 *
 * matches.end_time existe desde 001, pero es un TIME que nadie escribe: 006 migró
 * date + start_time a starts_at y lo dejó ahí. O sea que no hay dato de cuándo
 * termina un partido y hay que estimarlo. Se usa sólo para avisarle al creador que
 * cargue el resultado, así que errarle veinte minutos no rompe nada.
 */
export const SPORT_DURATION_MINUTES: Record<SportType, number> = {
	futbol: 90,
	basquet: 60,
	voley: 75,
	tenis: 90,
	padel: 90,
}

/** Momento estimado en que terminó el partido. */
export const estimateMatchEnd = (sport: SportType, startsAt: Date): Date => new Date(startsAt.getTime() + SPORT_DURATION_MINUTES[sport] * 60_000)

/** Colores y etiquetas de los equipos en modo two_teams. */
export const TEAM_CONFIG = {
	A: { label: 'Equipo A', color: colors.info, bg: `${colors.info}18`, border: `${colors.info}40` },
	B: { label: 'Equipo B', color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
} as const

/** Título automático: "Futbol 8vs8". Es lo que se guarda si no le ponen nombre. */
export const buildMatchTitle = (sport: SportType, totalPlayers: number): string => {
	const sportLabel = sports.find((s) => s.key === sport)?.label ?? sport
	const playersPerSide = Math.floor(totalPlayers / 2)
	return `${sportLabel} ${playersPerSide}vs${playersPerSide}`
}

/**
 * ¿El título es uno de los automáticos, o un nombre que puso el creador?
 *
 * Se usa al editar: con un nombre propio se respeta lo escrito, y con uno
 * automático el campo queda vacío para que siga al deporte y al total de jugadores.
 *
 * Acepta cualquier cantidad de jugadores y también la `v` sola del formato viejo
 * ("Futbol 5v5"): Create armaba el título con un cálculo propio que dejaba "5v5"
 * en todo partido de más de 6 jugadores. Esos títulos no los eligió nadie, así que
 * cuentan como automáticos y se recalculan.
 */
export const isAutoMatchTitle = (title: string, sport: SportType): boolean => {
	const sportLabel = sports.find((s) => s.key === sport)?.label ?? sport
	const trimmed = title.trim()
	const prefix = `${sportLabel} `

	if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
		return /^\d+vs?\d+$/i.test(trimmed.slice(prefix.length))
	}
	// El deporte solo también es automático: no aporta nada sobre el badge de deporte.
	return trimmed.toLowerCase() === sportLabel.toLowerCase()
}
