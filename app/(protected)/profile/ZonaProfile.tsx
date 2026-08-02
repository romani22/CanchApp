import { styles } from '@/assets/styles/Profile.styles'
import { VenueZoneInput } from '@/components/ui/VenueZoneInput'
import { VenueZoneState } from '@/hooks/useVenueZone'
import { colors } from '@/theme/colors'
import { spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

type Props = {
	/** Estado del buscador de localidades, creado con useVenueZone() en la pantalla. */
	venueZone: VenueZoneState
	isEditing: boolean
}

/**
 * Zona de juego del perfil.
 *
 * En modo edición usa el mismo buscador de localidades que el alta de partidos y el
 * onboarding. Antes sólo ofrecía el botón de GPS, así que sin ubicación disponible
 * no había forma de cambiar la zona.
 */
function ZonaProfile({ venueZone, isEditing }: Props) {
	const hasLocation = !!venueZone.inputText.trim()

	return (
		<View style={styles.section}>
			<View style={styles.zoneCard}>
				{/* Header de la tarjeta */}
				<View style={styles.zoneHeader}>
					<View style={styles.zoneIconContainer}>
						<Ionicons name='location' size={24} color={colors.primary} />
					</View>

					<View style={styles.zoneInfo}>
						<Text style={styles.zoneTitle}>Zona de juego</Text>
						<Text style={styles.zoneHint}>{hasLocation ? 'Se usa para mostrarte partidos cercanos' : 'Sin zona configurada aún'}</Text>
					</View>
				</View>

				{isEditing ? (
					<View style={localStyles.editor}>
						<VenueZoneInput
							value={venueZone.inputText}
							coords={venueZone.coords}
							suggestions={venueZone.suggestions}
							searching={venueZone.searching}
							isDirty={venueZone.isDirty}
							onChangeText={venueZone.onChangeText}
							onSelect={venueZone.onSelect}
							onDetectGPS={venueZone.onDetectGPS}
							onDismiss={venueZone.onDismiss}
							placeholder='Buscá tu ciudad o localidad'
							confirmedHint='Ubicación confirmada — vas a ver los partidos en un radio de 20 km'
						/>
					</View>
				) : hasLocation ? (
					<View style={localStyles.zoneResult}>
						<View style={localStyles.zoneNameRow}>
							<Ionicons name='location-outline' size={16} color={colors.primary} />
							<Text style={localStyles.zoneName} numberOfLines={1}>
								{venueZone.inputText}
							</Text>
						</View>
						{venueZone.coords && (
							<View style={localStyles.gpsConfirmed}>
								<Ionicons name='checkmark-circle' size={14} color={colors.success} />
								<Text style={localStyles.gpsConfirmedText}>Ubicación confirmada · radio de búsqueda 20 km</Text>
							</View>
						)}
					</View>
				) : (
					<Text style={localStyles.emptyHint}>Activá el modo edición para configurar tu zona y ver partidos cercanos.</Text>
				)}
			</View>
		</View>
	)
}

const localStyles = StyleSheet.create({
	editor: {
		marginTop: spacing.md,
	},
	zoneResult: {
		marginTop: spacing.md,
		gap: spacing.xs,
	},
	zoneNameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	zoneName: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '600',
		flex: 1,
	},
	gpsConfirmed: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginLeft: 22,
	},
	gpsConfirmedText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	emptyHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.sm,
		fontStyle: 'italic',
	},
})

export default ZonaProfile
