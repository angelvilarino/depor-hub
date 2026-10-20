import { useTranslation } from 'react-i18next';
import { BodyText, Card, Screen } from './Screen';

// Pantalla provisional de H0; cada hito la sustituye por la real.
export function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <Card>
        <BodyText>{t(titleKey)}</BodyText>
        <BodyText muted>{t('common.comingSoon')}</BodyText>
      </Card>
    </Screen>
  );
}
