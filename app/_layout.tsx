import "../global.css";
import { AuthProvider } from '@/context/AuthContext';
import { Slot } from "expo-router";
import {MatchProvider} from "@/context/MatchContext";

export default function RootLayout() {
    return (
        <AuthProvider>
            <MatchProvider>
                <Slot />
            </MatchProvider>
        </AuthProvider>
    );
}
