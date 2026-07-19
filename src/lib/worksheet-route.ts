import { readingLevels } from "@/lib/analysisSchema";

export type WorksheetLevel = (typeof readingLevels)[number];

export function isWorksheetLevel(value: string): value is WorksheetLevel {
  return (readingLevels as readonly string[]).includes(value);
}

export function worksheetPath(level: WorksheetLevel) {
  return "/worksheet/" + level;
}
