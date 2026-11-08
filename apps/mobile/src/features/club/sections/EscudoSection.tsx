import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { ClubImage } from '@/components/club/ClubImage';
import { MediaCredit } from '@/components/club/Editorial';
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
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<CrestVersionT | null>(null);
  const [comparisonIndex, setComparisonIndex] = useState<number | null>(null);
  const modalSize = Math.max(160, Math.min(width - 32, height - 200, 640));

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
          const nextCrest = club.crests[index + 1];
          const years = crestYearRange(crest, t('club.escudo.present'));
          const name = t('club.escudo.versionName', { years });
          return (
            <View key={crest.id} style={styles.row}>
              <View style={styles.rail}>
                {!first ? <View style={[styles.line, styles.lineTop, { backgroundColor: colors.border }]} /> : null}
                {!last ? <View style={[styles.line, styles.lineBottom, { backgroundColor: colors.border }]} /> : null}
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.entry}>
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
                {crest.media ? <MediaCredit media={crest.media} inline /> : null}
                {!last && nextCrest ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('club.escudo.compareTransition', {
                      before: years,
                      after: crestYearRange(nextCrest, t('club.escudo.present')),
                    })}
                    onPress={() => setComparisonIndex(index)}
                    style={styles.compareAction}
                  >
                    <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {t('club.escudo.compare')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {comparisonIndex !== null && club.crests[comparisonIndex + 1] ? (
        <Card>
          <SectionTitle>{t('club.escudo.comparisonTitle')}</SectionTitle>
          <View style={styles.comparisonRow}>
            {club.crests.slice(comparisonIndex, comparisonIndex + 2).map(
              (crest, index) => {
                const years = crestYearRange(crest, t('club.escudo.present'));
                return (
                  <View key={crest.id} style={styles.comparisonVersion}>
                    <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>
                      {t(index === 0 ? 'club.escudo.before' : 'club.escudo.after', { years })}
                    </Text>
                    <ClubImage
                      path={crest.image}
                      label={t('club.escudo.versionName', { years })}
                      width={Math.min(110, (width - spacing.lg * 3) / 2)}
                      height={Math.min(110, (width - spacing.lg * 3) / 2)}
                    />
                    {crest.description ? (
                      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                        {crest.description}
                      </Text>
                    ) : null}
                    {crest.media ? <MediaCredit media={crest.media} inline /> : null}
                  </View>
                );
              },
            )}
          </View>
        </Card>
      ) : null}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        presentationStyle="overFullScreen"
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
              testID="crest-fullscreen-viewer"
              style={[styles.fullscreenViewer, { backgroundColor: colors.surface }]}
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
              {selected.media ? <MediaCredit media={selected.media} inline /> : null}
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
  entry: { flex: 1, gap: spacing.xs },
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
  compareAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.sm },
  comparisonVersion: { flex: 1, alignItems: 'center', gap: spacing.xs },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenViewer: {
    width: '100%',
    height: '100%',
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
