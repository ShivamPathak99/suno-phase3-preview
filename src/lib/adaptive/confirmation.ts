import {
  extractSkillEvidence,
  type CandidateSuspicion,
  type ConfirmedAssessmentForEvidence,
  type ConfirmedAssessmentWord,
  type SkillEvidenceEvent,
} from "./evidence";
import type { PassageMeta } from "./passage-catalog";
import { buildStudentProfile } from "./profile";
import {
  chooseFocus,
  type FocusEvidenceSummary,
  type FocusRecommendation,
  type FocusScope,
} from "./selection";
import type { SkillId } from "./skills-catalog";
import type { ReadingPurpose } from "./types";

export type AdaptiveAssessmentPayload = {
  candidateSignals: CandidateSuspicion[];
  evidence: SkillEvidenceEvent[];
  evidenceSummaryBySkill: Partial<Record<SkillId, FocusEvidenceSummary>>;
  focus: FocusRecommendation;
  passageMetadataVersion?: number;
  purpose: ReadingPurpose;
  v: "adaptive-evidence.v1";
};

export type CreateAdaptiveConfirmationInput = {
  assessment: ConfirmedAssessmentForEvidence;
  confirmedReadingCount: number;
  existingAdaptive?: AdaptiveAssessmentPayload;
  historicalAdaptiveAssessments?: readonly AdaptiveAssessmentPayload[];
  passage?: PassageMeta;
  scope: FocusScope;
  wordOutcomes: readonly ConfirmedAssessmentWord[];
};

function isReliableForSummary(word: ConfirmedAssessmentWord) {
  if (word.outcome === "unclear" || word.confirmation === "disputed") {
    return false;
  }

  if (word.confirmation === "edited") {
    return true;
  }

  return word.confidence === "high" || word.confidence === "medium";
}

function summarizeEvidence(
  passage: PassageMeta | undefined,
  wordOutcomes: readonly ConfirmedAssessmentWord[],
) {
  if (!passage) {
    return {};
  }

  const tokenByIndex = new Map(passage.tokens.map((token) => [token.index, token]));
  const summaries = {} as Partial<Record<SkillId, FocusEvidenceSummary>>;
  const skillsRead = new Set<SkillId>();

  for (const word of wordOutcomes) {
    const token = tokenByIndex.get(word.passageWordIndex);
    if (!token?.primarySkillId || !isReliableForSummary(word)) {
      continue;
    }

    const isDirectOpportunity =
      (passage.source !== "baseline" || token.controlledExemplar) &&
      (token.controlledExemplar || word.teacherLabelled === true);
    if (!isDirectOpportunity) {
      continue;
    }

    const summary = summaries[token.primarySkillId] ?? {
      errors: 0,
      hesitations: 0,
      opportunities: 0,
      readings: 0,
    };
    summary.opportunities += 1;
    if (word.outcome === "hesitation") {
      summary.hesitations += 1;
    }
    if (word.outcome === "substituted" || word.outcome === "skipped") {
      summary.errors += 1;
    }
    summaries[token.primarySkillId] = summary;
    skillsRead.add(token.primarySkillId);
  }

  for (const skillId of skillsRead) {
    const summary = summaries[skillId];
    if (summary) {
      summary.readings = 1;
    }
  }

  return summaries;
}

function mergeEvidenceSummaries(
  summaries: ReadonlyArray<Partial<Record<SkillId, FocusEvidenceSummary>>>,
) {
  const merged = {} as Partial<Record<SkillId, FocusEvidenceSummary>>;

  for (const summaryBySkill of summaries) {
    for (const [skillId, summary] of Object.entries(summaryBySkill) as Array<
      [SkillId, FocusEvidenceSummary]
    >) {
      const current = merged[skillId] ?? {
        errors: 0,
        hesitations: 0,
        opportunities: 0,
        readings: 0,
      };
      merged[skillId] = {
        errors: current.errors + summary.errors,
        hesitations: current.hesitations + summary.hesitations,
        opportunities: current.opportunities + summary.opportunities,
        readings: current.readings + summary.readings,
      };
    }
  }

  return merged;
}

