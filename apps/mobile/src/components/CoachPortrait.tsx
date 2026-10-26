import { Image } from 'expo-image';
import { useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

/**
 * Retrato del entrenador con degradación segura (ADR 0014).
 *
 * La foto oficial se enlaza desde el CDN del club; si falta o falla la carga se usa
 * el avatar de iniciales, igual que en la plantilla.
 */
export function CoachPortrait({ name, photoUrl, size = 64 }: Props) {
  // Se guarda la URL que falló, no un booleano: al cambiar de foto el estado se
  // reinicia solo y no hace falta un efecto que provoque renders en cascada.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl !== null && failedUrl === photoUrl;

  if (!photoUrl || failed) {
    return <PlayerAvatar id={0} name={name} size={size} />;
  }

  return (
    <Image
      accessible
      accessibilityLabel={name}
      cachePolicy="memory-disk"
      contentFit="cover"
      contentPosition="top"
      onError={() => setFailedUrl(photoUrl)}
      recyclingKey={`coach-${photoUrl}-${size}`}
      source={{ uri: photoUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      transition={150}
    />
  );
}
