"""Enriquecimiento de la plantilla desde fuentes libres (ADR 0008).

El módulo no publica nada por sí solo: produce propuestas con fuente y confianza para que
`depor_hub.cli enrich` decida qué aplicar. Sin red en los tests: los parsers reciben HTML/JSON.
"""

from .proposal import EnrichmentProposal, build_proposals, collect_player

__all__ = ["EnrichmentProposal", "build_proposals", "collect_player"]
