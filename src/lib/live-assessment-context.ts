import { analysisSchema, type ReadingAnalysis } from "@/lib/analysisSchema";
import type { ReadingPurpose } from "@/lib/adaptive/types";
import type { AssessmentContext, AssessmentPassage, ReadingLevel } from "@/lib/assessment-types";
import { resolveStudentPlacement } from "@/lib/student-placement";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudentRecord = {
  id: string;
  name: string;
  placement_source: string | null;
  teacher_placement_level: string | null;
};

type PassageRecord = {
  body: string;
  id: string;
  language: string;
  level: string;
  title: string | null;
};

type AssessmentRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  level: string | null;
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, name, placement_source, teacher_placement_level")
    .eq("id", studentId)
    .maybeSingle<StudentRecord>();

  if (error) {
    throw new Error("Couldn't load the selected student.");
  }

  return data;
}

async function loadPassage(passageId: string) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const [studentResult, assessmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, placement_source, teacher_placement_level")
      .eq("id", studentId)
      .maybeSingle<StudentRecord>(),
    supabase
      .from("assessments")
      .select("id, student_id, passage_id, level, created_at, analysis_json")
      .eq("student_id", studentId)
      .eq("teacher_confirmed", true)
      .order("created_at", { ascending: false })
      .returns<AssessmentRecord[]>(),
  ]);

  if (studentResult.error || assessmentsResult.error) {
    throw new Error("Couldn't load the student's last reading level.");
  }
  if (!studentResult.data) return null;

  const placement = resolveStudentPlacement({
    confirmedAssessments: assessmentsResult.data ?? [],
    student: studentResult.data,
  });
  const targetLevel = placement.level ?? "letter";
  let language: "en" | "hi" = "en";
  let fallbackPassageId: string | null = null;

  if (placement.kind === "benchmark" && placement.assessmentId) {
    const assessment = (assessmentsResult.data ?? []).find(
      (candidate) => candidate.id === placement.assessmentId,
    );
    fallbackPassageId = assessment?.passage_id ?? null;

    if (fallbackPassageId) {
      const { data: priorPassage, error: priorPassageError } = await supabase
        .from("passages")
        .select("language")
        .eq("id", fallbackPassageId)
        .maybeSingle<{ language: string }>();

      if (priorPassageError) {
        throw new Error("Couldn't load the student's last reading passage.");
      }

      if (priorPassage?.language === "en" || priorPassage?.language === "hi") {
        language = priorPassage.language;
      }
    }
  }

  // A teacher-provisional level is valid for choosing a first passage, but it
  // remains separate from the benchmark model until a reading is confirmed.
  const { data: starterPassage, error: starterPassageError } = await supabase
    .from("passages")
    .select("id")
    .eq("level", targetLevel)
    .eq("language", language)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (starterPassageError) {
    throw new Error("Couldn't load a starter reading passage.");
  }

  return starterPassage?.id ?? fallbackPassageId;
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
  const supabase = await createSupabaseServerClient();
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
