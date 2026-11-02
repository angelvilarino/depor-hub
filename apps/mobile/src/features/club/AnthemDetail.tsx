import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { AnthemT } from '@/data/schemas';
import { anthemKindKey, anthemShareText, creditRoleKey } from '@/features/club/logic';
import { SectionTitle, Tag } from '@/features/club/sections/ui';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function AnthemDetail({ anthem }: { anthem: AnthemT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const meta = [anthem.year?.toString(), anthem.authors.join(', ')].filter(Boolean).join(' · ');

  const share = async () => {
    try {
      await Share.share({ message: anthemShareText(anthem), title: anthem.title });
    } catch {
      Alert.alert(t('club.himnos.shareError'));
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>
          {anthem.title}
        </Text>
        <View style={styles.tags}>
          <Tag>{t(anthemKindKey(anthem.kind))}</Tag>
          {meta ? <Tag>{meta}</Tag> : null}
        </View>
        {anthem.description ? (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            {anthem.description}
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t('club.himnos.lyrics')}</SectionTitle>
        {anthem.lyrics ? (
          <>
            <Text
              selectable
              maxFontSizeMultiplier={2}
              style={{ color: colors.text, fontSize: 18, lineHeight: 28 }}
            >
              {anthem.lyrics}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t('club.himnos.readHint')}
            </Text>
            <Button label={t('club.himnos.share')} onPress={() => void share()} />
          </>
        ) : (
          <EmptyState message={t('club.himnos.noLyrics')} />
        )}
      </Card>

      {anthem.credits.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.himnos.credits')}</SectionTitle>
          {anthem.credits.map((credit, index) => (
            <View key={`${credit.role}-${index}`} style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                {t(creditRoleKey(credit.role))}
              </Text>
              {credit.names.map((name) => (
                <Text key={name} style={{ color: colors.text, fontSize: 15 }}>
                  {name}
                </Text>
              ))}
              {credit.text ? (
                <Text style={{ color: colors.text, fontSize: 15 }}>{credit.text}</Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
