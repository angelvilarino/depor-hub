import type { z } from 'zod';
import { DATA_BASE_URL } from '@/config';

export type DataErrorKind = 'not_configured' | 'network' | 'http' | 'invalid';

export class DataError extends Error {
  constructor(
    public kind: DataErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

/** Descarga un JSON público, lo valida con Zod y devuelve datos tipados. Nunca devuelve datos sin validar. */
export async function fetchData<T extends z.ZodType>(
  name: string,
  schema: T,
  baseUrl: string = DATA_BASE_URL,
  timeoutMs = 15000,
): Promise<z.output<T>> {
  if (!baseUrl) {
    throw new DataError('not_configured', 'EXPO_PUBLIC_DATA_BASE_URL no está definida');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/${name}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    throw new DataError('network', e instanceof Error ? e.message : 'Error de red');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new DataError('http', `HTTP ${res.status} en ${name}`);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new DataError('invalid', `${name}: JSON inválido`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new DataError('invalid', `${name}: ${parsed.error.issues[0]?.message ?? 'no cumple el esquema'}`);
  }
  return parsed.data;
}
