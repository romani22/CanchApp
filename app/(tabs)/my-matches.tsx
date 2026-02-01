import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { useAuth } from '@/context/AuthContext';
import { getUserCreatedMatches, getUserParticipatingMatches } from '@/services/matches.service';
import { MatchWithCreator } from '@/types/database.types';
import { MatchCard } from '@/components/match/MatchCard';

type Tab = 'created' | 'joined';

export default function MyMatchesScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('created');
    const [createdMatches, setCreatedMatches] = useState<MatchWithCreator[]>([]);
    const [joinedMatches, setJoinedMatches] = useState<MatchWithCreator[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadMatches = useCallback(async () => {
        if (!user) return;

        try {
            const [created, joined] = await Promise.all([
                getUserCreatedMatches(user.id),
                getUserParticipatingMatches(user.id),
            ]);

            setCreatedMatches(created);
            // Filter out matches the user created from joined list
            setJoinedMatches(joined.filter(m => m.creator_id !== user.id));
        } catch (error) {
            console.error('Error loading matches:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        loadMatches();
    }, [loadMatches]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadMatches();
    };

    const handleMatchPress = (match: MatchWithCreator) => {
        router.push(`/match/${match.id}`);
    };

    const matches = activeTab === 'created' ? createdMatches : joinedMatches;

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons
                name={activeTab === 'created' ? 'add-circle-outline' : 'search-outline'}
                size={64}
                color={colors.textSecondaryDark}
            />
            <Text style={styles.emptyTitle}>
                {activeTab === 'created'
                    ? 'No has creado partidos'
                    : 'No te has unido a ningun partido'}
            </Text>
            <Text style={styles.emptyText}>
                {activeTab === 'created'
                    ? 'Crea tu primer partido y encuentra jugadores'
                    : 'Explora los partidos disponibles y unete'}
            </Text>
            <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                    if (activeTab === 'created') {
                        router.push("/match/create");
                    } else {
                        // @ts-ignore
                        router.push('/(tabs)');
                    }
                }}
            >
                <Ionicons
                    name={activeTab === 'created' ? 'add' : 'compass'}
                    size={20}
                    color={colors.backgroundDark}
                />
                <Text style={styles.emptyButtonText}>
                    {activeTab === 'created' ? 'Crear Partido' : 'Explorar'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderItem = useCallback(
        ({ item }: { item: MatchWithCreator }) => (
            <MatchCard
                match={item}
                onPress={() => handleMatchPress(item)}
            />
        ),
        []
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Turnos</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'created' && styles.tabActive]}
                        onPress={() => setActiveTab('created')}
                    >
                        <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
                            Creados ({createdMatches.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'joined' && styles.tabActive]}
                        onPress={() => setActiveTab('joined')}
                    >
                        <Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]}>
                            Unidos ({joinedMatches.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/match/create')}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color={colors.backgroundDark} />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/tournament/create')}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color={colors.backgroundDark} />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDark,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    headerTitle: {
        ...typography.h2,
        color: colors.textPrimaryDark,
    },
    tabsContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceDark,
        borderRadius: borderRadius.full,
        padding: 4,
    },
    tab: {
        flex: 1,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.full,
    },
    tabActive: {
        backgroundColor: colors.backgroundDark,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: {
        ...typography.labelLarge,
        color: colors.textSecondaryDark,
    },
    tabTextActive: {
        color: colors.primary,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 100,
        flexGrow: 1,
    },
    separator: {
        height: spacing.lg,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['5xl'],
        gap: spacing.md,
    },
    emptyTitle: {
        ...typography.h4,
        color: colors.textPrimaryDark,
        marginTop: spacing.md,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondaryDark,
        textAlign: 'center',
        maxWidth: 280,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginTop: spacing.lg,
    },
    emptyButtonText: {
        ...typography.button,
        color: colors.backgroundDark,
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
});
