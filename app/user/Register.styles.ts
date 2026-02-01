import { StyleSheet } from 'react-native';
import { colors } from '@/theme/colors'; // Ajusta la ruta según tu proyecto
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    headerTitle: {
        ...typography.h4,
        color: colors.textPrimaryDark,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingBottom: 40,
    },
    mainTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.textPrimaryDark,
        marginTop: spacing.lg,
    },
    subtitle: {
        ...typography.body,
        color: colors.primary, // Usamos tu verde neón #30e87a
        marginTop: spacing.xs,
        marginBottom: spacing.xl,
    },
    formSection: {
        gap: spacing.md,
    },
    inputLabel: {
        ...typography.bodySmall,
        color: colors.textPrimaryDark,
        fontWeight: '600',
        marginTop: spacing.sm,
    },
    input: {
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderDark,
        padding: spacing.md,
        color: colors.textPrimaryDark,
        height: 56,
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderDark,
        paddingHorizontal: spacing.md,
        height: 56,
    },
    inputInner: {
        flex: 1,
        marginLeft: spacing.sm,
        color: colors.textPrimaryDark,
    },
    sportsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    sportChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderDark,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    sportChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    sportChipText: {
        color: colors.textPrimaryDark,
        fontWeight: '600',
    },
    sportChipTextActive: {
        color: colors.backgroundDark, // Texto oscuro sobre fondo verde neón
    },
    levelSelector: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.xl,
        padding: 4,
        marginTop: spacing.xs,
    },
    levelOption: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: borderRadius.lg,
    },
    levelOptionActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Un leve resalte para el nivel
        borderWidth: 1,
        borderColor: colors.borderDark,
    },
    levelText: {
        color: colors.textSecondaryDark,
        fontWeight: '600',
    },
    levelTextActive: {
        color: colors.primary, // El nivel seleccionado resalta en verde
    },
    submitButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        // Sombra para el botón estilo neón
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    submitButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.backgroundDark,
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    footerText: {
        color: colors.textSecondaryDark,
    },
    linkText: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    legalText: {
        fontSize: 12,
        color: colors.textSecondaryDark,
        textAlign: 'center',
        marginTop: spacing.xl,
        lineHeight: 18,
    }
});