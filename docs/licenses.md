# Licencias y atribuciones

Depor Hub es un proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D. Este documento reúne las licencias del software de terceros y las condiciones de los datos que se muestran en la app.

## Software de terceros

| Componente | Versión | Licencia | Uso |
|---|---|---|---|
| Expo / plantilla de `apps/mobile` | SDK 58 | MIT (`apps/mobile/LICENSE`, © 650 Industries) | Base de la aplicación |
| React Native, React y Expo Router | según `package.json` | MIT | Aplicación |
| `react-native-svg` | 15.16.0 | MIT | Gráfica de evolución de la posición |
| `react-native-gesture-handler` | 3.3.0 | MIT | Gesto táctil del gráfico; versión recomendada por el mapa local del SDK 58 |
| `react-native-reanimated` / `react-native-worklets` | 4.7.1 / 0.13.0 | MIT | Movimiento reducible y guía animada |
| `expo-font`, `expo-linear-gradient`, `expo-image` | SDK 58 | MIT | Fuentes, tarjetas Cartel y miniaturas con caché |
| `@react-native-community/netinfo` | 12.0.1 | MIT | Estado de conexión |
| Resto de dependencias npm | según `package-lock.json` | MIT / Apache-2.0 / BSD | Se consultan en su paquete |

Las fuentes Barlow Condensed SemiBold, Source Serif 4 SemiBold e Inter Regular se distribuyen bajo SIL Open Font License 1.1; los avisos están en `docs/licenses/fonts/`. Los archivos empaquetados suman 776.496 bytes (758,3 KiB). Son tres familias y tres archivos. El splash espera la carga para evitar saltos; el objetivo de arranque inferior a 2,5 s aún no se ha medido en hardware.

El texto completo de la licencia MIT de la plantilla está en `apps/mobile/LICENSE`. Las licencias de cada paquete npm quedan en `node_modules/<paquete>/LICENSE` tras `npm install`.

## Datos y servicios

| Fuente | Licencia / condición | Atribución en la app |
|---|---|---|
| **football-data.org** | Términos del plan gratuito; datos de terceros | Pie de Home y `meta.json` (`source`) |
| **BDFutbol** | HTML público; reutilización pendiente de revisión. Solo se guardan hechos (balance y cruces), no se redistribuye el HTML | «Histórico · BDFutbol» con enlace a `vs.php` |
| **Open-Meteo** | **CC BY 4.0** | «Datos: Open-Meteo» junto a la previsión |
| **Wikipedia / Wikidata / Commons** | CC BY-SA / CC0 según la ficha | Fichas de jugador, entrenador y escudos (ADR 0008, 0009, 0012) |
| **Web oficial del club** | Uso editorial; sin licencia de reutilización | Crédito «© RC Deportivo de La Coruña» en las fotos |
| **RSS/Atom de medios y YouTube** | Solo titular, enlace, fecha, miniatura y resumen tal como los publica el feed | Nombre del medio y enlace al original |

No se copian binarios de imágenes ni HTML de terceros al repositorio. Las fotos y escudos se enlazan por URL y conservan su crédito. Los datos desconocidos se publican como `null`; no se completan por deducción.

## Marcas

Los nombres y escudos de los clubes pertenecen a sus titulares. Se usan con finalidad informativa y editorial. La identidad visual de Depor Hub es propia. El escudo del Depor aparece solo como marca dentro de la interfaz, controlado por `SHOW_CLUB_CREST_AS_BRAND`; la app, el splash y la tienda conservan DH. Se muestra el aviso de proyecto no oficial. El responsable asume el riesgo editorial del escudo remoto; si se apaga la constante, aparece DH.
