import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { DataProvider } from '@/data/DataProvider';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import i18n, { resolveLanguage } from '@/i18n';
import { markStartup } from '@/perf/startup';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();
markStartup('layout'); // F3-14: primera marca, al evaluar el layout raíz

/** F3-02: cualquier enlace profundo vuelve a una ruta real. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/** F3-02: un error de render en cualquier pantalla muestra recuperación, no blanco. */
export const ErrorBoundary = RouteErrorBoundary;

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);
  const [cacheReady, setCacheReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    DeporDisplay: require('../assets/fonts/BarlowCondensed-SemiBold.ttf'),
    DeporHeadline: require('../assets/fonts/SourceSerif4-SemiBold.ttf'),
    DeporBody: require('../assets/fonts/Inter-Regular.ttf'),
  });

  // F3-03: el splash no se oculta hasta tener fuentes y caché restaurada.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    markStartup('fonts');
    if (!cacheReady) return;
    void SplashScreen.hideAsync();
    markStartup('splash');
  }, [cacheReady, fontError, fontsLoaded]);

  useEffect(() => {
    void i18n.changeLanguage(resolveLanguage(language));
  }, [language]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DataProvider
        onHydrated={() => {
          markStartup('cache');
          setCacheReady(true);
        }}
      >
        <ReminderSync />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{ presentation: 'modal', title: t('settings.title') }}
          />
          <Stack.Screen name="match/[id]" options={{ title: t('match.title') }} />
          <Stack.Screen
            name="player/[id]"
            options={{ title: t('player.title'), headerBackTitle: t('tabs.team') }}
          />
          <Stack.Screen
            name="coach"
            options={{ title: t('coach.title'), headerBackTitle: t('tabs.team') }}
          />
          <Stack.Screen name="rival/[teamId]" options={{ title: t('home.rivalProfile') }} />
          <Stack.Screen
            name="club/[section]"
            options={{ title: t('tabs.club'), headerBackTitle: t('tabs.club') }}
          />
          <Stack.Screen
            name="club/himno/[id]"
            options={{ title: t('club.sections.himnos.title'), headerBackTitle: t('tabs.club') }}
          />
          <Stack.Screen name="about" options={{ presentation: 'modal', title: t('about.title') }} />
        </Stack>
      </DataProvider>
    </GestureHandlerRootView>
  );
}
