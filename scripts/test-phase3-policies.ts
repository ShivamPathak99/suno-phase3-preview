import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canAccessClassroom,
  canAccessStudent,
  canAccessWorksheet,
  worksheetStudentIds,
  type ClassroomPolicyActor,
  type ClassroomPolicyClassroom,
  type ClassroomPolicyStudent,
} from "../src/lib/authz/classroom-policy";

const migrationPath = resolve(process.cwd(), "supabase/migrations/0002_classrooms.sql");
const migration = readFileSync(migrationPath, "utf8");

function expectMigration(fragment: string, description: string) {
  assert.ok(migration.includes(fragment), `Migration must ${description}.`);
}

for (const table of ["classrooms", "students", "assessments", "worksheets"]) {
  expectMigration(`alter table public.${table} enable row level security;`, `enable RLS on ${table}`);
  expectMigration(`create policy ${table}_access`, `create the ${table} access policy`);
  expectMigration("to anon, authenticated", "scope access policies to browser roles");
}

expectMigration(
  "teacher_id = (select auth.uid())\n  or is_demo = true",
  "grant classroom access to its teacher or to the demo",
);
expectMigration(
  "join public.classrooms classroom on classroom.id = student.classroom_id",
  "chain child records through their classroom",
);
expectMigration("worksheets.content_json ->> 'studentId'", "chain individual worksheets to a student");
expectMigration("like 'group:%'", "chain group worksheets to their listed students");

const actorTeacherA: ClassroomPolicyActor = { userId: "teacher-a" };
const actorTeacherB: ClassroomPolicyActor = { userId: "teacher-b" };
const actorAnonymous: ClassroomPolicyActor = { userId: null };

const classrooms = new Map<string, ClassroomPolicyClassroom>([
  ["class-a", { id: "class-a", isDemo: false, teacherId: "teacher-a" }],
  ["class-b", { id: "class-b", isDemo: false, teacherId: "teacher-b" }],
  ["demo", { id: "demo", isDemo: true, teacherId: null }],
]);
const students = new Map<string, ClassroomPolicyStudent>([
  ["student-a", { classroomId: "class-a", id: "student-a" }],
  ["student-b", { classroomId: "class-b", id: "student-b" }],
  ["student-demo", { classroomId: "demo", id: "student-demo" }],
]);

// Authorized read: the teacher sees their classroom and every row chained to it.
assert.equal(canAccessClassroom(actorTeacherA, classrooms.get("class-a")!), true);
assert.equal(canAccessClassroom(actorTeacherA, classrooms.get("demo")!), true);
assert.equal(canAccessStudent(actorTeacherA, students.get("student-a")!, classrooms), true);
assert.equal(
  canAccessWorksheet(actorTeacherA, { studentId: "student-a" }, students, classrooms),
  true,
);

// Cross-tenant denial: a teacher cannot read a different teacher's child or worksheet.
assert.equal(canAccessStudent(actorTeacherA, students.get("student-b")!, classrooms), false);
assert.equal(
  canAccessWorksheet(actorTeacherA, { studentId: "student-b" }, students, classrooms),
  false,
);
assert.equal(canAccessClassroom(actorTeacherB, classrooms.get("class-a")!), false);

// Demo visibility and anonymous demo write eligibility come from the same rule.
assert.equal(canAccessClassroom(actorAnonymous, classrooms.get("demo")!), true);
assert.equal(canAccessStudent(actorAnonymous, students.get("student-demo")!, classrooms), true);
assert.equal(
  canAccessWorksheet(actorAnonymous, { studentId: "student-demo" }, students, classrooms),
  true,
);

assert.deepEqual(worksheetStudentIds({ studentId: "group:student-a:student-demo" }), [
  "student-a",
  "student-demo",
]);
assert.equal(
  canAccessWorksheet(
    actorAnonymous,
    { studentId: "group:student-a:student-demo" },
    students,
    classrooms,
  ),
  true,
);
assert.equal(canAccessWorksheet(actorTeacherB, {}, students, classrooms), false);

console.log("Phase 3 RLS scratch-policy checks passed.");
