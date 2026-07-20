import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";

import { demoStudentIds } from "./seed";
import { resetDemoData } from "./reset-demo";

type Call = {
  action: "delete" | "eq" | "in" | "select" | "upsert";
  column?: string;
  table: string;
  values?: unknown;
};

function createFixtureClient({ protectedDemoId = false } = {}) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      return {
        delete() {
          calls.push({ action: "delete", table });
          return {
            in(column: string, values: unknown) {
              calls.push({ action: "in", column, table, values });
              return Promise.resolve({ error: null });
            },
          };
        },
        select(columns: string, options?: { count?: string; head?: boolean }) {
          calls.push({ action: "select", table });

          return {
            eq(column: string, values: unknown) {
              calls.push({ action: "eq", column, table, values });

              if (table === "students" && columns === "id" && !options?.head) {
                return Promise.resolve({ data: [{ id: demoStudentIds[0] }], error: null });
              }

              return Promise.resolve({ count: 20, data: null, error: null });
            },
            in(column: string, values: unknown) {
              calls.push({ action: "in", column, table, values });

              if (table === "students" && columns === "id, is_demo") {
                return Promise.resolve({
                  data: protectedDemoId
                    ? [{ id: demoStudentIds[0], is_demo: false }]
                    : [],
                  error: null,
                });
              }

              if (table === "assessments" && columns === "id, student_id") {
                return Promise.resolve({ data: [], error: null });
              }

              if (table === "assessments" && columns === "id") {
                return Promise.resolve({ count: 3, data: null, error: null });
              }

              if (table === "passages") {
                return Promise.resolve({ count: 10, data: null, error: null });
              }

              if (table === "assessments" && columns === "*") {
                return Promise.resolve({ count: 24, data: null, error: null });
              }

              return Promise.resolve({ count: 20, data: null, error: null });
            },
          };
        },
        upsert() {
          calls.push({ action: "upsert", table });
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;

  return { calls, client };
}

async function main() {
  const dryRunFixture = createFixtureClient();
  const dryRun = await resetDemoData(dryRunFixture.client, { dryRun: true });

  assert.deepEqual(dryRun, { assessmentCount: 3, dryRun: true, studentCount: 1 });
  assert.equal(
    dryRunFixture.calls.some((call) => call.action === "delete" || call.action === "upsert"),
    false,
    "Dry run must not delete or recreate any rows.",
  );

  const resetFixture = createFixtureClient();
  await resetDemoData(resetFixture.client, { dryRun: false });

  const assessmentDelete = resetFixture.calls.find(
    (call) => call.action === "in" && call.table === "assessments" && call.column === "student_id",
  );
  const studentIdFilters = resetFixture.calls.filter(
    (call) => call.action === "in" && call.table === "students" && call.column === "id",
  );
  const studentDelete = studentIdFilters[studentIdFilters.length - 1];

  assert.deepEqual(assessmentDelete?.values, [demoStudentIds[0]]);
  assert.deepEqual(studentDelete?.values, [demoStudentIds[0]]);
  assert.ok(
    resetFixture.calls.some((call) => call.action === "upsert" && call.table === "students"),
    "A reset must restore the deterministic demo students after deleting them.",
  );

  const protectedFixture = createFixtureClient({ protectedDemoId: true });
  await assert.rejects(
    resetDemoData(protectedFixture.client, { dryRun: false }),
    /protected non-demo data/,
  );
  assert.equal(
    protectedFixture.calls.some((call) => call.action === "delete"),
    false,
    "A protected-ID collision must stop before any delete.",
  );

  console.log("P2-T3 reset-demo contract passed: dry run, scoped reset, and collision guard.");
}

void main();
