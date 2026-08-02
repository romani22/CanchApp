// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions: código Deno, no de la app. Sus imports jsr: no se
    // resuelven con el resolver de Node y disparaban import/no-unresolved.
    // .expo: tipos de rutas generados por expo-router en cada arranque.
    ignores: ['dist/*', '.expo/**', 'supabase/functions/**'],
  },
]);
