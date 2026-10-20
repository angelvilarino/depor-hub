import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText, Card, Screen } from '@/components/Screen';
import type { LanguagePreference } from '@/i18n';
import { type ThemePreference, useSettings } from '@/store/settings';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function Chips<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {props.options.map((o) => {
        const selected = o.value === props.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => props.onChange(o.value)}
            style={[
              styles.chip,
              { backgroundColor: selected ? colors.primary : colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = useSettings();
  return (
    <Screen>
      <Card>
        <BodyText>{t('settings.theme')}</BodyText>
        <Chips<ThemePreference>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </Card>
      <Card>
        <BodyText>{t('settings.language')}</BodyText>
        <Chips<LanguagePreference>
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'system', label: t('settings.languageSystem') },
            { value: 'es', label: 'Español' },
            { value: 'gl', label: 'Galego' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>
      <Card>
        <BodyText muted>
          {t('settings.version')}: {Constants.expoConfig?.version ?? '—'}
        </BodyText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
