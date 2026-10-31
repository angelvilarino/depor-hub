import { DEFAULT_REMINDER_OFFSETS, migrateSettings } from '@/store/settings';

describe('migrateSettings', () => {
  it('convierte remindMatchIds en remindMatches con los avisos por defecto', () => {
    const migrated = migrateSettings({ remindMatchIds: [1, 2] }, 0);
    expect(migrated.remindMatches).toEqual({
      1: [...DEFAULT_REMINDER_OFFSETS],
      2: [...DEFAULT_REMINDER_OFFSETS],
    });
    expect(migrated.remindMatchIds).toBeUndefined();
    expect(migrated.defaultReminderOffsets).toEqual([...DEFAULT_REMINDER_OFFSETS]);
  });

  it('ignora ids corruptos y no pisa un mapa nuevo', () => {
    const migrated = migrateSettings({ remindMatchIds: [1, 'x'], remindMatches: { 9: [15] } }, 0);
    expect(migrated.remindMatches).toEqual({ 9: [15] });
  });

  it('no toca los datos ya migrados', () => {
    const persisted = {
      remindMatches: { 3: [60] },
      defaultReminderOffsets: [60],
      remindMatchIds: [3],
    };
    expect(migrateSettings(persisted, 1)).toEqual(persisted);
  });

  it('rellena los avisos por defecto si faltan', () => {
    const migrated = migrateSettings({ theme: 'dark' }, 0);
    expect(migrated.defaultReminderOffsets).toEqual([...DEFAULT_REMINDER_OFFSETS]);
  });
});
