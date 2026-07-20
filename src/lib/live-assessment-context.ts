import { analysisSchema, type ReadingAnalysis } from "@/lib/analysisSchema";
import type { ReadingPurpose } from "@/lib/adaptive/types";
import type { AssessmentContext, AssessmentPassage, ReadingLevel } from "@/lib/assessment-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StudentRecord = {
  id: string;
  name: string;
};

type PassageRecord = {
  body: string;
  id: string;
  language: string;
  level: string;
  title: string | null;
};

type AssessmentRecord = {
  analysis_json?: unknown;
  id: string;
  passage_id: string;
  student_id: string;
};

export type LiveDraftAssessment = {
  analysis: ReadingAnalysis;
  assessmentId: string;
  context: AssessmentContext;
};

export type LiveAssessmentLaunch = {
  passageId?: string;
  purpose: ReadingPurpose;
};

function isReadingLevel(value: string): value is ReadingLevel {
  return ["letter", "word", "paragraph", "story"].includes(value);
}

function readPurpose(value: unknown): ReadingPurpose {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { purpose?: unknown }).purpose === "focused_readback"
  ) {
    return "focused_readback";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { purpose?: unknown }).purpose === "diagnostic"
  ) {
    return "diagnostic";
  }

  return "benchmark";
}

function parseStoredDraftAnalysis(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const { _adaptive, ...analysisValue } = value as Record<string, unknown>;
  const analysis = analysisSchema.safeParse(analysisValue);

  return analysis.success ? { analysis: analysis.data, purpose: readPurpose(_adaptive) } : null;
}

function toAssessmentPassage(record: PassageRecord): AssessmentPassage | null {
  if (
    !record.id ||
    !record.body ||
    !isReadingLevel(record.level) ||
    (record.language !== "en" && record.language !== "hi")
  ) {
    return null;
  }

  return {
    body: record.body,
    id: record.id,
    language: record.language,
    level: record.level,
    title: record.title?.trim() || "Reading practice",
  };
}

async function loadStudent(studentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle<StudentRecord>();

  if (error) {
    throw new Error("Couldn't load the selected student.");
  }

  return data;
}

async function loadPassage(passageId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("passages")
    .select("id, level, language, title, body")
    .eq("id", passageId)
    .maybeSingle<PassageRecord>();

  if (error) {
    throw new Error("Couldn't load the selected passage.");
  }

  return data ? toAssessmentPassage(data) : null;
}

async function nextAttemptNumber(studentId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("assessments")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) {
    throw new Error("Couldn't load the student's assessment history.");
  }

  return (count ?? 0) + 1;
}

async function draftAttemptNumber(studentId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("assessments")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) {
    throw new Error("Couldn't load the student's assessment history.");
  }

  return Math.max(1, count ?? 0);
}

async function selectedPassageIdForStudent(studentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: latestAssessment, error: latestAssessmentError } = await supabase
    .from("assessments")
    .select("passage_id, level")
    .eq("student_id", studentId)
    .eq("teacher_confirmed", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ level: string; passage_id: string }>();

  if (latestAssessmentError) {
    throw new Error("Couldn't load the student's last reading level.");
  }

  if (latestAssessment?.passage_id) {
    // Follow the latest teacher-confirmed ladder position, not merely the
    // prior text. That matters when teacher edits move a child one rung down.
    if (isReadingLevel(latestAssessment.level)) {
      const { data: priorPassage, error: priorPassageError } = await supabase
        .from("passages")
        .select("language")
        .eq("id", latestAssessment.passage_id)
        .maybeSingle<{ language: string }>();

      if (priorPassageError) {
        throw new Error("Couldn't load the student's last reading passage.");
      }

      if (priorPassage?.language === "en" || priorPassage?.language === "hi") {
        const { data: levelPassage, error: levelPassageError } = await supabase
          .from("passages")
          .select("id")
          .eq("level", latestAssessment.level)
          .eq("language", priorPassage.language)
          .limit(1)
          .maybeSingle<{ id: string }>();

        if (levelPassageError) {
          throw new Error("Couldn't load a passage for the student's reading level.");
        }

        if (levelPassage?.id) {
          return levelPassage.id;
        }
      }
    }

    return latestAssessment.passage_id;
  }

  // A child without a confirmed assessment starts at the first English letter
  // passage. The dashboard will place them only after teacher confirmation.
  const { data: starterPassage, error: starterPassageError } = await supabase
    .from("passages")
    .select("id")
    .eq("level", "letter")
    .eq("language", "en")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (starterPassageError) {
    throw new Error("Couldn't load a starter reading passage.");
  }

  return starterPassage?.id ?? null;
}

export async function loadLiveAssessmentContext(
  studentId: string,
  launch: LiveAssessmentLaunch = { purpose: "benchmark" },
): Promise<AssessmentContext | null> {
  const [student, passageId, attemptNumber] = await Promise.all([
    loadStudent(studentId),
    launch.passageId ? Promise.resolve(launch.passageId) : selectedPassageIdForStudent(studentId),
    nextAttemptNumber(studentId),
  ]);

  if (!student || !passageId) {
    return null;
  }

  const passage = await loadPassage(passageId);

  if (!passage) {
    return null;
  }

  return { attemptNumber, passage, purpose: launch.purpose, student };
}

export async function loadLiveDraftAssessment(
  studentId: string,
  assessmentId: string,
): Promise<LiveDraftAssessment | null> {
  const supabase = createSupabaseAdminClient();
  const { data: draft, error } = await supabase
    .from("assessments")
    .select("id, student_id, passage_id, analysis_json")
    .eq("id", assessmentId)
    .eq("student_id", studentId)
    .maybeSingle<AssessmentRecord>();

  if (error) {
    throw new Error("Couldn't load the reading draft.");
  }

  if (!draft) {
    return null;
  }

  const storedAnalysis = parseStoredDraftAnalysis(draft.analysis_json);

  if (!storedAnalysis) {
    throw new Error("The saved reading draft is invalid.");
  }

  const [student, passage, attemptNumber] = await Promise.all([
    loadStudent(studentId),
    loadPassage(draft.passage_id),
    draftAttemptNumber(studentId),
  ]);

  if (!student || !passage) {
    return null;
  }

  return {
    analysis: storedAnalysis.analysis,
    assessmentId: draft.id,
    context: { attemptNumber, passage, purpose: storedAnalysis.purpose, student },
  };
}
