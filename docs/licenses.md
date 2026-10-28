# Licencias y atribuciones

Depor Hub es un proyecto de aficionados sin vinculación oficial con el Real Club Deportivo de La Coruña, S.A.D. Este documento reúne las licencias del software de terceros y las condiciones de los datos que se muestran en la app.

## Software de terceros

| Componente | Versión | Licencia | Uso |
|---|---|---|---|
| Expo / plantilla de `apps/mobile` | SDK 58 | MIT (`apps/mobile/LICENSE`, © 650 Industries) | Base de la aplicación |
| React Native, React y Expo Router | según `package.json` | MIT | Aplicación |
| `react-native-svg` | 15.16.0 | MIT | Gráfica de evolución de la posición (ADR 0017) |
| `@react-native-community/netinfo` | 12.0.1 | MIT | Estado de conexión |
| Resto de dependencias npm | según `package-lock.json` | MIT / Apache-2.0 / BSD | Se consultan en su paquete |

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

Los nombres y escudos de los clubes pertenecen a sus titulares. Se usan con finalidad informativa y editorial. La identidad visual de Depor Hub es propia: no se usa el escudo del club como logotipo de la app.
