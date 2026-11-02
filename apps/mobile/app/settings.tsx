import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BodyText, Card, Screen } from '@/components/Screen';
import { clearPersistedDataCache } from '@/data/persister';
import { useMeta } from '@/data/queries';
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

function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { theme, language, remindersEnabled, setTheme, setLanguage, setRemindersEnabled } = useSettings();
  const meta = useMeta();
  const [clearing, setClearing] = useState(false);

  const clearCache = async () => {
    setClearing(true);
    try {
      await clearPersistedDataCache();
    } catch {
      setClearing(false);
      Alert.alert(t('settings.clearCacheError'));
      return;
    }
    setClearing(false);
  };

  const confirmClearCache = () => {
    Alert.alert(t('settings.clearCacheConfirmTitle'), t('settings.clearCacheConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clearCacheConfirmAction'),
        style: 'destructive',
        onPress: () => {
          void clearCache();
        },
      },
    ]);
  };

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
        <BodyText>{t('settings.reminders')}</BodyText>
        <Chips<'on' | 'off'>
          value={remindersEnabled ? 'on' : 'off'}
          onChange={(v) => setRemindersEnabled(v === 'on')}
          options={[
            { value: 'on', label: t('settings.remindersOn') },
            { value: 'off', label: t('settings.remindersOff') },
          ]}
        />
      </Card>

      <Card>
        <BodyText>{t('settings.data')}</BodyText>
        <View style={styles.infoRow}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('settings.dataVersion')}</Text>
          <Text selectable style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
            {meta.data?.dataHash ?? '—'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('settings.dataUpdatedAt')}</Text>
          <Text style={{ color: colors.text, fontSize: 14 }}>
            {meta.data ? formatDateTime(meta.data.updatedAt, i18n.language) : '—'}
          </Text>
        </View>
        <BodyText muted>{t('settings.clearCacheHint')}</BodyText>
        <Button
          label={clearing ? t('settings.clearCacheBusy') : t('settings.clearCache')}
          onPress={confirmClearCache}
          disabled={clearing}
          variant="secondary"
        />
      </Card>

      <Card>
        <BodyText muted>
          {t('settings.version')}: {Constants.expoConfig?.version ?? '—'}
        </BodyText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.about')}
          onPress={() => router.push('/about')}
          style={styles.linkRow}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              {t('settings.about')}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('settings.aboutHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
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
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  linkRow: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
