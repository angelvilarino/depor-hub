import { Image } from 'expo-image';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { PlayerT } from '@/data/schemas';

/**
 * Retrato del jugador con degradación segura.
 *
 * ADR 0009: la foto oficial del club (primera de `player.photos`) sustituye al avatar de
 * iniciales. Si no hay foto, la URL falla o el formato no se puede decodificar, se vuelve
 * al avatar generado.
 */

/** El CDN del club publica `-small` (192 px, ~43 KB) además de `-large` (~1,1 MB). */
function portraitUrl(url: string): string {
  try {
    if (new URL(url).hostname === 'cdn.bff.rcdeportivo.app') {
      return url.replace('-large', '-small');
    }
  } catch {
    // URL no absoluta: se usa tal cual.
  }
  return url;
}

export function PlayerPortrait({ player, size = 44 }: { player: PlayerT; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = player.photos?.[0];
  if (!photo || failed) {
    return <PlayerAvatar id={player.id} name={player.name} size={size} />;
  }
  return (
    <Image
      accessible
      accessibilityLabel={player.name}
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition="top"
      onError={() => setFailed(true)}
      source={{ uri: portraitUrl(photo.url) }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      transition={150}
    />
  );
}
