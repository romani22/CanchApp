import { View, Text, ScrollView } from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import PlayerAvatar from "@/components/PlayerAvatar";

export default function MatchDetail() {
    return (
        <View className="flex-1 bg-background-dark">
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                <Text className="text-white text-2xl font-bold px-4 pt-6">
                    Sábado 14 de Octubre
                </Text>

                <View className="flex-row gap-3 px-4 mt-6">
                    <PlayerAvatar name="Martín" />
                    <PlayerAvatar name="Elena" />
                    <PlayerAvatar name="Fran" />
                </View>

                <View className="px-4 mt-6">
                    <Text className="text-white/70">
                        Nivel intermedio. Llegar 15 minutos antes.
                    </Text>
                </View>
            </ScrollView>

            <View className="absolute bottom-6 left-4 right-4">
                <PrimaryButton label="Solicitar unirse" />
            </View>
        </View>
    );
}
