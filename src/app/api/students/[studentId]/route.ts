import { NextRequest, NextResponse } from "next/server";

import { parsePatchStudentInput } from "@/lib/student-contract";
import {
  isAuthenticationRequiredError,
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

export const runtime = "nodejs";

type StudentRecord = {
  classroom_id: string;
  grade: string | null;
  id: string;
  is_archived: boolean;
  name: string;
  placement_source: "benchmark" | "teacher";
  teacher_placement_level: string | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

async function createUserScopedClient() {
  const { supabase } = await requireUserScopedSupabase();
  return supabase;
}

export function createStudentPatchHandler({
  createSupabaseClient = createUserScopedClient,
}: {
  createSupabaseClient?: () => UserScopedSupabaseClient | Promise<UserScopedSupabaseClient>;
} = {}) {
  return async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ studentId: string }> },
  ) {
    const { studentId } = await params;
    if (!isUuid(studentId)) {
      return jsonError("studentId must be a UUID.", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const input = parsePatchStudentInput(body);
    if (!input) {
      return jsonError("Provide a valid name, grade, archive state, or starting level.", 400);
    }

    try {
      const supabase = await createSupabaseClient();
      const { data: existing, error: existingError } = await supabase
        .from("students")
        .select("id")
        .eq("id", studentId)
        .maybeSingle<{ id: string }>();

      if (existingError) {
        console.error("Student lookup failed.", existingError);
        return jsonError("Couldn't update the child. Please try again.", 502);
      }
      if (!existing) {
        // RLS intentionally makes cross-classroom ids indistinguishable from
        // missing ids, avoiding tenancy information leaks.
        return jsonError("The selected child was not found.", 404);
      }

      const changes: Record<string, string | boolean | null> = {};
      if (input.name !== undefined) changes.name = input.name;
      if (input.grade !== undefined) changes.grade = input.grade;
      if (input.isArchived !== undefined) changes.is_archived = input.isArchived;
      if (input.startingLevel !== undefined) {
        // F2-E5: a manual placement is always provisional again, even after
        // a prior benchmark. It never manufactures assessment evidence.
        changes.placement_source = "teacher";
        changes.teacher_placement_level = input.startingLevel;
      }

      const { data: student, error: updateError } = await supabase
        .from("students")
        .update(changes)
        .eq("id", studentId)
        .select(
          "id, name, grade, classroom_id, is_archived, placement_source, teacher_placement_level",
        )
        .maybeSingle<StudentRecord>();

      if (updateError || !student) {
        console.error("Student update failed.", updateError);
        return jsonError("Couldn't update the child. Please try again.", 502);
      }

      return NextResponse.json({ student });
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        return jsonError("Signed out — sign back in before continuing.", 401);
      }

      console.error("Student update route failed.", error);
      return jsonError("Couldn't update the child. Please try again.", 502);
    }
  };
}

export const PATCH = createStudentPatchHandler();
