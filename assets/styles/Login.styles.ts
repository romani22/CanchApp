import { borderRadius, colors } from '@/theme/colors'; // Ajusta la ruta según tu proyecto
import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
	background: {
		flex: 1,
		width: '100%',
		height: '100%',
	},
	container: {
		flex: 1,
		backgroundColor: colors.BackgroundLogin,
	},
	backgroundGradient: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 300,
	},
	keyboardView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingHorizontal: 24,
		paddingBottom: 40,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.secondary,
		alignItems: 'center',
		justifyContent: 'center',
		marginTop: 16,
	},
	logoContainer: {
		alignItems: 'center',
		marginTop: 40,
		marginBottom: 24,
	},
	logoBox: {
		width: 72,
		height: 72,
		borderRadius: borderRadius.xl,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.foreground,
		textAlign: 'center',
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: colors.mutedForeground,
		textAlign: 'center',
		marginBottom: 32,
	},
	form: {
		flex: 1,
	},
	fieldContainer: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: '500',
		color: colors.foreground,
		marginBottom: 8,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.input,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 16,
		height: 56,
	},
	inputIcon: {
		marginRight: 12,
	},
	input: {
		flex: 1,
		fontSize: 16,
		color: colors.foreground,
	},
	eyeButton: {
		padding: 4,
	},
	forgotPassword: {
		alignSelf: 'flex-end',
		marginBottom: 24,
	},
	forgotPasswordText: {
		fontSize: 14,
		color: colors.primary,
	},
	loginButton: {
		backgroundColor: colors.primary,
		borderRadius: borderRadius.lg,
		height: 56,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 24,
	},
	loginButtonText: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.primaryForeground,
	},
	dividerContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 24,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: colors.border,
	},
	dividerText: {
		fontSize: 12,
		color: colors.mutedForeground,
		marginHorizontal: 16,
	},
	googleButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.secondary,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		height: 56,
		marginBottom: 24,
	},
	googleIcon: {
		fontSize: 20,
		fontWeight: '700',
		color: colors.foreground,
		marginRight: 8,
	},
	googleButtonText: {
		fontSize: 16,
		fontWeight: '500',
		color: colors.foreground,
	},
	registerContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
	},
	registerText: {
		fontSize: 14,
		color: colors.mutedForeground,
	},
	registerLink: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.primary,
	},
})
