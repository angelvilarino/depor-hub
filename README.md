# Depor Hub (no oficial)
Proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D.

## Requisitos
Node >= 22.13, git. Copia `DEPOR_HUB_CONTEXTO.md` a `docs/CONTEXTO.md`.

## Primera vez
```bash
./setup.sh          # crea apps/mobile (Expo SDK estable), superpone la plantilla, instala y ejecuta lint/typecheck/tests
npm run mobile      # arranca Expo
```
Para probar en iPhone con un SDK recién salido, Expo Go de la App Store puede ir por detrás: usa un development build (EAS) o `eas go`.

## Secretos
Ver `.env.example`. El token de football-data.org vive solo en GitHub Secrets (`FOOTBALL_DATA_TOKEN`). **La app no contiene claves.**

## Estado
H0 (andamiaje) hecho. Siguiente: H1 (contratos y datos).
