import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentClassroom = {
  id: string;
  mode: "demo" | "teacher";
};

/** A real teacher who has not been provisioned yet starts with this empty class. */
export const defaultTeacherClassroomName = "My classroom";

/** Chooses an owned classroom first; anonymous sessions use only the demo room. */
export async function getCurrentClassroom(): Promise<CurrentClassroom | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }
  if (userError) {
    throw userError;
  }

  const { data: ownedClassroom, error: ownedClassroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("teacher_id", user.id)
    .maybeSingle<{ id: string }>();

  if (ownedClassroomError) {
    throw ownedClassroomError;
  }
  if (ownedClassroom) {
    return { id: ownedClassroom.id, mode: "teacher" };
  }

  if (user.is_anonymous !== true) {
    // A preview teacher can arrive through a direct Supabase Auth account
    // rather than the provisioning script. Give that authenticated teacher a
    // single empty classroom on first visit, using the same RLS-scoped client
    // as normal application traffic. This prevents a confusing empty board
    // that cannot accept its first child.
    const { data: createdClassroom, error: createClassroomError } = await supabase
      .from("classrooms")
      .insert({
        grade: null,
        is_demo: false,
        name: defaultTeacherClassroomName,
        teacher_id: user.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (createdClassroom) {
      return { id: createdClassroom.id, mode: "teacher" };
    }

    // A parallel page/API request can create the class between the first
    // lookup and this insert. Re-read before surfacing an actual database
    // error, so first-time entry remains idempotent in ordinary use.
    const { data: concurrentClassroom, error: concurrentLookupError } = await supabase
      .from("classrooms")
      .select("id")
      .eq("teacher_id", user.id)
      .maybeSingle<{ id: string }>();

    if (concurrentLookupError) {
      throw concurrentLookupError;
    }
    if (concurrentClassroom) {
      return { id: concurrentClassroom.id, mode: "teacher" };
    }

    throw createClassroomError ?? new Error("Couldn't create the teacher's classroom.");
  }

  const { data: demoClassroom, error: demoClassroomError } = await supabase
    .from("classrooms")
    .select("id")
    .eq("is_demo", true)
    .maybeSingle<{ id: string }>();

  if (demoClassroomError) {
    throw demoClassroomError;
  }

  return demoClassroom ? { id: demoClassroom.id, mode: "demo" } : null;
}
