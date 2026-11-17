import type { StageId, StageModule } from '../stage';
import { cameraStage } from './camera';
import { clockStage } from './clock';
import { radioStage } from './radio';

export const STAGES: StageModule[] = [radioStage, clockStage, cameraStage];

export const STAGE_IDS: StageId[] = STAGES.map((s) => s.def.id);

export function getStage(id: string): StageModule | null {
  return STAGES.find((s) => s.def.id === id) ?? null;
}

/** 次のステージ（最後なら null） */
export function nextStageId(id: string): StageId | null {
  const i = STAGES.findIndex((s) => s.def.id === id);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1].def.id;
}
