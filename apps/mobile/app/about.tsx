import Constants from 'expo-constants';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import licenses from '@/data/licenses.json';
import { spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

type PackageEntry = { name: string; version: string };
type LicenseGroup = { license: string; count: number; packages: PackageEntry[] };
type LicenseSection = { title: string; count: number; data: PackageEntry[] };

const ISSUES_URL = 'https://github.com/angelvilarino/depor-hub/issues';
const GROUPS = licenses.licenses as LicenseGroup[];

export default function AboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  const sections: LicenseSection[] = GROUPS.map((group) => ({
    title: group.license,
    count: group.count,
    data: group.packages,
  }));

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => `${item.name}@${item.version}`}
      stickySectionHeadersEnabled={false}
      initialNumToRender={20}
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <Card>
            <Text
              accessibilityRole="header"
              style={{ color: colors.text, ...text.display, fontWeight: '800' }}
            >
              {t('about.app')}
            </Text>
            <Text style={{ color: colors.textMuted, ...text.bodyLarge }}>
              {t('about.version', { version })}
            </Text>
            <Text style={{ color: colors.text, ...text.bodyLarge, lineHeight: 22 }}>
              {t('common.unofficial')}
            </Text>
            <Text style={{ color: colors.textMuted, ...text.body, lineHeight: 21 }}>
              {t('about.mission')}
            </Text>
          </Card>

          <Card>
            <Text style={{ color: colors.text, ...text.subtitle, fontWeight: '700' }}>
              {t('about.contact')}
            </Text>
            <Text style={{ color: colors.textMuted, ...text.body }}>{t('about.contactHint')}</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('about.contactLink')}
              onPress={() => void openExternal(ISSUES_URL)}
              style={styles.link}
            >
              <Text style={{ color: colors.primary, ...text.bodyLarge, fontWeight: '600' }}>
                {t('about.contactLink')}
              </Text>
            </Pressable>
          </Card>

          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, ...text.title, fontWeight: '800' }}>
              {t('about.licenses')}
            </Text>
            <Text style={{ color: colors.textMuted, ...text.body, lineHeight: 20 }}>
              {t('about.licensesIntro', {
                count: licenses.count,
                groups: licenses.licenses.length,
              })}
            </Text>
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
          <Text accessibilityRole="header" style={{ color: colors.text, ...text.bodyLarge, fontWeight: '800' }}>
            {section.title}
          </Text>
          <Text style={{ color: colors.textMuted, ...text.caption }}>{section.count}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={{ color: colors.text, ...text.body, flex: 1 }} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={{ color: colors.textMuted, ...text.caption }}>{item.version}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  link: { minHeight: 44, justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
});
