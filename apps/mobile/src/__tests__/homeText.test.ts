import i18n from '@/i18n';
import { competitionLabel } from '@/features/home/text';
import { capitalizeFirst } from '@/utils/text';

describe('texto de la Home', () => {
  it('traduce la competición por código y cae al nombre de la API', async () => {
    await i18n.changeLanguage('es');
    expect(competitionLabel('PD', 'Primera Division', i18n.t)).toBe('Primera División');
    expect(competitionLabel('XX', 'Liga inventada', i18n.t)).toBe('Liga inventada');
    expect(competitionLabel(null, 'Primera Division', i18n.t)).toBe('Primera Division');
  });

  it('capitaliza respetando el idioma', () => {
    expect(capitalizeFirst('lunes, 2 de noviembre', 'es')).toBe('Lunes, 2 de noviembre');
    expect(capitalizeFirst('luns, 2 de novembro', 'gl')).toBe('Luns, 2 de novembro');
    expect(capitalizeFirst('', 'es')).toBe('');
  });
});
