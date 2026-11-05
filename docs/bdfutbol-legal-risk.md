# Informe de riesgo legal — uso de BDFutbol

- **Fecha:** 2026-11-05
- **Alcance:** uso actual de BDFutbol en `depor_hub.enrich` y propuesta de usarlo
  para eventos, alineaciones y estadísticas en la ficha de partido.
- **Estado:** informe previo a cualquier implementación nueva. **No es
  asesoramiento jurídico.** Antes de publicar a gran escala o monetizar, debe
  revisarlo un profesional con la normativa y los contratos aplicables.

## Resumen ejecutivo

| Uso | Riesgo | Motivo |
|---|---|---|
| Extraer trayectoria, totales y partidos de jugadores desde HTML público | **Medio-alto** | Base de datos protegida y servicio comercial de datos; `robots.txt` permisivo no equivale a licencia |
| Extraer eventos, alineaciones y estadísticas de partido desde HTML | **Alto** | Es justo el dato que BDFutbol comercializa; extracción sistemática y redistribución |
| Guardar hechos aislados (fecha, resultado, minutos) sin copiar el HTML | **Medio** | Los hechos no son obra, pero la extracción sustancial de una base protegida sí puede infringir |
| Usar fotos, escudos o textos de BDFutbol | **Alto** | Derechos de autor y de imagen independientes; no hay licencia editorial |
| Contratar la API v2 o el servicio de datos | **Bajo, con contrato** | Vía legítima y de pago; hay que revisar la modalidad y el precio |

**Recomendación:** no implementar scraping de eventos, alineaciones ni
estadísticas. Mantener el marcador y el estado con football-data.org. Antes de
ampliar el uso de BDFutbol, pedir **autorización escrita** o contratar su API v2.
Mientras no exista, la ficha sigue en modo degradado honesto (ADR 0028).

## Hechos verificados (05-nov-2026)

1. **Titularidad y copyright.** El pie de BDFutbol muestra
   «© 2008—2026 Base de Datos Histórica de Fútbol» y la página de información
   explica que los datos proceden de fuentes oficiales, hemerotecas,
   publicaciones y colaboradores. No hay una licencia abierta publicada.
2. **`robots.txt`.** `https://www.bdfutbol.com/robots.txt` permite la mayor parte
   del sitio y bloquea solo rutas de API/archivo
   (`/c/api*.html`). Un `Allow` en `robots.txt` no concede derechos de
   reproducción ni de extracción; solo indica a los rastreadores qué pueden
   visitar.
3. **Servicio comercial de datos.** BDFutbol ofrece «Servicio de Datos»
   (`/es/c/archives.html`), «API Datos» (`/es/c/api2.html`) y «API Fotos»
   (`/es/c/api-photo.html`). La API v2 se describe como acceso por suscripción
   (cuatro modalidades, cancelación por PayPal) y el servicio de archivos se
   prepara «a medida». Es decir: **el titular explota comercialmente la
   extracción de su base**, lo que refuerza la expectativa de autorización previa.
4. **Uso actual en el proyecto.** `enrich` consulta fichas HTML de BDFutbol para
   carrera, temporadas, totales, dorsal, peso y partidos con el Depor. El HTML
   no se redistribuye y solo se publican hechos, pero la extracción es
   sistemática y repetida. `docs/sources.md` ya la marcaba como «reutilización
   pendiente de revisión».

## Marco jurídico relevante (España / UE)

- **Derechos de autor.** Los textos, fichas, bases de datos y elementos gráficos
  originales pueden estar protegidos por el Texto Refundido de la Ley de
  Propiedad Intelectual. Copiar fragmentos sustanciales o la estructura de una
  ficha puede infringir aunque se cambien algunas palabras.
- **Derecho *sui generis* sobre bases de datos.** La Directiva 96/9/CE y el
  artículo 12 del TRLPI protegen la inversión sustancial en la obtención,
  verificación o presentación de una base de datos. La extracción o
  reutilización de una parte sustancial requiere autorización. La jurisprudencia
  del TJUE (por ejemplo, *British Horseracing Board*, *Football Dataco* e
  *Innoweb*) exige valorar la inversión y también la extracción repetida y
  sistemática de partes no sustanciales.
