import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
	background: {
		flex: 1,
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.6)',
	},
	container: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	content: {
		alignItems: 'center',
	},
	title: {
		fontSize: 26,
		fontWeight: '700',
		color: '#fff',
		textAlign: 'center',
		marginBottom: 12,
	},
	subtitle: {
		fontSize: 16,
		color: '#d1d5db',
		textAlign: 'center',
		marginBottom: 30,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.7)',
		borderRadius: 14,
		paddingHorizontal: 15,
		paddingVertical: 14,
		width: '100%',
		marginBottom: 20,
	},
	input: {
		flex: 1,
		color: '#fff',
		fontSize: 16,
	},
	button: {
		backgroundColor: '#22c55e',
		paddingVertical: 16,
		borderRadius: 16,
		width: '100%',
		alignItems: 'center',
		marginBottom: 20,
	},
	buttonText: {
		color: '#000',
		fontSize: 16,
		fontWeight: '600',
	},
	backText: {
		color: '#d1d5db',
		fontSize: 14,
	},
})