/**
 * Produces the immutable `_adaptive` assessment payload after a teacher has
 * confirmed the existing reading result. This function has no database or
 * framework dependency, which keeps confirm-route replay behavior testable.
 */
export function createAdaptiveConfirmation({
  assessment,
  confirmedReadingCount,
  existingAdaptive,
  historicalAdaptiveAssessments = [],
  passage,
  scope,
  wordOutcomes,
}: CreateAdaptiveConfirmationInput): AdaptiveAssessmentPayload {
  if (existingAdaptive) {
    return existingAdaptive;
  }

  const extraction = passage
    ? extractSkillEvidence({ assessment, passage, wordOutcomes })
    : { candidateSignals: [], events: [] };
  const evidenceSummaryBySkill = summarizeEvidence(passage, wordOutcomes);
  const historicalEvidence = historicalAdaptiveAssessments.flatMap((adaptive) => adaptive.evidence);
  const profile = buildStudentProfile({
    asOf: assessment.occurredAt,
    confirmedReadingCount,
    events: [...historicalEvidence, ...extraction.events],
    studentId: assessment.studentId,
  });
  const focus = chooseFocus({
    evidenceSummaryBySkill: mergeEvidenceSummaries([
      ...historicalAdaptiveAssessments.map((adaptive) => adaptive.evidenceSummaryBySkill),
      evidenceSummaryBySkill,
    ]),
    profile,
    scope,
  });

  return {
    candidateSignals: extraction.candidateSignals,
    evidence: extraction.events,
    evidenceSummaryBySkill,
    focus,
    passageMetadataVersion: passage?.version,
    purpose: assessment.purpose,
    v: "adaptive-evidence.v1",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSkillEvidenceEvent(value: unknown): value is SkillEvidenceEvent {
  return (
    isRecord(value) &&
    value.v === "adaptive-evidence.v1" &&
    typeof value.studentId === "string" &&
    typeof value.assessmentId === "string" &&
    typeof value.skillId === "string" &&
    typeof value.occurredAt === "string" &&
    typeof value.accuracyCredit === "number" &&
    typeof value.weight === "number" &&
    (value.directness === 0.5 || value.directness === 1) &&
    typeof value.teacherConfirmed === "boolean" &&
    typeof value.distinctWordKey === "string"
  );
}

function isFocusRecommendation(value: unknown): value is FocusRecommendation {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    typeof value.reason === "string" &&
    typeof value.source === "string"
  );
}

/** Reads only payloads written by this module; invalid historic JSON is ignored. */
export function parseAdaptiveAssessmentPayload(value: unknown): AdaptiveAssessmentPayload | null {
  if (!isRecord(value) || value.v !== "adaptive-evidence.v1" || !Array.isArray(value.evidence)) {
    return null;
  }

  if (!isFocusRecommendation(value.focus)) {
    return null;
  }

  const evidenceSummaryBySkill = isRecord(value.evidenceSummaryBySkill)
    ? (value.evidenceSummaryBySkill as Partial<Record<SkillId, FocusEvidenceSummary>>)
    : {};

  return {
    candidateSignals: Array.isArray(value.candidateSignals)
      ? (value.candidateSignals as CandidateSuspicion[])
      : [],
    evidence: value.evidence.filter(isSkillEvidenceEvent),
    evidenceSummaryBySkill,
    focus: value.focus,
    passageMetadataVersion:
      typeof value.passageMetadataVersion === "number" ? value.passageMetadataVersion : undefined,
    purpose:
      value.purpose === "focused_readback" || value.purpose === "diagnostic"
        ? value.purpose
        : "benchmark",
    v: "adaptive-evidence.v1",
  };
}
