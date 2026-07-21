import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { createStudentPostHandler } from "../src/app/api/students/route";
import { createStudentPatchHandler } from "../src/app/api/students/[studentId]/route";
import type { CurrentClassroom } from "../src/lib/auth/classroom";
import type { UserScopedSupabaseClient } from "../src/lib/supabase/user-scoped";

const classroom: CurrentClassroom = { id: "10000000-0000-4000-8000-000000000001", mode: "teacher" };
const studentId = "20000000-0000-4000-8000-000000000001";
const state: {
  roster: Array<Record<string, unknown>>;
} = { roster: [] };

const client = {
  from(table: string) {
    if (table !== "students") throw new Error(`Unexpected table: ${table}`);

    return {
      select(columns: string) {
        return {
          eq() {
            if (columns === "id") {
              return {
                maybeSingle: async () => ({
                  data: state.roster[0] ? { id: state.roster[0].id } : null,
                  error: null,
                }),
              };
            }

            return {
              returns: async () => ({ data: state.roster, error: null }),
            };
          },
        };
      },
      insert(row: Record<string, unknown>) {
        const student = { id: studentId, ...row };
        state.roster.push(student);
        return {
          select() {
            return { single: async () => ({ data: student, error: null }) };
          },
        };
      },
      update(changes: Record<string, unknown>) {
        Object.assign(state.roster[0]!, changes);
        return {
          eq() {
            return {
              select() {
                return { maybeSingle: async () => ({ data: state.roster[0], error: null }) };
              },
            };
          },
        };
      },
    };
  },
} as unknown as UserScopedSupabaseClient;

async function main() {
  const create = createStudentPostHandler({
    createSupabaseClient: () => client,
    getClassroom: async () => classroom,
  });
  const createResponse = await create(
    new NextRequest("http://localhost/api/students", {
      body: JSON.stringify({ grade: "3", name: "Meera", startingLevel: "word" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(createResponse.status, 201, JSON.stringify(await createResponse.clone().json()));
  const created = (await createResponse.json()) as { duplicateName: boolean; student: Record<string, unknown> };
  assert.equal(created.duplicateName, false);
  assert.equal(created.student.classroom_id, classroom.id);
  assert.equal(created.student.placement_source, "teacher");
  assert.equal(created.student.teacher_placement_level, "word");

  // Simulate a past benchmark, then manually place the child again: F2-E5.
  state.roster[0]!.placement_source = "benchmark";
  state.roster[0]!.teacher_placement_level = null;
  const patch = createStudentPatchHandler({ createSupabaseClient: () => client });
  const patchResponse = await patch(
    new NextRequest(`http://localhost/api/students/${studentId}`, {
      body: JSON.stringify({ startingLevel: "story" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }),
    { params: Promise.resolve({ studentId }) },
  );
  assert.equal(patchResponse.status, 200, JSON.stringify(await patchResponse.clone().json()));
  const patched = (await patchResponse.json()) as { student: Record<string, unknown> };
  assert.equal(patched.student.placement_source, "teacher");
  assert.equal(patched.student.teacher_placement_level, "story");

  const archiveResponse = await patch(
    new NextRequest(`http://localhost/api/students/${studentId}`, {
      body: JSON.stringify({ isArchived: true }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }),
    { params: Promise.resolve({ studentId }) },
  );
  assert.equal(archiveResponse.status, 200);
  assert.equal(state.roster[0]?.is_archived, true, "archive preserves the student record");

  console.log("P3-T6 student routes passed: RLS-scoped create, manual re-placement, and archive.");
}

void main();
