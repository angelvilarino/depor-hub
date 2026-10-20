import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProvider } from '@/data/DataProvider';
import i18n, { resolveLanguage } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);

  useEffect(() => {
    void i18n.changeLanguage(resolveLanguage(language));
  }, [language]);

  return (
    <DataProvider>
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
      </Stack>
    </DataProvider>
  );
}
