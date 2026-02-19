export const colors = {
	// Primary
	primary: '#30e87a',
	primaryDark: '#22c55e',
	primaryLight: '#4ded91',
	primaryForeground: '#000000',
	// Secondary
	secondary: '#27272a',
	// Background
	backgroundLight: '#f6f8f7',
	BackgroundLogin: '#5757572A',
	backgroundDark: '#112117',
	// Surface (cards, etc)
	surfaceLight: '#ffffff',
	surfaceDark: '#1c2620',
	// Text
	textPrimaryLight: '#0f172a', // slate-900
	textPrimaryDark: '#ffffff',
	textSecondaryLight: '#64748b', // slate-500
	textSecondaryDark: '#9db8a8',
	foreground: '#ffffff',
	mutedForeground: '#FFFFFFBB',

	input: '#1f1f1f',
	ring: '#22c55e',
	// Borders
	border: '#1f1f1f',
	borderLight: '#e2e8f0', // slate-200
	borderDark: 'rgba(255, 255, 255, 0.1)',
	// Status colors
	success: '#22c55e',
	warning: '#f59e0b',
	error: '#ef4444',
	info: '#3b82f6',
	// Sport colors (for badges/icons)
	sports: {
		futbol: '#22c55e',
		padel: '#3b82f6',
		tenis: '#f59e0b',
		basquet: '#f97316',
		voley: '#8b5cf6',
	},

	// Skill level colors
	levels: {
		principiante: 'rgba(255, 255, 255, 0.2)',
		intermedio: '#30e87a',
		avanzado: '#f59e0b',
	},
} as const

export const borderRadius = {
	sm: 6,
	md: 8,
	lg: 10,
	xl: 14,
}

export type ColorScheme = 'light' | 'dark'

export const getColors = (scheme: ColorScheme) => ({
	primary: colors.primary,
	background: scheme === 'dark' ? colors.backgroundDark : colors.backgroundLight,
	surface: scheme === 'dark' ? colors.surfaceDark : colors.surfaceLight,
	text: scheme === 'dark' ? colors.textPrimaryDark : colors.textPrimaryLight,
	textSecondary: scheme === 'dark' ? colors.textSecondaryDark : colors.textSecondaryLight,
	border: scheme === 'dark' ? colors.borderDark : colors.borderLight,
})
