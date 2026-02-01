import { TouchableOpacity, Text } from "react-native";

export default function PrimaryButton({ label }: { label: string }) {
    return (
        <TouchableOpacity className="bg-primary h-14 rounded-full items-center justify-center">
            <Text className="text-black text-lg font-bold">{label}</Text>
        </TouchableOpacity>
    );
}
