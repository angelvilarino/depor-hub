import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { DataProvider } from '@/data/DataProvider';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import i18n, { resolveLanguage } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);
  const [fontsLoaded, fontError] = useFonts({
    DeporDisplay: require('../assets/fonts/BarlowCondensed-SemiBold.ttf'),
    DeporHeadline: require('../assets/fonts/SourceSerif4-SemiBold.ttf'),
    DeporBody: require('../assets/fonts/Inter-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    void i18n.changeLanguage(resolveLanguage(language));
  }, [language]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DataProvider>
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
          <Stack.Screen name="settings" options={{ presentation: 'modal', title: t('settings.title') }} />
          <Stack.Screen name="match/[id]" options={{ title: t('match.title') }} />
          <Stack.Screen name="player/[id]" options={{ title: t('player.title'), headerBackTitle: t('tabs.team') }} />
          <Stack.Screen name="coach" options={{ title: t('coach.title'), headerBackTitle: t('tabs.team') }} />
          <Stack.Screen name="rival/[teamId]" options={{ title: t('home.rivalProfile') }} />
        </Stack>
      </DataProvider>
    </GestureHandlerRootView>
  );
}
