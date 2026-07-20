import { adaptiveConfig } from "./config";
import type { PassageMeta } from "./passage-catalog";
import type { SkillId } from "./skills-catalog";
import type {
  EvidenceOutcome,
  ReadingPurpose,
  TeacherWordConfirmation,
  WordConfidence,
} from "./types";

export type SkillEvidenceEvent = {
  v: "adaptive-evidence.v1";
  studentId: string;
  assessmentId: string;
  skillId: SkillId;
  occurredAt: string;
  purpose: ReadingPurpose;
  outcome: Exclude<EvidenceOutcome, "unclear">;
  accuracyCredit: number;
  automaticityCredit?: number;
  weight: number;
  directness: 0.5 | 1.0;
  teacherConfirmed: boolean;
  distinctWordKey: string;
};

export type ConfirmedAssessmentWord = {
  confidence: WordConfidence;
  confirmation: TeacherWordConfirmation;
  heardAs?: string;
  outcome: EvidenceOutcome;
  passageWordIndex: number;
  teacherLabelled?: boolean;
};

export type ConfirmedAssessmentForEvidence = {
  assessmentId: string;
  occurredAt: string;
  purpose: ReadingPurpose;
  studentId: string;
  teacherConfirmed: boolean;
};

export type CandidateSuspicion = {
  diagnosticEligible: boolean;
  distinctWordKeys: string[];
  score: number;
  skillId: SkillId;
};

export type ExtractSkillEvidenceInput = {
  assessment: ConfirmedAssessmentForEvidence;
  existingEvidenceTokenIndexes?: readonly number[];
  passage: PassageMeta;
  wordOutcomes: readonly ConfirmedAssessmentWord[];
};

export type SkillEvidenceExtraction = {
  candidateSignals: CandidateSuspicion[];
  events: SkillEvidenceEvent[];
};

type CandidateAccumulator = {
  distinctWordKeys: Set<string>;
  score: number;
};

function reliabilityFor(
  assessment: ConfirmedAssessmentForEvidence,
  word: ConfirmedAssessmentWord,
) {
  if (
    !assessment.teacherConfirmed ||
    word.outcome === "unclear" ||
    word.confirmation === "disputed"
  ) {
    return adaptiveConfig.evidence.reliability.disputedOrLowConfidence;
  }

  if (word.confirmation === "edited") {
    return adaptiveConfig.evidence.reliability.teacherEdited;
  }

  if (word.confidence === "high") {
    return adaptiveConfig.evidence.reliability.acceptedHighConfidence;
  }

  if (word.confidence === "medium") {
    return adaptiveConfig.evidence.reliability.acceptedMediumConfidence;
  }

  return adaptiveConfig.evidence.reliability.disputedOrLowConfidence;
}

/**
 * Converts one teacher-confirmed reading into immutable direct evidence and a
 * deliberately separate baseline-suspicion signal. It is pure and only uses
 * code-owned token metadata, so no unconfirmed AI result can change a profile.
 */
export function extractSkillEvidence({
  assessment,
  existingEvidenceTokenIndexes = [],
  passage,
  wordOutcomes,
}: ExtractSkillEvidenceInput): SkillEvidenceExtraction {
  const tokensByIndex = new Map(passage.tokens.map((token) => [token.index, token]));
  const processedTokenIndexes = new Set(existingEvidenceTokenIndexes);
  const distinctOccurrences = new Set<string>();
  const effectiveWeightBySkill = new Map<SkillId, number>();
  const candidateBySkill = new Map<SkillId, CandidateAccumulator>();
  const events: SkillEvidenceEvent[] = [];

  for (const word of wordOutcomes) {
    if (processedTokenIndexes.has(word.passageWordIndex)) {
      continue;
    }
    processedTokenIndexes.add(word.passageWordIndex);

    const token = tokensByIndex.get(word.passageWordIndex);
    if (!token?.primarySkillId || word.outcome === "unclear") {
      continue;
    }

    const distinctWordKey = token.normalizedText;
    const occurrenceKey = `${token.primarySkillId}:${distinctWordKey}`;
    const repeatedOccurrence = distinctOccurrences.has(occurrenceKey);
    distinctOccurrences.add(occurrenceKey);

    const reliability = reliabilityFor(assessment, word);
    if (reliability === 0) {
      continue;
    }

    const credits = adaptiveConfig.evidence.credits[word.outcome];

    if (passage.source === "baseline" && !token.controlledExemplar) {
      if (credits.accuracy < 1) {
        const candidate = candidateBySkill.get(token.primarySkillId) ?? {
          distinctWordKeys: new Set<string>(),
          score: 0,
        };
        candidate.score +=
          adaptiveConfig.evidence.suspicion.nonControlledBaselineFactor *
          reliability *
          (1 - credits.accuracy);
        candidate.distinctWordKeys.add(distinctWordKey);
        candidateBySkill.set(token.primarySkillId, candidate);
      }
      continue;
    }

    if (!token.controlledExemplar && !word.teacherLabelled) {
      continue;
    }

    const exemplarFactor = repeatedOccurrence
      ? adaptiveConfig.evidence.exemplarFactor.repeatedWord
      : adaptiveConfig.evidence.exemplarFactor.firstDistinctWord;

    const directness = token.controlledExemplar
      ? adaptiveConfig.evidence.directness.controlledExemplar
      : adaptiveConfig.evidence.directness.teacherLabelledNonControlled;
    const rawWeight = reliability * exemplarFactor * directness;
    const effectiveWeight = effectiveWeightBySkill.get(token.primarySkillId) ?? 0;
    const remainingWeight = Math.max(
      0,
      adaptiveConfig.evidence.maxEffectiveWeightPerSkillPerCard - effectiveWeight,
    );
    const weight = Math.min(rawWeight, remainingWeight);

    if (weight === 0) {
      continue;
    }

    effectiveWeightBySkill.set(token.primarySkillId, effectiveWeight + weight);
    events.push({
      accuracyCredit: credits.accuracy,
      assessmentId: assessment.assessmentId,
      automaticityCredit: credits.automaticity,
      directness,
      distinctWordKey,
      occurredAt: assessment.occurredAt,
      outcome: word.outcome,
      purpose: assessment.purpose,
      skillId: token.primarySkillId,
      studentId: assessment.studentId,
      teacherConfirmed: assessment.teacherConfirmed,
      v: "adaptive-evidence.v1",
      weight,
    });
  }

  const candidateSignals = [...candidateBySkill.entries()]
    .map(([skillId, candidate]) => {
      const distinctWordKeys = [...candidate.distinctWordKeys].sort();
      return {
        diagnosticEligible:
          candidate.score >= adaptiveConfig.evidence.suspicion.diagnosticScoreThreshold &&
          distinctWordKeys.length >= adaptiveConfig.evidence.suspicion.minimumDistinctWords,
        distinctWordKeys,
        score: candidate.score,
        skillId,
      };
    })
    .sort((left, right) => left.skillId.localeCompare(right.skillId));

  return { candidateSignals, events };
}
