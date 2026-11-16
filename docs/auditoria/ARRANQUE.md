# Protocolo de arranque (F3-14)

Objetivo: que un arranque en frío en un dispositivo de gama media quede por
debajo de 2,5 s en p95. Este documento define qué se mide, cómo se repite y
dónde se anotan los resultados.

## Qué se mide

Un **arranque en frío** es la primera apertura de la app después de
`am force-stop`: proceso muerto, caché de datos ya hidratada en disco y red
disponible. No es una reapertura desde segundo plano.

La app registra cinco marcas con `performance.mark` y las guarda en memoria
(`apps/mobile/src/perf/startup.ts`). Los tiempos son milisegundos desde que se
evalúa el módulo.

| Marca | Dónde se toma | Qué cierra |
|---|---|---|
| `layout` | `app/_layout.tsx`, al evaluar el módulo | arranque del bundle y del router |
| `fonts` | efecto de `useFonts` | fuentes listas (o con error) |
| `cache` | `onHydrated` de `DataProvider` | caché persistida restaurada |
| `splash` | tras `SplashScreen.hideAsync()` | primer frame visible |
| `home` | efecto de `app/(tabs)/index.tsx` | primer render de la portada |

En desarrollo se imprime una única línea por arranque:

```bash
adb logcat -s ReactNativeJS:I | grep '\[startup\]'
# [startup] {"layout":42,"fonts":310,"cache":420,"splash":455,"home":471}
```

Esas marcas explican **dónde** se va el tiempo; el número que se compara con el
objetivo es el arranque completo, que incluye la parte nativa. En un APK de
release las marcas no se imprimen (`__DEV__` es `false`), así que el protocolo
usa la medida del sistema.

## Cómo se repite

Requisitos: APK del perfil `preview` (datos de producción), un Android de gama
media y `adb` en el `PATH`.

```bash
# 1. Instalar el APK descargado de EAS
adb install -r depor-hub-preview.apk

# 2. Diez arranques en frío, con dos segundos entre uno y otro
for i in $(seq 10); do
  adb shell am force-stop com.deporhub.app
  sleep 2
  adb shell am start -W -n com.deporhub.app/.MainActivity | grep TotalTime
done > arranque.txt

# 3. p50/p95 (sale con 1 si p95 > 2.500 ms)
node scripts/startup-report.mjs arranque.txt
```

Condiciones para que las tandas sean comparables: misma red, brillo y volumen
fijos, batería por encima del 20 % y sin cargador, y ninguna otra app pesada en
primer plano. Se anota el modelo del dispositivo y la versión de Android.

## Resultados

| Fecha | Dispositivo | Android | Medidas | p50 | p95 | Veredicto |
|---|---|---|---:|---:|---:|---|
| — | pendiente de dispositivo físico | — | — | — | — | **sin medir** |

Las marcas están instrumentadas y el comando es reproducible, pero este
entorno no tiene un dispositivo de gama media donde ejecutar la tanda: un
emulador o un simulador no representan el objetivo. La tabla se rellena con la
primera tanda real; hasta entonces el criterio de F3-14 queda **parcialmente
cumplido** (instrumentación y protocolo sí, informe de medidas no).

## Interpretación

- `splash − layout` es el coste de fuentes y caché: si domina, se revisa el
  tamaño de las fuentes o el `maxAge` de la caché.
- `home − splash` es el primer render de la portada: si domina, se revisa el
  trabajo síncrono de `app/(tabs)/index.tsx`.
- Un p95 por encima de 2.500 ms no se corrige subiendo timeouts: se corrige
  quitando trabajo del camino crítico (fuentes, validación de documentos o
  consultas que no pinta la primera pantalla).
