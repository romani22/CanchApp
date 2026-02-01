import {useState, useEffect} from "react";
import {
    View,
    Text,
    TextInput,
    ImageBackground,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from "react-native";
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from "@expo/vector-icons";
import {router} from 'expo-router';


const images = [
    require("../../assets/images/cancha_basquet.png"),
    require("../../assets/images/cancha_futbol.png"),
    require("../../assets/images/cancha_padle.png"),
    require("../../assets/images/cancha_tenis.png"),
];
// Colors from tailwind.config
const colors = {
    background: "#0b0b0b",
    foreground: "#ffffff",
    card: "#111111",
    cardForeground: "#ffffff",
    primary: "#22c55e",
    primaryForeground: "#000000",
    secondary: "#27272a",
    secondaryForeground: "#ffffff",
    muted: "#3f3f46",
    mutedForeground: "#a1a1aa",
    border: "#1f1f1f",
    input: "#1f1f1f",
    ring: "#22c55e",
};

const borderRadius = {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 14,
};
import {supabase} from '@/lib/supabase'


export default function LoginScreen({navigation}: { navigation?: any }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % images.length);
        }, 4000); // 4 segundos

        return () => clearInterval(interval);
    }, []);
    const handleLogin = () => {
        testConnection()
    };

    const testConnection = async () => {
        const {data, error} = await supabase
            .from('profiles') // o cualquier tabla real
            .select('*')
            .limit(1)
        console.log('DATA:', data)
        console.log('ERROR:', error)
    }

    const handleGoogleLogin = () => {
        console.log("Google login");
    };

    return (
        <ImageBackground
            source={images[index]}
            style={styles.background}
            resizeMode="cover"
        >
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.background}/>

                <View style={styles.backgroundGradient}/>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Back Button */}
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation?.goBack()}
                        >
                            <Ionicons name="chevron-back" size={24} color={colors.foreground}/>
                        </TouchableOpacity>

                        {/* Logo */}
                        <View style={styles.logoContainer}>
                            <View style={styles.logoBox}>
                                <Ionicons
                                    name="football-outline"
                                    size={40}
                                    color={colors.primaryForeground}
                                />
                            </View>
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>Bienvenido de nuevo</Text>
                        <Text style={styles.subtitle}>
                            Accede a tu cuenta para gestionar tus turnos
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Email Field */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Email</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons
                                        name="mail-outline"
                                        size={20}
                                        color={colors.mutedForeground}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="ejemplo@correo.com"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {/* Password Field */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Contraseña</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={colors.mutedForeground}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-outline" : "eye-off-outline"}
                                            size={20}
                                            color={colors.mutedForeground}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Forgot Password */}
                            <TouchableOpacity style={styles.forgotPassword}>
                                <Text style={styles.forgotPasswordText}>
                                    ¿Olvidaste tu contraseña?
                                </Text>
                            </TouchableOpacity>

                            {/* Login Button */}
                            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine}/>
                                <Text style={styles.dividerText}>O CONTINUAR CON</Text>
                                <View style={styles.dividerLine}/>
                            </View>

                            {/* Google Button */}
                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleLogin}
                            >
                                <Text style={styles.googleIcon}>G</Text>
                                <Text style={styles.googleButtonText}>Google</Text>
                            </TouchableOpacity>

                            {/* Register Link */}
                            <View style={styles.registerContainer}>
                                <Text style={styles.registerText}>¿No tienes una cuenta? </Text>
                                <TouchableOpacity onPress={() => router.push('../user/Register')}>
                                    <Text style={styles.registerLink}>Regístrate</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: "rgba(179,179,179,0.18)"
    },
    backgroundGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 300
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
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
    },
    logoContainer: {
        alignItems: "center",
        marginTop: 40,
        marginBottom: 24,
    },
    logoBox: {
        width: 72,
        height: 72,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.foreground,
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.mutedForeground,
        textAlign: "center",
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
        fontWeight: "500",
        color: colors.foreground,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
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
        alignSelf: "flex-end",
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
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.primaryForeground,
    },
    dividerContainer: {
        flexDirection: "row",
        alignItems: "center",
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        height: 56,
        marginBottom: 24,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.foreground,
        marginRight: 8,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: "500",
        color: colors.foreground,
    },
    registerContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    registerText: {
        fontSize: 14,
        color: colors.mutedForeground,
    },
    registerLink: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.primary,
    },
});
