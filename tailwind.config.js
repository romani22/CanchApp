/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0b0b0b",
        foreground: "#ffffff",

        card: "#111111",
        cardForeground: "#ffffff",

        popover: "#111111",
        popoverForeground: "#ffffff",

        primary: "#22c55e",
        primaryForeground: "#000000",

        secondary: "#27272a",
        secondaryForeground: "#ffffff",

        muted: "#3f3f46",
        mutedForeground: "#a1a1aa",

        accent: "#3f3f46",
        accentForeground: "#ffffff",

        destructive: "#ef4444",
        destructiveForeground: "#ffffff",

        border: "#1f1f1f",
        input: "#1f1f1f",
        ring: "#22c55e",

        chart1: "#f97316",
        chart2: "#06b6d4",
        chart3: "#6366f1",
        chart4: "#84cc16",
        chart5: "#ec4899",

        sidebar: "#0f0f0f",
        sidebarForeground: "#ffffff",
        sidebarPrimary: "#22c55e",
        sidebarPrimaryForeground: "#000000",
        sidebarAccent: "#27272a",
        sidebarAccentForeground: "#ffffff",
        sidebarBorder: "#1f1f1f",
        sidebarRing: "#22c55e",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
    },
  },
  plugins: [],
}