- **Hechos frente a obra.** Un resultado o una fecha son hechos y no son
  propiedad de nadie; lo protegido es la selección, coordinación, estructura,
  redacción y la inversión en la base. Por eso el riesgo no desaparece por
  «publicar solo el dato».
- **Datos personales.** Nombres, fechas de nacimiento, trayectoria y fotos de
  jugadores son datos personales (RGPD/LOPDGDD). Publicar hechos deportivos
  puede ampararse en interés legítimo o fines editoriales, pero hay que minimizar,
  no usar fotos sin derecho y atender solicitudes de rectificación o supresión.
- **Marcas y derechos de imagen.** Escudos de clubes, logos de medios y fotos de
  jugadores son derechos distintos del copyright de la base. La app ya usa
  escudos por URL externa con atribución y no descarga fotos de BDFutbol; esa
  política debe mantenerse.
- **Competencia desleal.** Aprovecharse de la inversión ajena o del esfuerzo de
  un servicio comercial puede añadir un riesgo de competencia desleal, sobre
  todo si el proyecto se publica o monetiza.

## Riesgo por caso de uso

### 1. Enriquecimiento actual de la plantilla

- **Qué se extrae:** carrera, temporadas, totales, dorsal, peso y partidos.
- **Riesgo:** medio-alto. Es extracción repetida de una base protegida y de un
  servicio que vende esos mismos datos. El hecho de no guardar el HTML reduce el
  riesgo de reproducción literal, pero no elimina el de extracción sustancial.
- **Mitigación inmediata:** no ampliar campos, no automatizar más frecuentemente
  de lo necesario, mantener la caché y la atribución, y no publicar fotos ni
  textos de BDFutbol.
- **Mitigación definitiva:** autorización escrita o API v2. Si no se obtiene,
  valorar sustituir las fuentes por datos propios, API oficial o Wikidata.

### 2. Eventos, alineaciones y estadísticas de partido

- **Qué se pretendía:** goles, tarjetas, cambios, alineaciones y estadísticas.
- **Riesgo:** alto. Es un conjunto sustancial y sistemático de la base, y es
  exactamente lo que BDFutbol comercializa. Además, la ficha ya declara
  honestamente que esos datos no están disponibles.
- **Decisión:** **no implementar** mientras no haya autorización/licencia. No se
  debe usar scraping «de prueba» ni ocultar la fuente.

### 3. Fotos, escudos y textos

- **Riesgo:** alto si se copian de BDFutbol. Las fotos tienen autor, licencia y
  derechos de imagen; los escudos son marcas.
- **Decisión:** mantener la política actual: escudos por URL externa con
  atribución y sin fotos de BDFutbol.

### 4. API v2 / servicio de datos

- **Riesgo:** bajo si el contrato permite el uso previsto (app pública, no
  reventa, atribución).
- **Coste:** no es cero. Hay que pedir presupuesto y revisar la modalidad.
- **Requisito:** guardar el contrato y la autorización, y no usar el token fuera
  del backend.

## Recomendación

1. **Bloquear** cualquier scraping nuevo de BDFutbol para la ficha de partido.
2. **Pedir autorización escrita** a BDFutbol para el uso actual de datos
   históricos y, si se quiere, para eventos/alineaciones. Explicar que el
   proyecto es un aggregator editorial sin ánimo de lucro, que enlaza a la
   fuente y no redistribuye HTML ni fotos.
3. **Pedir presupuesto** de la API v2 como alternativa de coste no cero. No
   contratar sin aprobación expresa del responsable del proyecto.
4. **Mantener la degradación honesta** mientras tanto: marcador, estado, sede,
   árbitro y snapshots; nunca eventos inventados.
5. **Revisar el enriquecimiento actual** si no hay respuesta favorable: es el
   uso con más exposición porque ya está publicado.

## Decisión pendiente

El responsable del proyecto debe elegir:

- **A. Solo autorización/licencia:** no se amplía BDFutbol hasta tener permiso
  escrito o contrato. Es la opción recomendada.
- **B. Retirar también el enriquecimiento:** máxima prudencia, pero obliga a
  reconstruir la ficha de jugador con otras fuentes.
- **C. Asumir el riesgo:** no recomendado para una publicación a gran escala ni
  para monetización.

Este informe no sustituye la revisión de un abogado. Las URLs y condiciones
citadas se comprobaron el 05-nov-2026 y pueden cambiar.
