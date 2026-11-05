# ADR 0029 — Iconos oficiales de las fuentes de noticias

- **Estado:** aceptado
- **Fecha:** 2026-11-05
- **Contexto:** H2 de la fase 2 (fiabilidad y atribución de noticias)

## Problema

`news.json` ya declaraba `iconUrl` opcional, pero el catálogo de feeds no lo
rellenaba y la tarjeta de noticias solo pintaba un monograma. La app no
distinguía visualmente Riazor.org, DXT Campeón, La Voz, Marca o el canal oficial
del club, y la portada usaba monogramas distintos en sitios distintos.

Rastrear la portada de cada medio para «descubrir» el icono sería scraping y
añadiría una dependencia frágil. Tampoco se quiere depender de un servicio de
favicons de terceros que reciba la navegación del usuario.

## Decisión

1. **URL directa y verificada del icono oficial** en
   `data/manual/news_feeds.yml` (`iconUrl`), usando el favicon o el
   `apple-touch-icon` que el propio medio publica. No se descargan ni
   redistribuyen los logos en el repositorio.
2. **El contrato no cambia:** `NewsSource.iconUrl` sigue siendo opcional y
   `build_news` lo copia del catálogo. Un icono ausente o roto se representa con
   el monograma estable de siempre; nunca deja un hueco vacío.
3. **Carga externa con caché de imagen** (`memory-disk`) y caída a monograma en
   `onError`. La app no bloquea la noticia si el medio cambia de URL o bloquea
   la imagen.
4. **Verificación en el catálogo:** una prueba exige que las cinco fuentes
   activas tengan un `iconUrl` https. Si un medio retira su icono, la prueba
   obliga a decidir entre actualizar la URL o documentar la ausencia.
5. **Uso editorial:** los iconos son marcas de sus medios y se usan junto al
   nombre y el enlace a la noticia original. No se usan como marca del proyecto
   ni se relicencian.

## Consecuencias

- La tarjeta de noticias y la portada muestran el medio real cuando el icono
  carga; si falla, la interfaz sigue siendo legible con el monograma.
- El pipeline no rastrea páginas ni guarda binarios de medios.
- Cambiar un icono es una edición del YAML y un refresco de noticias, no un
  cambio de contrato ni de la app.
- La app comparte la petición del icono con el servidor del medio, igual que ya
  ocurre con las miniaturas de los artículos.

## Alternativas descartadas

- **Servicio de favicons de terceros:** añade un intermediario y una dependencia
  de disponibilidad que no controlamos.
- **Descargar los logos al repositorio:** mezcla marcas de terceros con datos
  deportivos y complica la revisión de derechos; además obliga a un comando de
  descarga y a mantener binarios.
- **Rastrear la portada para descubrir el `<link rel="icon">`:** es scraping y
  se rompe con cada rediseño.
- **Dejar solo monogramas:** es honesto, pero pierde la atribución visual que
  pide el H2 y que ya estaba prevista en el contrato.
