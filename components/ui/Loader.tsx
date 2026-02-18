import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

export default function Loader() {
	const scale = useSharedValue(1)

	useEffect(() => {
		scale.value = withRepeat(withTiming(1.5, { duration: 800 }), -1, true)
	}, [])

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}))

	return (
		<View className='flex-1 items-center justify-center bg-white'>
			<Animated.View style={animatedStyle} className='w-16 h-16 bg-green-500 rounded-full' />
		</View>
	)
}
