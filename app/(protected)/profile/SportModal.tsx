import { colors } from '@/theme/colors';
import { SportType } from '@/types/database.types';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

export default function SportModal({ visible, onClose, onSelectSport, editableSports, sportOptions }: { visible: boolean; onClose: () => void; onSelectSport: (sport: SportType) => void; editableSports: SportType[]; sportOptions: any[] }) {
	return (
		<Modal visible={visible} animationType='slide' transparent>
			<View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center' }}>
				<View
					style={{
						backgroundColor: '#111',
						margin: 20,
						borderRadius: 12,
						padding: 20,
					}}
				>
					<Text style={{ color: 'white', marginBottom: 20 }}>Seleccionar Deportes</Text>

					{sportOptions.map((sport) => (
						<TouchableOpacity
							key={sport.key}
							onPress={() => onSelectSport(sport.key)}
							style={{
								padding: 12,
								backgroundColor: editableSports.includes(sport.key) ? colors.primary : '#222',
								marginBottom: 10,
								borderRadius: 8,
							}}
						>
							<Text style={{ color: 'white' }}>{sport.label}</Text>
						</TouchableOpacity>
					))}

					<TouchableOpacity onPress={() => onClose()}>
						<Text style={{ color: colors.primary }}>Cerrar</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	)
}
