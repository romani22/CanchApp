import { styles } from '@/assets/styles/Dashboard.styles'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

export default function Countdown({ date }: { date: string }) {
	const [targetDate, setTargetDate] = useState<Date | null>(null)
	const [countdown, setCountdown] = useState({
		days: 0,
		hours: 0,
		minutes: 0,
		seconds: 0,
	})

	const formatNumber = (num: number) => num.toString().padStart(2, '0')

	// 🔥 Actualiza targetDate cuando cambia la prop
	useEffect(() => {
		if (!date) {
			setTargetDate(null)
			return
		}

		setTargetDate(new Date(date))
	}, [date])

	// 🔥 Timer
	useEffect(() => {
		if (!targetDate) {
			setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
			return
		}

		const timer = setInterval(() => {
			const now = new Date()
			// Ajuste de -3 horas para Argentina, se suma porque el objetivo es mostrar el tiempo restante en horario de Argentina
			const distance = targetDate.getTime() - now.getTime() + 3 * 60 * 60 * 1000
			if (distance <= 0) {
				clearInterval(timer)
				setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
				return
			}
			//fecha de argentina (-3 horas)

			const days = Math.floor(distance / (1000 * 60 * 60) / 24)
			const totalHours = Math.floor((distance / (1000 * 60 * 60)) % 24)
			const minutes = Math.floor((distance / (1000 * 60)) % 60)
			const seconds = Math.floor((distance / 1000) % 60)

			setCountdown({
				days,
				hours: totalHours,
				minutes,
				seconds,
			})
		}, 1000)

		return () => clearInterval(timer)
	}, [targetDate])

	return (
		<View style={styles.countdownContainer}>
			{countdown.days > 0 && (
				<View style={styles.countdownItem}>
					<View style={[styles.countdownBox, { minWidth: 50 }]}>
						<Text style={styles.countdownNumber}>{formatNumber(countdown.days)}</Text>
					</View>
					<Text style={styles.countdownLabel}>DÍAS</Text>
				</View>
			)}
			<View style={styles.countdownItem}>
				<View style={[countdown.days > 0 ? { minWidth: 50 } : { minWidth: 95 }, styles.countdownBox]}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.hours)}</Text>
				</View>
				<Text style={styles.countdownLabel}>HORAS</Text>
			</View>

			<View style={styles.countdownItem}>
				<View style={[countdown.days > 0 ? { minWidth: 50 } : { minWidth: 95 }, styles.countdownBox]}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.minutes)}</Text>
				</View>
				<Text style={styles.countdownLabel}>MINS</Text>
			</View>

			<View style={styles.countdownItem}>
				<View style={[countdown.days > 0 ? { minWidth: 50 } : { minWidth: 95 }, styles.countdownBox]}>
					<Text style={styles.countdownNumber}>{formatNumber(countdown.seconds)}</Text>
				</View>
				<Text style={styles.countdownLabel}>SEGS</Text>
			</View>
		</View>
	)
}
