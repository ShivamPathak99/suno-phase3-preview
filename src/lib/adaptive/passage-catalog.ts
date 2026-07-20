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

/**
 * V1 baseline metadata is code-owned and keyed by the stable seeded passage
 * UUID. Focus-card metadata will be supplied by the curated card catalog.
 */
export const passageMetadataCatalog: Record<string, PassageMeta> = {
  "20000000-0000-4000-8000-000000000003": {
    language: "en",
    level: "word",
    passageId: "20000000-0000-4000-8000-000000000003",
    source: "baseline",
    tokens: [
      { controlledExemplar: false, index: 0, normalizedText: "sun", role: "neutral" },
      { controlledExemplar: false, index: 1, normalizedText: "bus", role: "neutral" },
      { controlledExemplar: false, index: 2, normalizedText: "cup", role: "neutral" },
      { controlledExemplar: false, index: 3, normalizedText: "red", role: "neutral" },
      {
        controlledExemplar: false,
        index: 4,
        normalizedText: "fish",
        primarySkillId: "en.digraph.sh",
        role: "neutral",
      },
      { controlledExemplar: false, index: 5, normalizedText: "book", role: "neutral" },
      { controlledExemplar: false, index: 6, normalizedText: "milk", role: "neutral" },
      { controlledExemplar: false, index: 7, normalizedText: "hand", role: "neutral" },
      { controlledExemplar: false, index: 8, normalizedText: "mango", role: "neutral" },
      { controlledExemplar: false, index: 9, normalizedText: "water", role: "neutral" },
      { controlledExemplar: false, index: 10, normalizedText: "school", role: "neutral" },
      { controlledExemplar: false, index: 11, normalizedText: "chair", role: "neutral" },
      { controlledExemplar: false, index: 12, normalizedText: "plant", role: "neutral" },
      { controlledExemplar: false, index: 13, normalizedText: "smile", role: "neutral" },
      { controlledExemplar: false, index: 14, normalizedText: "friend", role: "neutral" },
      { controlledExemplar: false, index: 15, normalizedText: "pencil", role: "neutral" },
      { controlledExemplar: false, index: 16, normalizedText: "window", role: "neutral" },
      { controlledExemplar: false, index: 17, normalizedText: "orange", role: "neutral" },
      { controlledExemplar: false, index: 18, normalizedText: "market", role: "neutral" },
      { controlledExemplar: false, index: 19, normalizedText: "basket", role: "neutral" },
    ],
    version: 1,
  },
};

export function getPassageMetadata(passageId: string) {
  return passageMetadataCatalog[passageId] ?? null;
}
