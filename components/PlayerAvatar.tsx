import { View, Text, Image } from "react-native";

type Props = {
    name?: string;
    avatarUrl?: string;
    empty?: boolean;
};

export default function PlayerAvatar({
                                         name,
                                         avatarUrl,
                                         empty = false,
                                     }: Props) {
    if (empty) {
        return (
            <View className="items-center gap-2 w-16">
                <View className="h-14 w-14 rounded-full border-2 border-dashed border-white/20 items-center justify-center bg-white/5">
                    <Text className="text-white/30 text-xl">+</Text>
                </View>
                <Text className="text-[11px] text-white/30">Libre</Text>
            </View>
        );
    }

    return (
        <View className="items-center gap-2 w-16">
            <View className="h-14 w-14 rounded-full border-2 border-primary overflow-hidden">
                {avatarUrl ? (
                    <Image
                        source={{ uri: avatarUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="h-full w-full bg-primary items-center justify-center">
                        <Text className="text-black font-bold text-lg">
                            {name?.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            {name && (
                <Text className="text-[11px] text-white/80 font-medium" numberOfLines={1}>
                    {name}
                </Text>
            )}
        </View>
    );
}
