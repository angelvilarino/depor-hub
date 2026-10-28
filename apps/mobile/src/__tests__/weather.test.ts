import { venueCoords } from '@/features/home/venues';
import {
  madridDate,
  pickWeather,
  weatherEligible,
  weatherKey,
} from '@/features/home/weather';

describe('tiempo en la sede', () => {
  it('solo consulta con hora confirmada, coordenadas y menos de 16 días', () => {
    const now = Date.parse('2026-10-25T10:00:00Z');
    const kickoff = Date.parse('2026-11-02T20:00:00Z');
    expect(weatherEligible('TIMED', kickoff, now, true)).toBe(true);
    expect(weatherEligible('SCHEDULED', kickoff, now, true)).toBe(false);
    expect(weatherEligible('TIMED', kickoff, now, false)).toBe(false);
    expect(weatherEligible('TIMED', now + 17 * 86_400_000, now, true)).toBe(false);
    expect(weatherEligible('TIMED', now - 1, now, true)).toBe(false);
  });

  it('elige la hora local de Madrid más cercana al inicio', () => {
    const payload = {
      hourly: {
        time: ['2026-11-02T20:00', '2026-11-02T21:00', '2026-11-02T22:00'],
        temperature_2m: [15.4, 16.6, 17],
        precipitation_probability: [10, 20, 30],
        wind_speed_10m: [8.2, 12.4, 14],
        weather_code: [2, 3, 61],
      },
    };
    expect(pickWeather(payload, '2026-11-02T20:00:00Z')).toEqual({
      temperatureC: 17,
      precipitationProbability: 20,
      windKmh: 12,
      code: 3,
      hour: '2026-11-02T21:00',
    });
  });

  it('no inventa tiempo si no hay datos para el día', () => {
    expect(pickWeather({}, '2026-11-02T20:00:00Z')).toBeNull();
    expect(
      pickWeather(
        {
          hourly: {
            time: ['2026-11-03T21:00'],
            temperature_2m: [16],
            weather_code: [1],
          },
        },
        '2026-11-02T20:00:00Z',
      ),
    ).toBeNull();
    expect(
      pickWeather(
        {
          hourly: {
            time: ['2026-11-02T21:00'],
            temperature_2m: [null],
            weather_code: [1],
          },
        },
        '2026-11-02T20:00:00Z',
      ),
    ).toBeNull();
  });

  it('traduce los códigos WMO a grupos estables', () => {
    expect(weatherKey(0)).toBe('clear');
    expect(weatherKey(3)).toBe('cloudy');
    expect(weatherKey(45)).toBe('fog');
    expect(weatherKey(53)).toBe('drizzle');
    expect(weatherKey(63)).toBe('rain');
    expect(weatherKey(75)).toBe('snow');
    expect(weatherKey(81)).toBe('showers');
    expect(weatherKey(95)).toBe('storm');
    expect(weatherKey(999)).toBe('unknown');
  });

  it('calcula la fecha de Madrid y solo conoce coordenadas verificadas', () => {
    expect(madridDate('2026-11-02T20:00:00Z')).toBe('2026-11-02');
    expect(venueCoords('Estadio Abanca-Riazor')?.latitude).toBeCloseTo(43.3686);
    expect(venueCoords('Camp Nou')).toBeNull();
    expect(venueCoords(null)).toBeNull();
  });
});
