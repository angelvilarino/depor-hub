import type { MatchT } from '@/data/schemas';
import { hasConfirmedTime } from './matchTime';

const CRLF = '\r\n';
const EXCLUDED = new Set(['POSTPONED', 'CANCELLED', 'SUSPENDED']);
const MATCH_MS = 2 * 60 * 60 * 1000;

const p2 = (n: number) => String(n).padStart(2, '0');
const dateOnly = (d: Date) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
const utcStamp = (d: Date) =>
  `${dateOnly(d)}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

export const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Pliega líneas largas (RFC 5545). Aproxima por caracteres, no por octetos. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join(CRLF);
}

export type IcsOptions = {
  venue?: string | null; // respaldo: sede del Depor si el partido no trae sede y juega en casa
  matchdayLabel: (n: number) => string;
  tbcLabel: string;
};

export function buildIcs(matches: MatchT[], nowIso: string, opts: IcsOptions): string {
  const stamp = utcStamp(new Date(nowIso));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Depor Hub//Calendario (no oficial)//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Depor Hub',
  ];
  for (const m of matches) {
    if (EXCLUDED.has(m.status)) continue;
    const start = new Date(m.utcDate);
    const timed = hasConfirmedTime(m.status);
    const desc = [m.matchday !== null ? opts.matchdayLabel(m.matchday) : null, timed ? null : opts.tbcLabel]
      .filter(Boolean)
      .join(' · ');
    lines.push('BEGIN:VEVENT', `UID:match-${m.id}@deporhub`, `DTSTAMP:${stamp}`);
    if (timed) {
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + MATCH_MS))}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${dateOnly(start)}`,
        `DTEND;VALUE=DATE:${dateOnly(new Date(start.getTime() + 86_400_000))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(`${m.home.shortName ?? m.home.name} - ${m.away.shortName ?? m.away.name}`)}`);
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
    const location = m.venue ?? (m.deporIsHome ? opts.venue : null);
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
