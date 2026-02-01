import { View, Text, TouchableOpacity } from "react-native";

export default function MatchCard() {
    return (
        <View className="bg-white/5 rounded-xl mx-4 mt-4 p-4">
            <Text className="text-white text-lg font-bold">
                Pádel - Mixto
            </Text>
            <Text className="text-white/60 mt-1">
                Hoy · 20:00 · Palermo
            </Text>

            <TouchableOpacity className="mt-4 bg-primary rounded-full h-10 items-center justify-center">
                <Text className="text-black font-bold">Unirme</Text>
            </TouchableOpacity>
        </View>
    );
}
