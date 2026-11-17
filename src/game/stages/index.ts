import type { StageId, StageModule } from '../stage';
import { cameraStage } from './camera';
import { clockStage } from './clock';
import { lampStage } from './lamp';
import { phoneStage } from './phone';
import { radioStage } from './radio';
import { recordStage } from './record';
import { robotStage } from './robot';

export const STAGES: StageModule[] = [
  radioStage,
  clockStage,
  cameraStage,
  lampStage,
  robotStage,
  recordStage,
  phoneStage,
];

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
