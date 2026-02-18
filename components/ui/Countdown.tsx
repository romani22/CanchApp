import { styles } from '@/assets/styles/Dashboard.styles'
import { supabase } from '@/lib/supabase'
import { matchesService } from '@/services/matches.service'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

export default function Countdown() {
	const [targetDate, setTargetDate] = useState<Date | null>(null)
	const [countdown, setCountdown] = useState({
		hours: 0,
		minutes: 0,
		seconds: 0,
	})

	const formatNumber = (num: number) => num.toString().padStart(2, '0')

	// 🔥 Traer próximo partido
	useEffect(() => {
		const loadNextMatch = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) return

			const { data } = await matchesService.getNextMatchForUser(user.id)

			if (data?.date) {
				setTargetDate(new Date(data.date))
			} else {
				setTargetDate(null)
			}
		}

		loadNextMatch()
	}, [])

	// 🔥 Timer real basado en fecha
	useEffect(() => {
		if (!targetDate) {
			setCountdown({ hours: 0, minutes: 0, seconds: 0 })
			return
		}

		const timer = setInterval(() => {
			const now = new Date().getTime()
			const distance = targetDate.getTime() - now

			if (distance <= 0) {
				clearInterval(timer)
				setCountdown({ hours: 0, minutes: 0, seconds: 0 })
				return
			}

			const hours = Math.floor((distance / (1000 * 60 * 60)) % 24)
			const minutes = Math.floor((distance / (1000 * 60)) % 60)
			const seconds = Math.floor((distance / 1000) % 60)

			setCountdown({ hours, minutes, seconds })
		}, 1000)

		return () => clearInterval(timer)
	}, [targetDate])

	return (
		<View style={styles.countdownContainer}>
			<View style={styles.countdownItem}>
				<View style={styles.countdownBox}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.hours)}</Text>
				</View>
				<Text style={styles.countdownLabel}>HORAS</Text>
			</View>

			<View style={styles.countdownItem}>
				<View style={styles.countdownBox}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.minutes)}</Text>
				</View>
				<Text style={styles.countdownLabel}>MINS</Text>
			</View>

			<View style={styles.countdownItem}>
				<View style={styles.countdownBox}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.seconds)}</Text>
				</View>
				<Text style={styles.countdownLabel}>SEGS</Text>
			</View>
		</View>
	)
}
