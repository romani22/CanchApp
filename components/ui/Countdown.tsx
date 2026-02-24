import { styles } from '@/assets/styles/Dashboard.styles'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

export default function Countdown({ date }: { date: string }) {
	const [targetDate, setTargetDate] = useState<Date | null>(null)
	const [countdown, setCountdown] = useState({
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

			const totalHours = Math.floor(distance / (1000 * 60 * 60))
			const minutes = Math.floor((distance / (1000 * 60)) % 60)
			const seconds = Math.floor((distance / 1000) % 60)

			setCountdown({
				hours: totalHours,
				minutes,
				seconds,
			})
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
