import { mapUrl } from '@/features/home/maps';

describe('mapUrl', () => {
  it('usa Apple Maps en iOS y geo: en Android', () => {
    expect(mapUrl('Estadio Abanca-Riazor', 'ios')).toBe(
      'http://maps.apple.com/?q=Estadio%20Abanca-Riazor',
    );
    expect(mapUrl('Estadio Abanca-Riazor', 'android')).toBe(
      'geo:0,0?q=Estadio%20Abanca-Riazor',
    );
  });

  it('codifica sedes con caracteres especiales', () => {
    expect(mapUrl('Campo & Anexo', 'android')).toBe('geo:0,0?q=Campo%20%26%20Anexo');
  });
});
