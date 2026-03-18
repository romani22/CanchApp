import { SkillLevel, SportType } from '@/types/database.types';
import { Ionicons } from '@expo/vector-icons';

export const sports: { key: SportType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
	{ key: 'futbol', label: 'Futbol', icon: 'football' },
	{ key: 'padel', label: 'Padel', icon: 'tennisball' },
	{ key: 'basquet', label: 'Basquet', icon: 'basketball' },
	{ key: 'voley', label: 'Voley', icon: 'baseball' },
	{ key: 'tenis', label: 'Tenis', icon: 'tennisball' },
]

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

export const buildMatchTitle = (sport: SportType, totalPlayers: number): string => {
	const sportLabel = sports.find((s) => s.key === sport)?.label ?? sport
	const playersPerSide = Math.floor(totalPlayers / 2)
	return `${sportLabel} ${playersPerSide}vs${playersPerSide}`
}
