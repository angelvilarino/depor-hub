import type { TFunction } from 'i18next';

/** Las claves de i18next no admiten '.' ni ':' en el nombre: en ese caso se muestra el original. */
export function countryLabel(t: TFunction, name: string): string {
  if (/[.:]/.test(name)) return name;
  return String(t(`country.${name}`, { defaultValue: name }));
}
