import { Chip } from '@/components/ui/Chip'
import { sports } from '@/constants/matches'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { SportType } from '@/types/database.types'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Props = {
	visible: boolean
	onClose: () => void
	onSelectSport: (sport: SportType) => void
	/** Deportes ya elegidos, para marcarlos como seleccionados. */
	editableSports: SportType[]
}

/**
 * Selector de deportes del perfil.
 *
 * Usa la lista canónica de constants/matches y el componente Chip, igual que el
 * resto de la app. Antes recibía las opciones por prop tipadas como any[] y
 * dibujaba todo con estilos inline y colores hardcodeados.
 */
export default function SportModal({ visible, onClose, onSelectSport, editableSports }: Props) {
	return (
		<Modal visible={visible} animationType='slide' transparent onRequestClose={onClose}>
			<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
				{/* El TouchableOpacity interno frena la propagación para que tocar
				    dentro de la tarjeta no cierre el modal. */}
				<TouchableOpacity style={styles.card} activeOpacity={1}>
					<Text style={styles.title}>Seleccionar deportes</Text>
					<Text style={styles.hint}>Tocá para agregar o quitar. Después elegís tu nivel en cada uno.</Text>

					<View style={styles.chips}>
						{sports.map((sport) => (
							<Chip key={sport.key} label={sport.label} icon={sport.icon} selected={editableSports.includes(sport.key)} onPress={() => onSelectSport(sport.key)} size='md' />
						))}
					</View>

					<TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
						<Text style={styles.closeButtonText}>Listo</Text>
					</TouchableOpacity>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.65)',
		justifyContent: 'center',
		padding: spacing.xl,
	},
	card: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.xl,
	},
	title: {
		...typography.h4,
		color: colors.textPrimaryDark,
	},
	hint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: spacing.xs,
		marginBottom: spacing.lg,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
		marginBottom: spacing.xl,
	},
	closeButton: {
		backgroundColor: colors.primary,
		borderRadius: borderRadius.md,
		paddingVertical: spacing.lg,
		alignItems: 'center',
	},
	closeButtonText: {
		...typography.button,
		color: colors.backgroundDark,
	},
})
