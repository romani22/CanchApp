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
	// Puede llegar como objeto {x,y} o como string Postgres "(x,y)" — manejamos ambos
	zoneCoordinates: Coords | string | null
	isEditing: boolean
	onChangeZone: (zone: string, coordinates: Coords) => void
}

/**
 * Supabase devuelve el tipo POINT como string "(longitud,latitud)".
 * Esta función lo convierte a { x, y } para usar en el componente.
 */
function parseCoords(raw: Coords | string | null): Coords | null {
	if (!raw) return null
	if (typeof raw === 'object') return raw
	// formato postgres: "(x,y)"
	const match = raw.match(/\(?([-\d.]+),([-\d.]+)\)?/)
	if (!match) return null
	return { x: parseFloat(match[1]), y: parseFloat(match[2]) }
}

function ZonaProfile({ zone, zoneCoordinates, isEditing, onChangeZone }: Props) {
	const { detect, loading } = useLocation()
	const coords = parseCoords(zoneCoordinates)

	const handleDetectLocation = async () => {
		if (!isEditing) return
		const result = await detect()
		if (!result) {
			Alert.alert('Sin acceso a ubicación', 'Para detectar tu zona necesitamos acceso a tu ubicación. Podés habilitarlo desde Ajustes del dispositivo.', [{ text: 'Entendido' }])
			return
		}
		onChangeZone(result.zone, result.coordinates)
	}

	const hasLocation = !!zone

	return (
		<View style={styles.section}>
			<View style={styles.zoneCard}>
				<View style={styles.zoneHeader}>
					<View style={styles.zoneIconContainer}>
						<Ionicons name='location' size={24} color={colors.primary} />
					</View>

					<View style={styles.zoneInfo}>
						<Text style={styles.zoneTitle}>Zona de juego</Text>
						<Text style={styles.zoneHint}>{hasLocation ? 'Tu zona actual' : 'No configurada aún'}</Text>
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

				{hasLocation && (
					<View style={styles.zoneBadge}>
						<Ionicons name='location-outline' size={14} color={colors.primary} />
						<Text style={styles.zoneBadgeText} numberOfLines={1}>
							{zone}
						</Text>
					</View>
				)}

				{/* Solo mostrar coordenadas si están disponibles y son válidas */}
				{coords && (
					<View style={localStyles.coordsRow}>
						<Ionicons name='map-outline' size={12} color={colors.textSecondaryDark} />
						<Text style={localStyles.coordsText}>
							{coords.y.toFixed(4)}, {coords.x.toFixed(4)}
						</Text>
					</View>
				)}

				{!hasLocation && !isEditing && <Text style={localStyles.emptyHint}>Activá el modo edición para configurar tu zona.</Text>}
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
	coordsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: spacing.sm,
	},
	coordsText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontFamily: 'monospace',
	},
	emptyHint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.sm,
		fontStyle: 'italic',
	},
})

export default ZonaProfile
