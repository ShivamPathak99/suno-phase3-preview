import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import { worksheetStudentIds } from "../src/lib/authz/classroom-policy";
import {
  createDemoSupabaseAdminClient,
  demoAssessmentIds,
  demoClassroomId,
  demoStudentIds,
  seedDemoData,
} from "./seed";

export const previewResetConfirmation = "phase3-preview";

type DemoResetOptions = {
  dryRun: boolean;
};

type DemoResetSummary = {
  assessmentCount: number;
  dryRun: boolean;
  studentCount: number;
};

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const candidate = error as {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      message?: unknown;
    };
    const parts = [candidate.message, candidate.details, candidate.hint, candidate.code].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return "Unknown error";
}

function assertNoProtectedSeedCollisions(
  students: Array<{ id: string; is_demo: boolean | null }> | null,
  assessments: Array<{ id: string; student_id: string | null }> | null,
) {
  const protectedStudentCount = (students ?? []).filter(
    (student) => student.is_demo !== true,
  ).length;
  const protectedAssessmentCount = (assessments ?? []).filter(
    (assessment) =>
      assessment.student_id === null || !demoStudentIds.includes(assessment.student_id),
  ).length;

  if (protectedStudentCount > 0 || protectedAssessmentCount > 0) {
    throw new Error(
      "Reset stopped because a seeded demo ID belongs to protected non-demo data. No rows were changed.",
    );
  }
}

/**
 * Restores only the demo classroom chain. Worksheet ownership is carried by
 * content_json.studentId, so teacher-owned cards are never included in a reset.
 */
export async function resetDemoData(
  supabase: SupabaseClient,
  { dryRun }: DemoResetOptions,
): Promise<DemoResetSummary> {
  const [
    { data: protectedStudentRows, error: protectedStudentsError },
    { data: protectedAssessmentRows, error: protectedAssessmentsError },
    { data: demoStudentRows, error: demoStudentsError },
    { data: worksheetRows, error: worksheetsError },
  ] = await Promise.all([
    supabase.from("students").select("id, is_demo").in("id", demoStudentIds),
    supabase
      .from("assessments")
      .select("id, student_id")
      .in("id", demoAssessmentIds),
    supabase.from("students").select("id").eq("classroom_id", demoClassroomId),
    supabase.from("worksheets").select("id, content_json"),
  ]);

  if (protectedStudentsError || protectedAssessmentsError || demoStudentsError || worksheetsError) {
    throw protectedStudentsError ?? protectedAssessmentsError ?? demoStudentsError ?? worksheetsError;
  }

  assertNoProtectedSeedCollisions(
    protectedStudentRows as Array<{ id: string; is_demo: boolean | null }> | null,
    protectedAssessmentRows as Array<{ id: string; student_id: string | null }> | null,
  );

  const currentDemoStudentIds = (demoStudentRows ?? []).map((student) => student.id);
  const currentDemoStudentIdSet = new Set([...demoStudentIds, ...currentDemoStudentIds]);
  const demoWorksheetIds = (worksheetRows ?? [])
    .filter((worksheet) =>
      worksheetStudentIds(worksheet.content_json).some((studentId) =>
        currentDemoStudentIdSet.has(studentId),
      ),
    )
    .map((worksheet) => worksheet.id);
  let assessmentCount = 0;

  if (currentDemoStudentIds.length > 0) {
    const { count, error } = await supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .in("student_id", currentDemoStudentIds);

    if (error) {
      throw error;
    }

    assessmentCount = count ?? 0;
  }

  if (dryRun) {
    return {
      assessmentCount,
      dryRun: true,
      studentCount: currentDemoStudentIds.length,
    };
  }

  if (currentDemoStudentIds.length > 0) {
    const { error: deleteAssessmentsError } = await supabase
      .from("assessments")
      .delete()
      .in("student_id", currentDemoStudentIds);

    if (deleteAssessmentsError) {
      throw deleteAssessmentsError;
    }

    const { error: deleteStudentsError } = await supabase
      .from("students")
      .delete()
      .in("id", currentDemoStudentIds);

    if (deleteStudentsError) {
      throw deleteStudentsError;
    }
  }

  if (demoWorksheetIds.length > 0) {
    const { error: deleteWorksheetsError } = await supabase
      .from("worksheets")
      .delete()
      .in("id", demoWorksheetIds);

    if (deleteWorksheetsError) {
      throw deleteWorksheetsError;
    }
  }

  await seedDemoData(supabase);

  return {
    assessmentCount,
    dryRun: false,
    studentCount: currentDemoStudentIds.length,
  };
}

function parseOptions(args: string[]): DemoResetOptions {
  if (args.some((arg) => arg !== "--dry-run")) {
    throw new Error("Usage: npm.cmd run reset-demo [-- --dry-run]");
  }

  return { dryRun: args.includes("--dry-run") };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  if (!options.dryRun && process.env.SUNO_DEMO_RESET_TARGET !== previewResetConfirmation) {
    throw new Error(
      `Set SUNO_DEMO_RESET_TARGET=${previewResetConfirmation} before resetting the Phase 3 preview database.`,
    );
  }

  const result = await resetDemoData(createDemoSupabaseAdminClient(), options);

  if (result.dryRun) {
    console.log(
      `Dry run: would replace ${result.studentCount} demo students and ${result.assessmentCount} assessments; non-demo rows stay untouched.`,
    );
    return;
  }

  console.log(
    `Demo reset complete: replaced ${result.studentCount} demo students and ${result.assessmentCount} assessments.`,
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(`Demo reset failed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
