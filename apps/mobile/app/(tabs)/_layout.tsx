import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: { name: string; key: string; icon: IconName }[] = [
  { name: 'index', key: 'home', icon: 'home-outline' },
  { name: 'team', key: 'team', icon: 'people-outline' },
  { name: 'calendar', key: 'calendar', icon: 'calendar-outline' },
  { name: 'news', key: 'news', icon: 'newspaper-outline' },
  { name: 'club', key: 'club', icon: 'shield-outline' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerRightContainerStyle: { paddingRight: spacing.sm },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerRight: () => <SettingsHeaderAction />,
      }}
    >
      {TABS.map(({ name, key, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`tabs.${key}`),
            tabBarIcon: ({ focused, size }) => (
              <Ionicons name={icon} size={size} color={focused ? colors.primary : colors.textMuted} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

export function SettingsHeaderAction() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      testID="settings-header-button"
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
      onPress={() => router.push('/settings')}
      style={{
        width: minTouch,
        height: minTouch,
        borderRadius: minTouch / 2,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="settings-outline" size={22} color={colors.text} />
    </Pressable>
  );
}
