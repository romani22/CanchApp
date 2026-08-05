import { styles } from '@/assets/styles/Match.styles'
import Loader from '@/components/ui/Loader'
import { TEAM_CONFIG, sports } from '@/constants/matches'
import { METRICS, MetricKey, SPORT_METRICS, isSetBased } from '@/constants/stats'
import { useAuth } from '@/context/AuthContext'
import { matchResultsService } from '@/services/matchResults.service'
import { matchesService } from '@/services/matches.service'
import { colors } from '@/theme/colors'
import { borderRadius, spacing } from '@/theme/spacing'
import { typography } from '@/theme/typography'
import { MatchOutcome, MatchPlayerStatInput, MatchSetScore, MatchWithCreator, SportType, TeamSlot } from '@/types/database.types'
import { Ionicons } from '@expo/vector-icons'
import { addHours, isAfter, parseISO } from 'date-fns'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/**
 * Carga (o corrige) el resultado de un partido que ya se jugó. Sólo el creador.
 *
 * El resultado se guarda POR JUGADOR: cada uno gana, pierde o empata. Eso es lo
 * que hace que las estadísticas del perfil funcionen igual en un fútbol 5vs5 con
 * equipos, en un tenis 1vs1 y en un pádel donde nadie usó el modo equipos.
 * `outcome: null` significa "no jugó": esas filas no se mandan, así que un
 * anotado que faltó no se come una derrota.
 */

type PlayerRow = {
	participantId: string
	/** null en los invitados: la fila se identifica por su nombre. */
	userId: string | null
	name: string
	avatarUrl: string | null
	teamSlot: TeamSlot | null
	outcome: MatchOutcome | null
	/** Los inputs son texto: '' es "no cargado", que no es lo mismo que 0. */
	metrics: Partial<Record<MetricKey, string>>
}

type SetRow = { a: string; b: string }

const avatarColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A']
const colorFromName = (text?: string | null) => (text ? avatarColors[text.charCodeAt(0) % avatarColors.length] : avatarColors[0])

