/**
 * The pure counterpart to `0002_classrooms.sql`. It gives the offline policy
 * tests a compact, inspectable truth table while the SQL migration remains the
 * runtime authority.
 */
export type ClassroomPolicyActor = {
  userId: string | null;
};

export type ClassroomPolicyClassroom = {
  id: string;
  isDemo: boolean;
  teacherId: string | null;
};

export type ClassroomPolicyStudent = {
  classroomId: string | null;
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function worksheetStudentReference(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.studentId === "string") {
    return value.studentId;
  }

  return isRecord(value.adaptive) && typeof value.adaptive.studentId === "string"
    ? value.adaptive.studentId
    : null;
}

/** Returns the child IDs carried by the established individual/group worksheet contract. */
export function worksheetStudentIds(value: unknown) {
  const reference = worksheetStudentReference(value);

  if (!reference) {
    return [];
  }

  return reference.startsWith("group:")
    ? reference
        .slice("group:".length)
        .split(":")
        .filter((studentId) => studentId.length > 0)
    : [reference];
}

export function canAccessClassroom(
  actor: ClassroomPolicyActor,
  classroom: ClassroomPolicyClassroom,
) {
  return classroom.isDemo || (actor.userId !== null && classroom.teacherId === actor.userId);
}

export function canAccessStudent(
  actor: ClassroomPolicyActor,
  student: ClassroomPolicyStudent,
  classrooms: ReadonlyMap<string, ClassroomPolicyClassroom>,
) {
  const classroom = student.classroomId ? classrooms.get(student.classroomId) : undefined;
  return classroom ? canAccessClassroom(actor, classroom) : false;
}

export function canAccessWorksheet(
  actor: ClassroomPolicyActor,
  contentJson: unknown,
  students: ReadonlyMap<string, ClassroomPolicyStudent>,
  classrooms: ReadonlyMap<string, ClassroomPolicyClassroom>,
) {
  return worksheetStudentIds(contentJson).some((studentId) => {
    const student = students.get(studentId);
    return student ? canAccessStudent(actor, student, classrooms) : false;
  });
}
