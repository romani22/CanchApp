import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: "#0b0b0b" },
                tabBarActiveTintColor: "#22c55e",
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Inicio",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="my-matches"
                options={{
                    title: "Mis Turnos",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="calendar-today" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: "Explorar",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="search" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: "Notificaciones",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="notifications" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="person" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
