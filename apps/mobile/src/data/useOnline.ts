import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}
