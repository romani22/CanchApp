import { View, Text } from "react-native";

export default function TopBar({ title }: { title: string }) {
    return (
        <View className="pt-14 pb-4 px-4 bg-background-dark">
            <Text className="text-white text-lg font-bold text-center">
                {title}
            </Text>
        </View>
    );
}
