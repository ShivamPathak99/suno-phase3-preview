export type TeacherProvisioningInput = {
  classroomName: string;
  email: string;
  grade: string | null;
};

function requiredValue(values: ReadonlyMap<string, string>, key: string) {
  const value = values.get(key)?.trim();
  if (!value) {
    throw new Error(`Missing ${key}.`);
  }
  return value;
}

export function parseTeacherProvisioningArgs(args: readonly string[]): TeacherProvisioningInput {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined || values.has(key)) {
      throw new Error(
        "Usage: npm.cmd run create-teacher -- --email teacher@example.com --classroom \"Class 3A\" [--grade 3]",
      );
    }
    values.set(key, value);
  }

  if ([...values.keys()].some((key) => key !== "--email" && key !== "--classroom" && key !== "--grade")) {
    throw new Error(
      "Usage: npm.cmd run create-teacher -- --email teacher@example.com --classroom \"Class 3A\" [--grade 3]",
    );
  }

  const email = requiredValue(values, "--email").toLowerCase();
  const classroomName = requiredValue(values, "--classroom");
  const grade = values.get("--grade")?.trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error("--email must be a valid email address.");
  }

  return { classroomName, email, grade };
}
