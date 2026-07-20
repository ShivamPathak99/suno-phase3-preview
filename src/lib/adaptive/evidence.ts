import type { SkillId } from "./skills-catalog";

export type SkillEvidenceEvent = {
  v: "adaptive-evidence.v1";
  studentId: string;
  assessmentId: string;
  skillId: SkillId;
  occurredAt: string;
  purpose: "benchmark" | "focused_readback" | "diagnostic";
  outcome: "correct" | "hesitation" | "self_corrected" | "substituted" | "skipped";
  accuracyCredit: number;
  automaticityCredit?: number;
  weight: number;
  directness: 0.5 | 1.0;
  teacherConfirmed: boolean;
  distinctWordKey: string;
};
