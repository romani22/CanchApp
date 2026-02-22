import { styles } from '@/assets/styles/Profile.styles'
import { colors } from '@/theme/colors'
import { Modal, Text, TouchableOpacity, View } from 'react-native'

interface ConfirmChangesModalProps {
	visible: boolean
	title?: string
	description?: string
	onConfirm: () => void
	onDiscard: () => void
	onCancel: () => void
	loading?: boolean
}

export default function ConfirmChangesModal({ visible, title = '¿Guardar cambios?', description = 'Se actualizará la información de tu perfil.', onConfirm, onDiscard, onCancel, loading = false }: ConfirmChangesModalProps) {
	console.log()
	return (
		<Modal visible={visible} animationType='fade' transparent>
			<View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center' }}>
				<View
					style={{
						backgroundColor: colors.backgroundLight,
						width: '85%',
						borderRadius: 16,
						padding: 24,
					}}
				>
					<Text style={styles.titleModal}>{title}</Text>

					<Text style={styles.descriptionModal}>{description}</Text>

					<View style={{ gap: 12 }}>
						<TouchableOpacity onPress={onConfirm} disabled={loading} style={styles.buttonSaveModal}>
							<Text style={{ color: 'white', fontWeight: '600' }}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Text>
						</TouchableOpacity>

						<TouchableOpacity onPress={onDiscard} style={styles.buttonDiscardModal}>
							<Text style={{ color: 'white', fontWeight: '600' }}>Descartar Cambios</Text>
						</TouchableOpacity>

						<TouchableOpacity onPress={onCancel} style={styles.buttonCancelModal}>
							<Text style={{ color: 'white', fontWeight: '600' }}>Cancelar</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
}
