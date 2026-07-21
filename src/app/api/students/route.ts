import { NextRequest, NextResponse } from "next/server";

import { getCurrentClassroom, type CurrentClassroom } from "@/lib/auth/classroom";
import {
  maxActiveStudents,
  parseCreateStudentInput,
  rosterWarningThreshold,
  sameStudentName,
} from "@/lib/student-contract";
import {
  isAuthenticationRequiredError,
  requireUserScopedSupabase,
  type UserScopedSupabaseClient,
} from "@/lib/supabase/user-scoped";

export const runtime = "nodejs";

type RosterStudent = {
  id: string;
  is_archived: boolean | null;
  name: string;
};

type CreatedStudent = {
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

async function createUserScopedClient() {
  const { supabase } = await requireUserScopedSupabase();
  return supabase;
}

/**
 * The route deliberately obtains the classroom through the same user session
 * as the insert. RLS remains the data boundary; this adds a clear API-level
 * refusal when a signed-in user does not yet own a classroom.
 */
export function createStudentPostHandler({
  createSupabaseClient = createUserScopedClient,
  getClassroom = getCurrentClassroom,
}: {
  createSupabaseClient?: () => UserScopedSupabaseClient | Promise<UserScopedSupabaseClient>;
  getClassroom?: () => Promise<CurrentClassroom | null>;
} = {}) {
  return async function POST(request: NextRequest) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const input = parseCreateStudentInput(body);
    if (!input) {
      return jsonError(
        "Name must be 1–40 letters (Latin or Devanagari); grade and starting level must be valid.",
        400,
      );
    }

    try {
      const [supabase, classroom] = await Promise.all([createSupabaseClient(), getClassroom()]);

      if (!classroom) {
        return jsonError("A classroom is required before adding a child.", 403);
      }

      const { data: roster, error: rosterError } = await supabase
        .from("students")
        .select("id, name, is_archived")
        .eq("classroom_id", classroom.id)
        .returns<RosterStudent[]>();

      if (rosterError) {
        console.error("Student roster lookup failed.", rosterError);
        return jsonError("Couldn't check the class roster. Please try again.", 502);
      }

      const activeRoster = (roster ?? []).filter((student) => student.is_archived !== true);
      if (activeRoster.length >= maxActiveStudents) {
        return jsonError("This class already has 120 active children. Archive a child before adding another.", 409);
      }

      const duplicateName = activeRoster.some((student) => sameStudentName(student.name, input.name));
      const { data: student, error: insertError } = await supabase
        .from("students")
        .insert({
          classroom_id: classroom.id,
          grade: input.grade,
          is_archived: false,
          is_demo: classroom.mode === "demo",
          name: input.name,
          placement_source: input.startingLevel ? "teacher" : "benchmark",
          teacher_placement_level: input.startingLevel,
        })
        .select(
          "id, name, grade, classroom_id, is_archived, placement_source, teacher_placement_level",
        )
        .single<CreatedStudent>();

      if (insertError || !student) {
        console.error("Student insert failed.", insertError);
        return jsonError("Couldn't add the child. Please try again.", 502);
      }

      return NextResponse.json(
        {
          duplicateName,
          rosterWarning:
            activeRoster.length + 1 >= rosterWarningThreshold
              ? "Suno groups work best under 60 children."
              : null,
          student,
        },
        { status: 201 },
      );
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        return jsonError("Signed out — sign back in before continuing.", 401);
      }

      console.error("Student create route failed.", error);
      return jsonError("Couldn't add the child. Please try again.", 502);
    }
  };
}

export const POST = createStudentPostHandler();
