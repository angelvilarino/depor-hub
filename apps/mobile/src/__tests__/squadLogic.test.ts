import { Squad } from '@/data/schemas';
import type { PlayerT } from '@/data/schemas';
import {
  AVATAR_COLORS,
  ageFrom,
  avatarColor,
  formatPartialDate,
  groupSquad,
  initials,
  pendingFields,
  positionGroup,
} from '@/features/squad/logic';
import { contrastRatio } from '@/utils/contrast';

const player = (over: Partial<PlayerT> = {}): PlayerT => ({
  id: 1,
  name: 'Jugador Uno',
  position: 'Midfield',
  dateOfBirth: '2000-01-31',
  nationality: 'Spain',
  shirtNumber: null,
  contractUntil: null,
  heightCm: null,
  ...over,
});

describe('positionGroup', () => {
  it.each([
    ['Goalkeeper', 'GK'],
    ['Defence', 'DF'],
    ['Centre-Back', 'DF'],
    ['Midfield', 'MF'],
    ['Defensive Midfield', 'MF'],
    ['Offence', 'FW'],
    ['Left Winger', 'FW'],
    [null, 'OTHER'],
    ['Coach', 'OTHER'],
  ])('%s -> %s', (pos, group) => {
    expect(positionGroup(pos)).toBe(group);
  });
});

describe('groupSquad', () => {
  it('agrupa en orden portero/defensa/centro/delantero y omite grupos vacíos', () => {
    const groups = groupSquad([
      player({ id: 1, name: 'Delta', position: 'Offence' }),
      player({ id: 2, name: 'Zeta', position: 'Goalkeeper' }),
      player({ id: 3, name: 'Beta', position: 'Midfield' }),
      player({ id: 4, name: 'Alfa', position: 'Midfield' }),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['GK', 'MF', 'FW']);
    expect(groups[1]?.data.map((p) => p.name)).toEqual(['Alfa', 'Beta']);
  });

  it('con dorsal va primero y ascendente; sin dorsal, por nombre', () => {
    const [mf] = groupSquad([
      player({ id: 1, name: 'Ana' }),
      player({ id: 2, name: 'Zoe', shirtNumber: 10 }),
      player({ id: 3, name: 'Eva', shirtNumber: 4 }),
    ]);
    expect(mf?.data.map((p) => p.id)).toEqual([3, 2, 1]);
  });
});

describe('ageFrom', () => {
  const now = Date.UTC(2026, 9, 22, 12, 0, 0);
  it('antes y después del cumpleaños', () => {
    expect(ageFrom('2000-10-23', now)).toBe(25);
    expect(ageFrom('2000-10-22', now)).toBe(26);
    expect(ageFrom('2000-01-31', now)).toBe(26);
  });
  it('29 de febrero', () => {
    expect(ageFrom('2000-02-29', Date.UTC(2026, 1, 28))).toBe(25);
    expect(ageFrom('2000-02-29', Date.UTC(2026, 2, 1))).toBe(26);
  });
  it('dato ausente, inválido o futuro -> null', () => {
    expect(ageFrom(null, now)).toBeNull();
    expect(ageFrom('1998', now)).toBeNull();
    expect(ageFrom('2030-01-01', now)).toBeNull();
  });
});

describe('formatPartialDate', () => {
  it('año, mes y día completo', () => {
    expect(formatPartialDate('2028', 'es')).toBe('2028');
    expect(formatPartialDate('2028-06', 'en')).toContain('2028');
    expect(formatPartialDate('2028-06-30', 'en')).toContain('30');
  });
  it('null y texto desconocido', () => {
    expect(formatPartialDate(null, 'es')).toBeNull();
    expect(formatPartialDate('junio 2028', 'es')).toBe('junio 2028');
  });
});

describe('pendingFields', () => {
  it('lista lo que falta, en orden estable', () => {
    expect(pendingFields(player())).toEqual(['shirtNumber', 'heightCm', 'contractUntil']);
  });
  it('un jugador completo no tiene pendientes', () => {
    const full = player({ shirtNumber: 8, heightCm: 180, contractUntil: '2028-06-30' });
    expect(pendingFields(full)).toEqual([]);
  });
  it('caché antigua sin heightCm cuenta como pendiente', () => {
    const old = { ...player(), heightCm: undefined } as unknown as PlayerT;
    expect(pendingFields(old)).toContain('heightCm');
  });
});

describe('avatar', () => {
  it('iniciales', () => {
    expect(initials('Pierre-Emerick Aubameyang')).toBe('PA');
    expect(initials('Peke')).toBe('PE');
    expect(initials('  ')).toBe('?');
  });
  it('color estable y con contraste AA frente a blanco', () => {
    expect(avatarColor(42)).toBe(avatarColor(42));
    expect(avatarColor(-7)).toBeDefined();
    AVATAR_COLORS.forEach((c) => expect(contrastRatio('#FFFFFF', c)).toBeGreaterThanOrEqual(4.5));
  });
});

describe('contrato Squad', () => {
  it('JSON publicado antes del ADR 0007 (sin heightCm) valida y da null', () => {
    const old: Record<string, unknown> = { ...player() };
    delete old.heightCm;
    const r = Squad.safeParse({ updatedAt: '2026-10-20T10:00:00Z', coach: null, players: [old] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.players[0]?.heightCm).toBeNull();
  });
});
