import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import type { MatchT } from '@/data/schemas';
import { offsetLabel, REMINDER_OFFSETS } from '@/features/reminders/plan';
import type { SaveReminderResult } from '@/features/home/useMatchActions';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatReminderDateTime } from '@/utils/matchTime';

type Props = {
  visible: boolean;
  onClose: () => void;
  match: MatchT;
  initialOffsets: number[];
  reminded: boolean;
  remindable: boolean;
  remindersEnabled: boolean;
  onSave: (offsets: number[]) => Promise<SaveReminderResult>;
  onRemove: () => void;
  onEnableReminders: () => void;
  onOpenSettings: () => void;
};

/** Hoja inferior de recordatorios: opciones múltiples, vista previa y estado del permiso. */
export function ReminderSheet({
  visible,
  onClose,
  match,
  initialOffsets,
  reminded,
  remindable,
  remindersEnabled,
  onSave,
  onRemove,
  onEnableReminders,
  onOpenSettings,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number[]>(initialOffsets);
  const [denied, setDenied] = useState(false);
  const [now] = useState(() => Date.now());

  const start = Date.parse(match.utcDate);
  const isPast = (offset: number) => start - offset * 60_000 <= now;
  const toggle = (offset: number) => {
    if (isPast(offset)) return;
    setSelected((current) =>
      current.includes(offset) ? current.filter((value) => value !== offset) : [...current, offset],
    );
  };
  const previews = [...selected]
    .sort((a, b) => b - a)
    .map((offset) => formatReminderDateTime(new Date(start - offset * 60_000).toISOString(), i18n.language));

  const save = async () => {
    if (!remindable) return;
    const result = await onSave(selected);
    if (result === 'saved') onClose();
    else setDenied(true);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
              {t('reminder.title')}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>{t('reminder.explanation')}</Text>

            {!remindersEnabled ? (
              <View style={[styles.notice, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{t('reminder.globalOff')}</Text>
                <Button variant="secondary" label={t('reminder.enable')} onPress={onEnableReminders} />
              </View>
            ) : null}

            {!remindable ? (
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>{t('reminder.tbc')}</Text>
            ) : null}

            <View style={styles.chips}>
              {REMINDER_OFFSETS.map((offset) => {
                const past = isPast(offset);
                const checked = selected.includes(offset);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: past || !remindable }}
                    disabled={past || !remindable}
                    key={offset}
                    onPress={() => toggle(offset)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: checked ? colors.primary : colors.surface,
                        borderColor: checked ? colors.primary : colors.border,
                        opacity: past || !remindable ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: checked ? colors.onPrimary : colors.text,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    >
                      {offsetLabel(offset, t)}
                    </Text>
                    {past ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('reminder.past')}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
              {t('reminder.previewTitle')}
            </Text>
            {previews.length > 0 ? (
              previews.map((preview) => (
                <Text key={preview} style={{ color: colors.textMuted, fontSize: 14 }}>
                  {preview}
                </Text>
              ))
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('reminder.previewEmpty')}</Text>
            )}

            {denied ? (
              <View style={[styles.notice, { borderColor: colors.danger }]}>
                <Text style={{ color: colors.danger, fontSize: 15 }}>{t('reminder.permissionDenied')}</Text>
                <Button variant="secondary" label={t('reminder.openSettings')} onPress={onOpenSettings} />
              </View>
            ) : null}

            <Button
              disabled={!remindable || selected.length === 0}
              label={t('reminder.save')}
              onPress={() => void save()}
            />
            {reminded ? (
              <Button
                variant="secondary"
                label={t('reminder.remove')}
                onPress={() => {
                  onRemove();
                  onClose();
                }}
              />
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  content: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
});
