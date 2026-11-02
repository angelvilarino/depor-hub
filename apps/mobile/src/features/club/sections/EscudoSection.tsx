import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { ClubImage } from '@/components/club/ClubImage';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT, CrestVersionT } from '@/data/schemas';
import { crestYearRange } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SectionTitle } from './ui';

export function EscudoSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<CrestVersionT | null>(null);
  const modalSize = Math.max(160, Math.min(width - 96, 360));

  if (club.crests.length === 0) {
    return <EmptyState message={t('club.escudo.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionTitle>{t('club.escudo.introTitle')}</SectionTitle>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
          {t('club.escudo.intro')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('club.escudo.zoomHint')}</Text>
      </Card>

      <View style={styles.timeline}>
        {club.crests.map((crest, index) => {
          const first = index === 0;
          const last = index === club.crests.length - 1;
          const years = crestYearRange(crest, t('club.escudo.present'));
          const name = t('club.escudo.versionName', { years });
          return (
            <View key={crest.id} style={styles.row}>
              <View style={styles.rail}>
                {!first ? <View style={[styles.line, styles.lineTop, { backgroundColor: colors.border }]} /> : null}
                {!last ? <View style={[styles.line, styles.lineBottom, { backgroundColor: colors.border }]} /> : null}
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('club.viewImage', { name })}
                onPress={() => setSelected(crest)}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <ClubImage path={crest.image} label={name} width={92} height={92} />
                <View style={styles.text}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{years}</Text>
                  {crest.description ? (
                    <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
                      {crest.description}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="expand-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setSelected(null)}
            style={StyleSheet.absoluteFill}
          />
          {selected ? (
            <View
              accessibilityViewIsModal
              style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <ClubImage
                path={selected.image}
                label={t('club.escudo.versionName', {
                  years: crestYearRange(selected, t('club.escudo.present')),
                })}
                width={modalSize}
                height={modalSize}
              />
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
                {crestYearRange(selected, t('club.escudo.present'))}
              </Text>
              {selected.description ? (
                <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                  {selected.description}
                </Text>
              ) : null}
              <Button label={t('common.close')} onPress={() => setSelected(null)} />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 22, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 2, left: 10 },
  lineTop: { top: 0, height: '50%' },
  lineBottom: { bottom: 0, height: '50%' },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: spacing.xs },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
