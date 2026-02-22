import { styles } from '@/assets/styles/Profile.styles'
import { colors } from '@/theme/colors'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Modal, Text, TouchableOpacity, View } from 'react-native'

type Props = {
	zone: string | null
	isEditing: boolean
	onChangeZone: (zone: string) => void
}

const zones = ['Centro', 'Norte', 'Sur', 'Este', 'Oeste']

function ZonaProfile({ zone, isEditing, onChangeZone }: Props) {
	const [modalVisible, setModalVisible] = useState(false)

	return (
		<View style={styles.section}>
			<View style={styles.zoneCard}>
				<Text style={styles.zoneTitle}>Zona de juego preferida</Text>

				<TouchableOpacity disabled={!isEditing} onPress={() => setModalVisible(true)}>
					<View style={styles.zoneBadge}>
						<Text style={styles.zoneBadgeText}>{zone || 'Seleccionar zona'}</Text>
						{isEditing && <Ionicons name='chevron-down' size={14} color={colors.primary} />}
					</View>
				</TouchableOpacity>
			</View>

			<Modal visible={modalVisible} transparent animationType='slide'>
				<View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center' }}>
					<View
						style={{
							backgroundColor: '#111',
							margin: 20,
							padding: 20,
							borderRadius: 12,
						}}
					>
						{zones.map((z) => (
							<TouchableOpacity
								key={z}
								onPress={() => {
									onChangeZone(z)
									setModalVisible(false)
								}}
								style={{
									padding: 12,
									backgroundColor: z === zone ? colors.primary : '#222',
									marginBottom: 10,
									borderRadius: 8,
								}}
							>
								<Text style={{ color: 'white' }}>{z}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
			</Modal>
		</View>
	)
}

export default ZonaProfile
