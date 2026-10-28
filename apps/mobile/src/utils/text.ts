/** Capitaliza la primera letra respetando las reglas del idioma (p. ej. «lunes» → «Lunes»). */
export function capitalizeFirst(text: string, locale: string): string {
  if (!text) return text;
  const chars = Array.from(text);
  const first = chars[0] ?? '';
  return `${first.toLocaleUpperCase(locale)}${chars.slice(1).join('')}`;
}
