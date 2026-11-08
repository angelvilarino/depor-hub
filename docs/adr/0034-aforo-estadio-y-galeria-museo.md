# ADR 0034: Aforo del estadio y galería del museo

- **Estado:** Aceptado
- **Fecha:** 2026-11-08
- **Contexto:** la suma previa agregaba el aforo oficial de Riazor (32.490) con cifras de palco, VIP, Área 1906 y medios sin confirmar si eran plazas adicionales. También faltaba un campo contractual para galerías del Museo; el horario disponible no está verificado.

## Decisión

- Publicar **32.490 localidades sentadas** como total, respaldado por la página oficial del [Estadio Abanca-Riazor](https://www.rcdeportivo.es/es/estadio-abanca-riazor) y contrastado con Wikipedia. Las cifras específicas de sectores no se suman sin evidencia de que sean adicionales. La cifra de 34.611 mencionada en notas anteriores queda fuera porque no se encontró una fuente identificable.
- Añadir a `Capacity` los campos aditivos `sourceUrl`, `confidence` y `status`, con defaults compatibles con JSON anterior. La app enlaza a la fuente y señala el estado si aún no está verificado.
- Añadir `Museum.media` como lista aditiva con default vacío. La interfaz solo muestra fotos con estado `verified`, con crédito y visor a pantalla completa.
- No inferir el estado Abierto/Cerrado del Museo: se mantiene oculto mientras los horarios no estén verificados. El acceso a mapas usa aplicaciones nativas y no requiere SDK de mapas.

## Consecuencias

- `Capacity.total` sigue validándose como suma de `breakdown`; el desglose representa únicamente el total confirmado hasta que se conozca la relación entre los distintos sectores.
- Pydantic, el JSON Schema y Zod se mantienen como contratos espejo. Los clientes anteriores continúan validando mediante defaults.
- La galería del Museo y su estado de apertura no aparecen cuando faltan datos verificados.
