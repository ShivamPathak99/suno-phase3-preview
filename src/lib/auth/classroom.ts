import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentClassroom = {
  id: string;
  mode: "demo" | "teacher";
};

/** Chooses an owned classroom first; anonymous sessions use only the demo room. */
export async function getCurrentClassroom(): Promise<CurrentClassroom | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }
  if (!user) {
    return null;
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
    return null;
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
