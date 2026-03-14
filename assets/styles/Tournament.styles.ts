import { StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
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
    headerActionText: {
        ...typography.body,
        color: colors.textPrimaryDark,
    },
    headerTitle: {
        ...typography.h4,
        color: colors.textPrimaryDark,
        fontWeight: 'bold',
    },
    stepContainer: {
        alignItems: 'flex-end',
    },
    stepLabel: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    stepValue: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    section: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimaryDark,
        marginBottom: spacing.md,
    },
    inputLabel: {
        ...typography.bodySmall,
        color: colors.textSecondaryDark,
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    input: {
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.borderDark,
        padding: spacing.md,
        color: colors.textPrimaryDark,
        height: 56,
    },
    sportsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    sportCard: {
        width: '23%',
        aspectRatio: 1,
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.borderDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sportCardActive: {
        borderColor: colors.primary,
    },
    sportLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: colors.textPrimaryDark,
        marginTop: 4,
    },
    sportLabelActive: {
        color: colors.primary,
    },
    formatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    formatCardActive: {
        borderColor: colors.primary,
    },
    formatIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.borderDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    formatIconActive: {
        backgroundColor: colors.primary,
    },
    formatInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    formatTitle: {
        ...typography.body,
        fontWeight: 'bold',
        color: colors.textPrimaryDark,
    },
    formatDesc: {
        ...typography.bodySmall,
        color: colors.textSecondaryDark,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.borderDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterActive: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    launchButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    launchButtonText: {
        ...typography.buttonLarge,
        color: colors.backgroundDark,
        fontWeight: 'bold',
    },
    launchHint: {
        fontSize: 10,
        color: colors.textSecondaryDark,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.borderDark,
        paddingHorizontal: spacing.md,
        height: 56,
        marginBottom: spacing.md,
    },
    inputInner: {
        flex: 1,
        marginLeft: spacing.sm,
        color: colors.textPrimaryDark,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sliderValue: {
        color: colors.primary,
        fontWeight: 'bold',
        fontSize: 18,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderLimitText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: colors.textSecondaryDark,
    },
    textArea: {
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.borderDark,
        padding: spacing.md,
        color: colors.textPrimaryDark,
        minHeight: 100,
    }
});