import { SportType } from '@/types/database.types'

const sportImages: Record<SportType, any[]> = {
	futbol: [require('@/assets/images/sports/Futbol 1.jpg'), require('@/assets/images/sports/Futbol 2.jpg'), require('@/assets/images/sports/Futbol 3.jpg')],
	padel: [require('@/assets/images/sports/Padel 1.jpg'), require('@/assets/images/sports/Padel 2.jpg'), require('@/assets/images/sports/Padel 3.jpg')],
	tenis: [require('@/assets/images/sports/Tenis 1.jpg'), require('@/assets/images/sports/Tenis 2.jpg')],
	basquet: [require('@/assets/images/sports/Basquet 2.png'), require('@/assets/images/sports/Basquet 3.jpg')],
	voley: [require('@/assets/images/sports/Voleibol 1.jpg'), require('@/assets/images/sports/Voleibol 2.jpg')],
}
export const getSportImage = (sport: SportType) => {
	const images = sportImages[sport]

	const randomIndex = Math.floor(Math.random() * images.length)

	return images[randomIndex]
}
