import { styles } from '@/assets/styles/Profile.styles'
import { useLocation } from '@/hooks/useLocation'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Coords = { x: number; y: number }

type Props = {
	zone: string | null
	zoneCoordinates: Coords | string | null
	isEditing: boolean
	onChangeZone: (zone: string, coordinates: Coords) => void
}

/**
 * Supabase devuelve el tipo POINT como string "(longitud,latitud)".
 * Esta función lo normaliza a { x, y }.
 */
function parseCoords(raw: Coords | string | null): Coords | null {
	if (!raw) return null
	if (typeof raw === 'object') return raw
	const match = raw.match(/\(?([-\d.]+),([-\d.]+)\)?/)
	if (!match) return null
	return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
}

function ZonaProfile({ zone, zoneCoordinates, isEditing, onChangeZone }: Props) {
	const { detect, loading } = useLocation()
	const coords = parseCoords(zoneCoordinates)
	const hasLocation = !!zone

	const handleDetectLocation = async () => {
		if (!isEditing) return
		const result = await detect()
		if (!result) {
			Alert.alert('Sin acceso a ubicación', 'Para detectar tu zona necesitamos acceso a tu ubicación. Podés habilitarlo desde Ajustes del dispositivo.', [{ text: 'Entendido' }])
			return
		}
		onChangeZone(result.zone, result.coordinates)
	}

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

					{isEditing && (
						<TouchableOpacity style={localStyles.detectButton} onPress={handleDetectLocation} disabled={loading}>
							{loading ? (
								<ActivityIndicator size='small' color={colors.backgroundDark} />
							) : (
								<>
									<Ionicons name='navigate' size={14} color={colors.backgroundDark} />
									<Text style={localStyles.detectButtonText}>{hasLocation ? 'Actualizar' : 'Detectar'}</Text>
								</>
							)}
						</TouchableOpacity>
					)}
				</View>

				{/* Localidad detectada */}
				{hasLocation ? (
					<View style={localStyles.zoneResult}>
						<View style={localStyles.zoneNameRow}>
							<Ionicons name='location-outline' size={16} color={colors.primary} />
							<Text style={localStyles.zoneName} numberOfLines={1}>
								{zone}
							</Text>
						</View>
						{coords && (
							<View style={localStyles.gpsConfirmed}>
								<Ionicons name='checkmark-circle' size={14} color={colors.success} />
								<Text style={localStyles.gpsConfirmedText}>GPS confirmado · radio de búsqueda 20 km</Text>
							</View>
						)}
					</View>
				) : (
					!isEditing && <Text style={localStyles.emptyHint}>Activá el modo edición para configurar tu zona y ver partidos cercanos.</Text>
				)}
			</View>
		</View>
	)
}

const localStyles = StyleSheet.create({
	detectButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
	},
	detectButtonText: {
		...typography.labelSmall,
		color: colors.backgroundDark,
		fontWeight: '700',
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
