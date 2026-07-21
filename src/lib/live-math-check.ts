import { isMathCheckDraft, type MathCheckDraft } from "@/lib/adaptive/math/check-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MathAssessmentRecord = {
  analysis_json: unknown;
  created_at: string;
  id: string;
  student_id: string;
  teacher_confirmed: boolean;
};

type StudentRecord = { id: string; name: string };

export type LiveMathCheck = {
  assessmentId: string;
  check: MathCheckDraft;
  createdAt: string;
  student: StudentRecord;
  teacherConfirmed: boolean;
};

export async function loadLiveMathCheck(
  studentId: string,
  assessmentId: string,
): Promise<LiveMathCheck | null> {
  const supabase = await createSupabaseServerClient();
  const [assessmentResult, studentResult] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, student_id, analysis_json, teacher_confirmed, created_at")
      .eq("id", assessmentId)
      .eq("student_id", studentId)
      .maybeSingle<MathAssessmentRecord>(),
    supabase.from("students").select("id, name").eq("id", studentId).maybeSingle<StudentRecord>(),
  ]);

  if (assessmentResult.error || studentResult.error) {
    throw new Error("Couldn't load the math check.");
  }
  if (!assessmentResult.data || !studentResult.data || !isMathCheckDraft(assessmentResult.data.analysis_json)) {
    return null;
  }

  return {
    assessmentId: assessmentResult.data.id,
    check: assessmentResult.data.analysis_json,
    createdAt: assessmentResult.data.created_at,
    student: studentResult.data,
    teacherConfirmed: assessmentResult.data.teacher_confirmed,
  };
}
