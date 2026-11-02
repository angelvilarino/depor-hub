import type { ComponentType } from 'react';
import type { ClubT } from '@/data/schemas';
import type { ClubSectionId } from '../logic';
import { EquipacionesSection } from './EquipacionesSection';
import { EscudoSection } from './EscudoSection';
import { EstadioSection } from './EstadioSection';
import { HimnosSection } from './HimnosSection';
import { JuntaSection } from './JuntaSection';
import { MuseoSection } from './MuseoSection';
import { PatrocinadoresSection } from './PatrocinadoresSection';
import { RedesSection } from './RedesSection';
import { RivalidadesSection } from './RivalidadesSection';
import { TitulosSection } from './TitulosSection';
import { TrainingSection } from './TrainingSection';

export type ClubSectionComponent = ComponentType<{ club: ClubT }>;

export const CLUB_SECTION_COMPONENTS: Record<ClubSectionId, ClubSectionComponent> = {
  himnos: HimnosSection,
  escudo: EscudoSection,
  equipaciones: EquipacionesSection,
  estadio: EstadioSection,
  museo: MuseoSection,
  training: TrainingSection,
  junta: JuntaSection,
  patrocinadores: PatrocinadoresSection,
  titulos: TitulosSection,
  rivalidades: RivalidadesSection,
  redes: RedesSection,
};
