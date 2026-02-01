import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { styles } from './Register.styles'; // Importación de estilos externos
import { colors } from '@/theme/colors';

const sports = [
    { id: 'futbol', label: 'Fútbol', icon: 'soccer' },
    { id: 'tenis', label: 'Tenis', icon: 'tennis' },
    { id: 'padel', label: 'Pádel', icon: 'human-handsup' }, // O el icono que prefieras
    { id: 'basquet', label: 'Básquet', icon: 'basketball' },
];

const levels = ['Principiante', 'Intermedio', 'Pro'];

export default function Register() {
    const [selectedSports, setSelectedSports] = useState(['futbol']);
    const [level, setLevel] = useState('Intermedio');

    const toggleSport = (id: string) => {
        setSelectedSports(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={colors.borderDark} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registro</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.mainTitle}>Crea tu perfil deportivo</Text>
                <Text style={styles.subtitle}>
                    Únete para competir y reservar turnos en los mejores clubes.
                </Text>

                {/* Formulario */}
                <View style={styles.formSection}>
                    <Text style={styles.inputLabel}>Nombre completo</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. Juan Pérez"
                        placeholderTextColor={colors.primary}
                    />

                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="usuario@ejemplo.com"
                        placeholderTextColor={colors.primary}
                        keyboardType="email-address"
                    />

                    <Text style={styles.inputLabel}>Contraseña</Text>
                    <View style={styles.passwordWrapper}>
                        <TextInput
                            style={styles.inputInner}
                            placeholder="Mínimo 8 caracteres"
                            placeholderTextColor={colors.primary}
                            secureTextEntry
                        />
                        <Ionicons name="eye-off-outline" size={20} color={colors.primary} />
                    </View>

                    {/* Deportes Favoritos */}
                    <Text style={styles.inputLabel}>Deportes Favoritos</Text>
                    <View style={styles.sportsContainer}>
                        {sports.map((sport) => (
                            <TouchableOpacity
                                key={sport.id}
                                onPress={() => toggleSport(sport.id)}
                                style={[
                                    styles.sportChip,
                                    selectedSports.includes(sport.id) && styles.sportChipActive
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name={sport.icon as any}
                                    size={18}
                                    color={
                                        selectedSports.includes(sport.id)
                                            ? colors.backgroundDark  // Icono oscuro si está seleccionado
                                            : colors.sports[sport.id as keyof typeof colors.sports] || colors.textPrimaryDark // Color del deporte si no
                                    }
                                />
                                <Text style={[
                                    styles.sportChipText,
                                    selectedSports.includes(sport.id) && styles.sportChipTextActive
                                ]}>
                                    {sport.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Nivel */}
                    <Text style={styles.inputLabel}>Tu Nivel</Text>
                    <View style={styles.levelSelector}>
                        {levels.map((l) => (
                            <TouchableOpacity
                                key={l}
                                onPress={() => setLevel(l)}
                                style={[styles.levelOption, level === l && styles.levelOptionActive]}
                            >
                                <Text style={[styles.levelText, level === l && styles.levelTextActive]}>
                                    {l}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Zona de Juego */}
                    <Text style={styles.inputLabel}>Zona de Juego</Text>
                    <View style={styles.footerLinks}>
                        <Ionicons name="location" size={20} color={colors.primary} />
                        <TextInput
                            style={styles.inputInner}
                            placeholder="Buscar ciudad o barrio"
                            placeholderTextColor={colors.primary}
                        />
                    </View>
                </View>

                {/* Botón Acción */}
                <TouchableOpacity style={styles.submitButton}>
                    <Text style={styles.submitButtonText}>Crear Cuenta</Text>
                </TouchableOpacity>

                <View style={styles.footerLinks}>
                    <Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>
                    <TouchableOpacity>
                        <Text style={styles.linkText}>Inicia sesión</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.legalText}>
                    Al registrarte, aceptas nuestros <Text style={styles.footerLinks}>Términos de Servicio</Text> y <Text style={styles.footerLinks}>Política de Privacidad</Text>.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}