import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTeacherProvisioningArgs } from "../src/lib/auth/provisioning";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const input = parseTeacherProvisioningArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
  });

  if (createUserError || !createdUser.user) {
    throw createUserError ?? new Error("Supabase did not return the provisioned teacher.");
  }

  const { error: classroomError } = await supabase.from("classrooms").insert({
    grade: input.grade,
    is_demo: false,
    name: input.classroomName,
    teacher_id: createdUser.user.id,
  });

  if (classroomError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined);
    throw classroomError;
  }

  const { data: passwordLink, error: passwordLinkError } = await supabase.auth.admin.generateLink({
    email: input.email,
    type: "recovery",
  });

  if (passwordLinkError || !passwordLink.properties.action_link) {
    throw passwordLinkError ?? new Error("Supabase did not generate a set-password link.");
  }

  // Preview-only provisioning: no email provider is configured in Phase 3.
  console.log(`Teacher provisioned for ${input.classroomName}.`);
  console.log("Set-password link (share manually; do not commit or log it elsewhere):");
  console.log(passwordLink.properties.action_link);
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(`Teacher provisioning failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
  });
}
