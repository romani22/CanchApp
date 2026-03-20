import { styles as matchStyles } from '@/assets/styles/Match.styles'
import { useLocation } from '@/hooks/useLocation'
import { LocalidadSuggestion } from '@/hooks/useVenueZone'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

interface Props {
	value: string
	coords: { x: number; y: number } | null
	suggestions: LocalidadSuggestion[]
	searching: boolean
	isDirty: boolean
	onChangeText: (text: string) => void
	onSelect: (item: LocalidadSuggestion) => void
	onDetectGPS: () => Promise<void>
	onDismiss: () => void
}

export function VenueZoneInput({ value, coords, suggestions, searching, isDirty, onChangeText, onSelect, onDetectGPS, onDismiss }: Props) {
	const { loading: detectingGPS } = useLocation()
	const isBusy = detectingGPS || searching
	// Coords confirmadas = hay coords Y el usuario no escribió algo nuevo después
	const isConfirmed = !!coords && !isDirty

	return (
		<View>
			{/* Input */}
			<View style={[matchStyles.inputWrapper, suggestions.length > 0 && localStyles.inputOpen]}>
				<Ionicons name='map-outline' size={20} color={colors.textSecondaryDark} />
				<TextInput style={matchStyles.input} placeholder='Ej: Morteros, Córdoba...' placeholderTextColor={colors.textSecondaryDark} value={value} onChangeText={onChangeText} autoCapitalize='words' returnKeyType='done' onBlur={onDismiss} autoCorrect={false} />
				{isBusy && <ActivityIndicator size='small' color={colors.primary} style={{ marginRight: 2 }} />}
				{!isBusy && isConfirmed && <Ionicons name='checkmark-circle' size={18} color={colors.success} style={{ marginRight: 2 }} />}
				<TouchableOpacity onPress={onDetectGPS} disabled={isBusy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
					<Ionicons name='navigate' size={18} color={isConfirmed ? colors.primary : colors.textSecondaryDark} />
				</TouchableOpacity>
			</View>

			{/* Dropdown */}
			{suggestions.length > 0 && (
				<View style={localStyles.dropdown}>
					<ScrollView keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
						{suggestions.map((item, index) => (
							<TouchableOpacity key={item.id} style={[localStyles.suggestionRow, index < suggestions.length - 1 && localStyles.suggestionBorder]} onPress={() => onSelect(item)} activeOpacity={0.7}>
								<Ionicons name='location-outline' size={16} color={colors.primary} style={{ marginRight: spacing.md }} />
								<View style={{ flex: 1 }}>
									<Text style={localStyles.suggestionName}>{item.nombre}</Text>
									<Text style={localStyles.suggestionProv}>{item.provincia}</Text>
								</View>
								<Ionicons name='chevron-forward' size={14} color={colors.textSecondaryDark} />
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			)}

			{/* Feedback */}
			<View style={localStyles.statusRow}>
				{searching && <Text style={localStyles.statusMuted}>Buscando localidades...</Text>}
				{!isBusy && isConfirmed && (
					<>
						<Ionicons name='checkmark-circle' size={12} color={colors.success} />
						<Text style={[localStyles.statusMuted, { color: colors.success }]}>Coordenadas confirmadas — el partido aparecerá en búsquedas por zona</Text>
					</>
				)}
				{!isBusy && isDirty && value.trim().length >= 2 && suggestions.length === 0 && !searching && (
					<>
						<Ionicons name='alert-circle-outline' size={12} color={colors.warning} />
						<Text style={[localStyles.statusMuted, { color: colors.warning }]}>Seleccioná una localidad del listado para confirmar las coordenadas</Text>
					</>
				)}
			</View>
		</View>
	)
}

const localStyles = StyleSheet.create({
	inputOpen: {
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
		borderBottomColor: 'transparent',
	},
	dropdown: {
		backgroundColor: colors.surfaceDark,
		borderWidth: 1,
		borderTopWidth: 0,
		borderColor: colors.borderDark,
		borderBottomLeftRadius: borderRadius.lg,
		borderBottomRightRadius: borderRadius.lg,
		overflow: 'hidden',
	},
	suggestionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: 12,
	},
	suggestionBorder: {
		borderBottomWidth: 0.5,
		borderBottomColor: colors.borderDark,
	},
	suggestionName: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '500',
	},
	suggestionProv: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 1,
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 5,
		marginLeft: 4,
		minHeight: 16,
	},
	statusMuted: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
})
