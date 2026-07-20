import type { SkillId } from "./skills-catalog";
import type { AserLevel } from "./types";

export type TokenMeta = {
  index: number;
  normalizedText: string;
  role: "target" | "support" | "neutral";
  primarySkillId?: SkillId;
  controlledExemplar: boolean;
};

export type PassageMeta = {
  passageId: string;
  version: number;
  language: "en";
  level: AserLevel;
  source: "baseline" | "focused_card" | "general_card";
  tokens: TokenMeta[];
};
