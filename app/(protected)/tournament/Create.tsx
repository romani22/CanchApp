import { styles } from '@/assets/styles/Tournament.style'
import { colors } from '@/theme/colors'
import { spacing } from '@/theme/spacing'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const sports = [
	{ id: 'futbol', label: 'Fútbol', icon: 'soccer' },
	{ id: 'basquet', label: 'Básquet', icon: 'basketball' },
	{ id: 'padel', label: 'Pádel', icon: 'tennis-ball' },
	{ id: 'voley', label: 'Voley', icon: 'volleyball' },
]

const formats = [
	{ id: 'eliminatoria', title: 'Eliminatoria', desc: 'Torneo de eliminación directa.', icon: 'sitemap' },
	{ id: 'liga', title: 'Liga', desc: 'Todos contra todos por puntos.', icon: 'format-list-bulleted' },
	{ id: 'grupos', title: 'Grupos + Eliminatoria', desc: 'Fase inicial y luego playoffs.', icon: 'layers-outline' },
]

export default function CreateTournamentScreen() {
	const [sport, setSport] = useState('futbol')
	const [format, setFormat] = useState('eliminatoria')
	const [teamLimit, setTeamLimit] = useState(16)
	const [venue, setVenue] = useState('')

	return (
		<SafeAreaView style={styles.container}>
			{/* Header Customizado */}
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()}>
					<Text style={styles.headerActionText}>Cancelar</Text>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Crear Nuevo Torneo</Text>
				<View style={styles.stepContainer}>
					<Text style={styles.stepLabel}>Paso</Text>
					<Text style={styles.stepValue}>1/2</Text>
				</View>
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				{/* Sección Información Básica */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Información Básica</Text>

					<Text style={styles.inputLabel}>Nombre del Torneo</Text>
					<TextInput style={styles.input} placeholder='Ej. Copa de Verano 2024' placeholderTextColor={colors.textSecondaryDark} />

					<Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Selecciona el Deporte</Text>
					<View style={styles.sportsGrid}>
						{sports.map((s) => (
							<TouchableOpacity key={s.id} onPress={() => setSport(s.id)} style={[styles.sportCard, sport === s.id && styles.sportCardActive]}>
								<MaterialCommunityIcons name={s.icon as any} size={28} color={sport === s.id ? colors.primary : colors.textPrimaryDark} />
								<Text style={[styles.sportLabel, sport === s.id && styles.sportLabelActive]}>{s.label}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				{/* Sección Formato */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Formato de Competición</Text>
					{formats.map((f) => (
						<TouchableOpacity key={f.id} onPress={() => setFormat(f.id)} style={[styles.formatCard, format === f.id && styles.formatCardActive]}>
							<View style={[styles.formatIconContainer, format === f.id && styles.formatIconActive]}>
								<MaterialCommunityIcons name={f.icon as any} size={24} color={format === f.id ? colors.backgroundDark : colors.textPrimaryDark} />
							</View>
							<View style={styles.formatInfo}>
								<Text style={styles.formatTitle}>{f.title}</Text>
								<Text style={styles.formatDesc}>{f.desc}</Text>
							</View>
							<View style={[styles.radioOuter, format === f.id && styles.radioOuterActive]}>{format === f.id && <View style={styles.radioInner} />}</View>
						</TouchableOpacity>
					))}
				</View>

				{/* Sección Logística */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Logística</Text>

					<TouchableOpacity style={styles.launchButton}>
						<Ionicons name='rocket' size={20} color={colors.backgroundDark} />
						<Text style={styles.launchButtonText}>Lanzar Torneo</Text>
					</TouchableOpacity>
					<Text style={styles.launchHint}>Al lanzar el torneo, se notificará a los equipos cercanos y se abrirán las inscripciones.</Text>

					<Text style={styles.inputLabel}>Sede / Cancha</Text>
					<View style={styles.inputWrapper}>
						<Ionicons name='location' size={20} color={colors.textSecondaryDark} />
						<TextInput style={styles.inputInner} placeholder='Ej. Club Olimpia, Cancha 1' placeholderTextColor={colors.textSecondaryDark} value={venue} onChangeText={setVenue} />
					</View>

					<View style={styles.sliderHeader}>
						<Text style={styles.inputLabel}>Límite de Equipos</Text>
						<Text style={styles.sliderValue}>{teamLimit}</Text>
					</View>
					<Slider style={{ width: '100%', height: 40 }} minimumValue={2} maximumValue={64} step={1} value={teamLimit} onValueChange={setTeamLimit} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.borderDark} thumbTintColor={colors.primary} />
					<View style={styles.sliderLabels}>
						<Text style={styles.sliderLimitText}>2 EQUIPOS</Text>
						<Text style={styles.sliderLimitText}>64 EQUIPOS</Text>
					</View>
				</View>

				{/* Detalles */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Detalles y Premios</Text>
					<TextInput style={styles.textArea} placeholder='Describe las reglas, el premio...' placeholderTextColor={colors.textSecondaryDark} multiline numberOfLines={4} textAlignVertical='top' />
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}
