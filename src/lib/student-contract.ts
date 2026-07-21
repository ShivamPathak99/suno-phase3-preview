import { z } from "zod";

import { isStudentPlacementLevel, studentPlacementLevels, type StudentPlacementLevel } from "./student-placement";

const nameCharacters = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'’-]*$/u;

export type CreateStudentInput = {
  grade: string | null;
  name: string;
  startingLevel: StudentPlacementLevel | null;
};

export type PatchStudentInput = {
  grade?: string | null;
  isArchived?: boolean;
  name?: string;
  startingLevel?: StudentPlacementLevel;
};

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : null;
}

export function parseStudentName(value: unknown) {
  const name = trimText(value);

  if (!name || name.length > 40 || !nameCharacters.test(name)) {
    return null;
  }

  return name;
}

function parseOptionalGrade(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: null };
  }

  const grade = trimText(value);
  return grade && grade.length <= 20
    ? { ok: true as const, value: grade }
    : { ok: false as const, value: null };
}

export function parseCreateStudentInput(value: unknown): CreateStudentInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const input = value as { grade?: unknown; name?: unknown; startingLevel?: unknown };
  const name = parseStudentName(input.name);
  const grade = parseOptionalGrade(input.grade);
  const startingLevel = input.startingLevel === undefined || input.startingLevel === null
    ? null
    : isStudentPlacementLevel(input.startingLevel)
      ? input.startingLevel
      : undefined;

  return name && grade.ok && startingLevel !== undefined
    ? { grade: grade.value, name, startingLevel }
    : null;
}

export function parsePatchStudentInput(value: unknown): PatchStudentInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const input = value as {
    grade?: unknown;
    isArchived?: unknown;
    name?: unknown;
    startingLevel?: unknown;
  };
  const result: PatchStudentInput = {};

  if (input.name !== undefined) {
    const name = parseStudentName(input.name);
    if (!name) return null;
    result.name = name;
  }

  if (input.grade !== undefined) {
    const grade = parseOptionalGrade(input.grade);
    if (!grade.ok) return null;
    result.grade = grade.value;
  }

  if (input.isArchived !== undefined) {
    if (typeof input.isArchived !== "boolean") return null;
    result.isArchived = input.isArchived;
  }

  if (input.startingLevel !== undefined) {
    if (!isStudentPlacementLevel(input.startingLevel)) return null;
    result.startingLevel = input.startingLevel;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export const maxActiveStudents = 120;
export const rosterWarningThreshold = 60;

export function sameStudentName(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

// Kept as a compile-time contract alongside the runtime parser.
export const studentPlacementLevelSchema = z.enum(studentPlacementLevels);