/** '' → null (no se cargó). Un número inválido también, así no rompe el guardado. */
const parseMetric = (value?: string): number | null => {
	if (!value || value.trim() === '') return null
	const n = Number(value)
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

export default function MatchResultScreen() {
	const { id } = useLocalSearchParams()
	const { user, refreshProfile } = useAuth()

	const [match, setMatch] = useState<MatchWithCreator | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [isEditingExisting, setIsEditingExisting] = useState(false)

	const [rows, setRows] = useState<PlayerRow[]>([])
	const [scoreA, setScoreA] = useState('')
	const [scoreB, setScoreB] = useState('')
	const [sets, setSets] = useState<SetRow[]>([{ a: '', b: '' }])
	const [notes, setNotes] = useState('')

	const sport: SportType = match?.sport ?? 'futbol'
	const hasTeams = match?.team_mode === 'two_teams'
	const setBased = isSetBased(sport)
	const metricKeys = SPORT_METRICS[sport]

	const load = useCallback(async () => {
		try {
			const { data, error } = await matchesService.getById(id as string)
			if (error) throw error
			if (!data) {
				router.back()
				return
			}

			if (data.status === 'cancelled') {
				Alert.alert('Partido cancelado', 'Un partido cancelado no puede tener resultado.')
				router.back()
				return
			}

			const existing = await matchResultsService.getByMatchId(id as string)

			// Mismas reglas que valida la RPC (023): el creador siempre; el autor puede
			// corregir el suyo; cualquier jugador puede cargarlo si a las 24 horas del
			// partido nadie lo hizo. El chequeo de acá es sólo para no mostrar un
			// formulario que el servidor va a rechazar.
			const isCreator = data.creator_id === user?.id
			const isAuthor = !!existing && existing.reported_by === user?.id
			const isPlayer = data.participants?.some((p) => p.user_id === user?.id) ?? false
			const windowOpen = isAfter(new Date(), addHours(parseISO(data.starts_at), 24))

			if (!isCreator && !isAuthor && !(isPlayer && !existing && windowOpen)) {
				Alert.alert('Sin permiso', existing ? 'El resultado lo cargó otra persona. Si no coincide, podés objetarlo desde el partido.' : 'Por ahora sólo el creador puede cargar el resultado. A las 24 horas del partido lo puede cargar cualquier jugador.')
				router.back()
				return
			}

			setMatch(data)
			setIsEditingExisting(!!existing)

			// El resultado guardado se busca por user_id, y por nombre en los invitados:
			// es lo único que los identifica.
			const statFor = (userId: string | null, name: string) => existing?.players.find((p) => (userId ? p.user_id === userId : p.user_id === null && p.display_name === name))

			setRows(
				(data.participants ?? []).map((p) => {
					const name = p.user?.full_name ?? p.guest_name ?? 'Invitado'
					const stat = statFor(p.user_id, name)
					return {
						participantId: p.id,
						userId: p.user_id,
						name,
						avatarUrl: p.user?.avatar_url ?? null,
						teamSlot: p.team_slot,
						// Sin resultado previo arranca en null ("no jugó") y el creador
						// marca explícitamente: nadie recibe una derrota por descuido.
						outcome: stat?.outcome ?? null,
						metrics: {
							goals: stat?.goals != null ? String(stat.goals) : '',
							assists: stat?.assists != null ? String(stat.assists) : '',
							saves: stat?.saves != null ? String(stat.saves) : '',
							points: stat?.points != null ? String(stat.points) : '',
						},
					}
				}),
			)

			if (existing) {
				setScoreA(existing.score_a != null ? String(existing.score_a) : '')
				setScoreB(existing.score_b != null ? String(existing.score_b) : '')
				setSets(existing.sets.length > 0 ? existing.sets.map((s) => ({ a: String(s.a), b: String(s.b) })) : [{ a: '', b: '' }])
				setNotes(existing.notes ?? '')
			}
		} catch (err) {
			console.error('[MatchResult] Error cargando:', err)
			Alert.alert('Error', 'No se pudo cargar el partido.')
			router.back()
		} finally {
			setLoading(false)
		}
	}, [id, user?.id])

	useEffect(() => {
		load()
	}, [load])

	// ── Resultado por jugador ─────────────────────────────────────────────
	const setOutcome = (participantId: string, outcome: MatchOutcome | null) => {
		setRows((prev) => prev.map((r) => (r.participantId === participantId ? { ...r, outcome } : r)))
	}

	const setMetric = (participantId: string, metric: MetricKey, value: string) => {
		// Sólo dígitos: el teclado numérico de iOS igual deja meter separadores.
		const clean = value.replace(/[^0-9]/g, '').slice(0, 3)
		setRows((prev) => prev.map((r) => (r.participantId === participantId ? { ...r, metrics: { ...r.metrics, [metric]: clean } } : r)))
	}

	/**
	 * Empate: marca a todos. Si alguno no jugó, el creador lo desmarca después
	 * tocando su chip activo — al revés (marcar sólo a los ya marcados) el botón
	 * no haría nada en un resultado nuevo, donde todavía nadie tiene resultado.
	 */
	const applyDraw = () => {
		setScoreB(scoreA)
		setRows((prev) => prev.map((r) => ({ ...r, outcome: 'draw' })))
	}

	/** En modo equipos alcanza con decir qué equipo ganó. */
	const applyTeamWinner = (winner: TeamSlot) => {
		setRows((prev) =>
			prev.map((r) => {
				// Un jugador sin equipo asignado no se puede resolver solo: queda como
				// estaba para que el creador lo marque a mano.
				if (!r.teamSlot) return r
				return { ...r, outcome: r.teamSlot === winner ? 'win' : 'loss' }
			}),
		)
	}

	const included = rows.filter((r) => r.outcome !== null)
	const winners = included.filter((r) => r.outcome === 'win')
	const losers = included.filter((r) => r.outcome === 'loss')
	const allDrew = included.length > 0 && included.every((r) => r.outcome === 'draw')

	// ── Sets ──────────────────────────────────────────────────────────────
	const updateSet = (index: number, side: 'a' | 'b', value: string) => {
		const clean = value.replace(/[^0-9]/g, '').slice(0, 2)
		setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [side]: clean } : s)))
	}

	const addSet = () => setSets((prev) => (prev.length >= 5 ? prev : [...prev, { a: '', b: '' }]))
	const removeSet = (index: number) => setSets((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))

	// ── Guardar ───────────────────────────────────────────────────────────
	const handleSave = async () => {
		if (included.length === 0) {
			Alert.alert('Falta el resultado', 'Marcá al menos un jugador como ganador, perdedor o empate.')
			return
		}

		if (!allDrew && (winners.length === 0 || losers.length === 0)) {
			Alert.alert('Resultado incompleto', 'Tiene que haber ganadores y perdedores, o marcar el partido como empate.')
			return
		}

		const completedSets = sets.filter((s) => s.a !== '' && s.b !== '')
		if (setBased && completedSets.length !== sets.filter((s) => s.a !== '' || s.b !== '').length) {
			Alert.alert('Sets incompletos', 'Completá los dos números de cada set o borrá el que sobre.')
			return
		}

		const parsedSets: MatchSetScore[] = completedSets.map((s) => ({ a: Number(s.a), b: Number(s.b) }))

		// Orientación de score_a / score_b (ver 021_match_results.sql):
		//   con equipos → A y B; sin equipos → ganador y perdedor.
		// En los deportes por sets el marcador numérico son los sets ganados por cada
		// lado, así queda un número comparable además del detalle set por set.
		let finalScoreA: number | null = null
		let finalScoreB: number | null = null

		if (setBased) {
			if (parsedSets.length > 0) {
				finalScoreA = parsedSets.filter((s) => s.a > s.b).length
				finalScoreB = parsedSets.filter((s) => s.b > s.a).length
			}
		} else {
			finalScoreA = parseMetric(scoreA)
			finalScoreB = allDrew && !hasTeams ? finalScoreA : parseMetric(scoreB)
		}

		const players: MatchPlayerStatInput[] = included.map((r) => ({
			user_id: r.userId,
			display_name: r.name,
			outcome: r.outcome!,
			// Sólo las métricas del deporte: un partido de tenis no manda goles.
			goals: metricKeys.includes('goals') ? parseMetric(r.metrics.goals) : null,
			assists: metricKeys.includes('assists') ? parseMetric(r.metrics.assists) : null,
			saves: metricKeys.includes('saves') ? parseMetric(r.metrics.saves) : null,
			points: metricKeys.includes('points') ? parseMetric(r.metrics.points) : null,
		}))

		try {
			setSaving(true)
			await matchResultsService.save(id as string, {
				score_a: finalScoreA,
				score_b: finalScoreB,
				sets: parsedSets,
				notes: notes.trim() || null,
				players,
			})

			// No hace falta cancelar nada: el pedido de resultado lo encola el servidor
			// mirando si el resultado existe, y ahora existe.

			// Los totales del perfil los recalcula un trigger al guardar las stats:
			// hay que releer el perfil para que las cards muestren los nuevos números.
			await refreshProfile()
			router.back()
		} catch (err) {
			console.error('[MatchResult] Error guardando:', err)
			Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el resultado.')
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = () => {
		Alert.alert('Borrar resultado', '¿Seguro? El partido vuelve a quedar sin resultado y las estadísticas de los jugadores se recalculan.', [
			{ text: 'Volver', style: 'cancel' },
			{
				text: 'Borrar',
				style: 'destructive',
				onPress: async () => {
					try {
						setSaving(true)
						await matchResultsService.remove(id as string)
						await refreshProfile()
						router.back()
					} catch (err) {
						console.error('[MatchResult] Error borrando:', err)
						Alert.alert('Error', 'No se pudo borrar el resultado.')
					} finally {
						setSaving(false)
					}
				},
			},
		])
	}

	if (loading) return <Loader title='Cargando partido...' />
	if (!match) return null

	const sportLabel = sports.find((s) => s.key === sport)?.label ?? sport
	const scoreLabelA = hasTeams ? TEAM_CONFIG.A.label : allDrew ? 'Goles de cada lado' : 'Ganador'
	const scoreLabelB = hasTeams ? TEAM_CONFIG.B.label : 'Perdedor'

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name='arrow-back' size={24} color={colors.textPrimaryDark} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>{isEditingExisting ? 'Editar resultado' : 'Cargar resultado'}</Text>
				<View style={styles.headerSpacer} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
				<View style={styles.section}>
					<Text style={local.matchTitle}>{match.title}</Text>
					<Text style={local.matchSub}>
						{sportLabel} · {match.venue_name}
					</Text>
				</View>

				{/* ── Quién ganó ── */}
				<View style={[styles.section, { paddingTop: 0 }]}>
					<Text style={styles.sectionTitle}>¿Cómo salió?</Text>

					{hasTeams ? (
						<View style={local.winnerRow}>
							<TouchableOpacity style={[local.winnerButton, winners.some((w) => w.teamSlot === 'A') && { backgroundColor: TEAM_CONFIG.A.bg, borderColor: TEAM_CONFIG.A.color }]} onPress={() => applyTeamWinner('A')}>
								<Text style={[local.winnerButtonText, winners.some((w) => w.teamSlot === 'A') && { color: TEAM_CONFIG.A.color }]}>Ganó A</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[local.winnerButton, allDrew && local.winnerButtonActive]} onPress={applyDraw}>
								<Text style={[local.winnerButtonText, allDrew && { color: colors.primary }]}>Empate</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[local.winnerButton, winners.some((w) => w.teamSlot === 'B') && { backgroundColor: TEAM_CONFIG.B.bg, borderColor: TEAM_CONFIG.B.color }]} onPress={() => applyTeamWinner('B')}>
								<Text style={[local.winnerButtonText, winners.some((w) => w.teamSlot === 'B') && { color: TEAM_CONFIG.B.color }]}>Ganó B</Text>
							</TouchableOpacity>
						</View>
					) : (
						<>
							<Text style={local.hint}>Marcá abajo quién ganó y quién perdió, o cargá el partido como empate.</Text>
							<TouchableOpacity style={[local.drawButton, allDrew && local.winnerButtonActive]} onPress={applyDraw}>
								<Ionicons name='swap-horizontal' size={18} color={allDrew ? colors.primary : colors.textSecondaryDark} />
								<Text style={[local.winnerButtonText, allDrew && { color: colors.primary }]}>Fue empate</Text>
							</TouchableOpacity>
						</>
					)}
				</View>

				{/* ── Marcador ── */}
				<View style={[styles.section, { paddingTop: 0 }]}>
					<Text style={styles.sectionTitle}>
						Marcador <Text style={local.optional}>(opcional)</Text>
					</Text>

					{setBased ? (
						<>
							{sets.map((s, index) => (
								<View key={index} style={local.setRow}>
									<Text style={local.setLabel}>Set {index + 1}</Text>
									<TextInput style={local.scoreInput} value={s.a} onChangeText={(v) => updateSet(index, 'a', v)} keyboardType='number-pad' placeholder='0' placeholderTextColor={colors.textSecondaryDark} />
									<Text style={local.scoreSeparator}>-</Text>
									<TextInput style={local.scoreInput} value={s.b} onChangeText={(v) => updateSet(index, 'b', v)} keyboardType='number-pad' placeholder='0' placeholderTextColor={colors.textSecondaryDark} />
									{sets.length > 1 && (
										<TouchableOpacity onPress={() => removeSet(index)} style={local.setRemove}>
											<Ionicons name='close' size={18} color={colors.error} />
										</TouchableOpacity>
									)}
								</View>
							))}
							<Text style={local.hint}>Primer número: {hasTeams ? TEAM_CONFIG.A.label : 'el ganador del partido'}.</Text>
							{sets.length < 5 && (
								<TouchableOpacity style={local.addSetButton} onPress={addSet}>
									<Ionicons name='add' size={18} color={colors.primary} />
									<Text style={local.addSetText}>Agregar set</Text>
								</TouchableOpacity>
							)}
						</>
					) : (
						<View style={local.scoreRow}>
							<View style={local.scoreBox}>
								<Text style={local.scoreLabel}>{scoreLabelA}</Text>
								<TextInput style={local.scoreInput} value={scoreA} onChangeText={(v) => setScoreA(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType='number-pad' placeholder='0' placeholderTextColor={colors.textSecondaryDark} />
							</View>
							{!(allDrew && !hasTeams) && (
								<View style={local.scoreBox}>
									<Text style={local.scoreLabel}>{scoreLabelB}</Text>
									<TextInput style={local.scoreInput} value={scoreB} onChangeText={(v) => setScoreB(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType='number-pad' placeholder='0' placeholderTextColor={colors.textSecondaryDark} />
								</View>
							)}
						</View>
					)}
				</View>

				{/* ── Jugadores ── */}
				<View style={[styles.section, { paddingTop: 0 }]}>
					<Text style={styles.sectionTitle}>Jugadores</Text>
					<Text style={local.hint}>Los que no marques quedan como que no jugaron: no les cuenta el partido.{metricKeys.length > 0 ? ' Las métricas son opcionales.' : ''}</Text>

					{rows.length === 0 && <Text style={local.empty}>Este partido no tiene jugadores anotados.</Text>}

					{rows.map((row) => (
						<View key={row.participantId} style={[local.playerCard, row.outcome === null && local.playerCardExcluded]}>
							<View style={local.playerHeader}>
								{row.avatarUrl ? <Image source={{ uri: row.avatarUrl }} style={local.playerAvatar} /> : <View style={[local.playerAvatar, local.playerAvatarPlaceholder, { backgroundColor: colorFromName(row.name) }]}>{row.userId ? <Text style={local.playerAvatarInitial}>{row.name.charAt(0).toUpperCase()}</Text> : <Ionicons name='person' size={16} color='white' />}</View>}

								<View style={{ flex: 1 }}>
									<Text style={local.playerName}>{row.name}</Text>
									<Text style={local.playerSub}>
										{row.userId ? 'Jugador registrado' : 'Invitado'}
										{row.teamSlot ? ` · ${TEAM_CONFIG[row.teamSlot].label}` : ''}
									</Text>
								</View>
							</View>

							<View style={local.outcomeRow}>
								{(['win', 'draw', 'loss'] as MatchOutcome[]).map((outcome) => {
									const active = row.outcome === outcome
									const tint = outcome === 'win' ? colors.success : outcome === 'loss' ? colors.error : colors.warning
									return (
										<TouchableOpacity key={outcome} style={[local.outcomeChip, active && { backgroundColor: `${tint}22`, borderColor: tint }]} onPress={() => setOutcome(row.participantId, active ? null : outcome)}>
											<Text style={[local.outcomeChipText, active && { color: tint }]}>{outcome === 'win' ? 'Ganó' : outcome === 'loss' ? 'Perdió' : 'Empató'}</Text>
										</TouchableOpacity>
									)
								})}
							</View>

							{row.outcome !== null && metricKeys.length > 0 && (
								<View style={local.metricsRow}>
									{metricKeys.map((metric) => (
										<View key={metric} style={local.metricBox}>
											<Text style={local.metricLabel}>{METRICS[metric].short}</Text>
											<TextInput style={local.metricInput} value={row.metrics[metric] ?? ''} onChangeText={(v) => setMetric(row.participantId, metric, v)} keyboardType='number-pad' placeholder='—' placeholderTextColor={colors.textSecondaryDark} />
										</View>
									))}
								</View>
							)}
						</View>
					))}
				</View>

				{/* ── Comentario ── */}
				<View style={[styles.section, { paddingTop: 0 }]}>
					<Text style={styles.sectionTitle}>
						Comentario <Text style={local.optional}>(opcional)</Text>
					</Text>
					<TextInput style={[styles.textArea, { minHeight: 80 }]} value={notes} onChangeText={setNotes} placeholder='Cómo estuvo el partido...' placeholderTextColor={colors.textSecondaryDark} multiline maxLength={280} />
				</View>

				{isEditingExisting && (
					<View style={[styles.section, { paddingTop: 0 }]}>
						<TouchableOpacity style={local.deleteButton} onPress={handleDelete} disabled={saving}>
							<Ionicons name='trash-outline' size={18} color={colors.error} />
							<Text style={local.deleteButtonText}>Borrar resultado</Text>
						</TouchableOpacity>
					</View>
				)}
			</ScrollView>

			<View style={styles.footer}>
				<TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handleSave} disabled={saving}>
					{saving ? (
						<ActivityIndicator color={colors.backgroundDark} />
					) : (
						<>
							<Ionicons name='checkmark-circle' size={22} color={colors.backgroundDark} />
							<Text style={styles.submitButtonText}>{isEditingExisting ? 'Guardar cambios' : 'Guardar resultado'}</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}

const local = StyleSheet.create({
	matchTitle: {
		...typography.h3,
		color: colors.textPrimaryDark,
	},
	matchSub: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginTop: 2,
	},
	hint: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		marginBottom: spacing.md,
	},
	optional: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontWeight: '400',
	},
	empty: {
		...typography.body,
		color: colors.textSecondaryDark,
		fontStyle: 'italic',
	},
	winnerRow: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	winnerButton: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.borderDark,
		backgroundColor: colors.surfaceDark,
	},
	winnerButtonActive: {
		backgroundColor: `${colors.primary}18`,
		borderColor: colors.primary,
	},
	winnerButtonText: {
		...typography.body,
		color: colors.textSecondaryDark,
		fontWeight: '600',
	},
	drawButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.borderDark,
		backgroundColor: colors.surfaceDark,
	},
	scoreRow: {
		flexDirection: 'row',
		gap: spacing.md,
	},
	scoreBox: {
		flex: 1,
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.md,
		alignItems: 'center',
		gap: 4,
	},
	scoreLabel: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	scoreInput: {
		...typography.h3,
		color: colors.textPrimaryDark,
		textAlign: 'center',
		minWidth: 56,
		paddingVertical: 4,
	},
	scoreSeparator: {
		...typography.h4,
		color: colors.textSecondaryDark,
	},
	setRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		paddingHorizontal: spacing.md,
		marginBottom: spacing.sm,
	},
	setLabel: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		width: 46,
	},
	setRemove: {
		marginLeft: 'auto',
		padding: spacing.xs,
	},
	addSetButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		alignSelf: 'flex-start',
		paddingVertical: spacing.xs,
	},
	addSetText: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '600',
	},
	playerCard: {
		backgroundColor: colors.surfaceDark,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.borderDark,
		padding: spacing.md,
		marginBottom: spacing.sm,
		gap: spacing.sm,
	},
	playerCardExcluded: {
		opacity: 0.55,
	},
	playerHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
	},
	playerAvatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
	},
	playerAvatarPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	playerAvatarInitial: {
		color: 'white',
		fontWeight: '700',
	},
	playerName: {
		...typography.body,
		color: colors.textPrimaryDark,
		fontWeight: '600',
	},
	playerSub: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
	},
	outcomeRow: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	outcomeChip: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		borderColor: colors.borderDark,
	},
	outcomeChipText: {
		...typography.bodySmall,
		color: colors.textSecondaryDark,
		fontWeight: '600',
	},
	metricsRow: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	metricBox: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: colors.backgroundDark,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.borderDark,
		paddingVertical: spacing.xs,
	},
	metricLabel: {
		fontSize: 11,
		color: colors.textSecondaryDark,
	},
	metricInput: {
		...typography.body,
		color: colors.textPrimaryDark,
		textAlign: 'center',
		minWidth: 44,
		paddingVertical: 2,
	},
	deleteButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: `${colors.error}40`,
		backgroundColor: `${colors.error}12`,
	},
	deleteButtonText: {
		...typography.body,
		color: colors.error,
		fontWeight: '600',
	},
})
