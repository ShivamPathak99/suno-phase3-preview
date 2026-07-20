import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { createMathCheckStartHandler } from "../src/app/api/math/checks/route";
import { createMathCheckCompletionHandler } from "../src/app/api/math/checks/[assessmentId]/route";
import { mathInstrumentPassageId, type MathCheckDraft } from "../src/lib/adaptive/math/check-contract";
import { generateProbeItems } from "../src/lib/adaptive/math/item-generator";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";

const studentId = "10000000-0000-4000-8000-000000000001";
const assessmentId = "40000000-0000-4000-8000-000000000001";
const state: {
  insertedRow: Record<string, unknown> | null;
  savedAnalysis: MathCheckDraft | null;
} = { insertedRow: null, savedAnalysis: null };

const client = {
  from(table: string) {
    if (table === "students") {
      return {
        select() {
          return { eq: () => ({ maybeSingle: async () => ({ data: { id: studentId, name: "Arjun" }, error: null }) }) };
        },
      };
    }

    if (table === "passages") {
      return {
        select() {
          return {
            eq: (column: string, value: string) => ({
              maybeSingle: async () => ({
                data: column === "id" && value === mathInstrumentPassageId ? { id: value } : null,
                error: null,
              }),
            }),
          };
        },
      };
    }

    if (table === "assessments") {
      return {
        insert(row: Record<string, unknown>) {
          state.insertedRow = row;
          state.savedAnalysis = row.analysis_json as MathCheckDraft;
          return { select: () => ({ single: async () => ({ data: { id: assessmentId }, error: null }) }) };
        },
        select() {
          return {
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: state.savedAnalysis
                    ? { analysis_json: state.savedAnalysis, id: assessmentId, student_id: studentId, teacher_confirmed: false }
                    : null,
                  error: null,
                }),
              }),
            }),
          };
        },
        update(row: Record<string, unknown>) {
          state.savedAnalysis = row.analysis_json as MathCheckDraft;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({ maybeSingle: async () => ({ data: { id: assessmentId }, error: null }) }),
              }),
            }),
          };
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  },
} as unknown as ReturnType<typeof createSupabaseAdminClient>;

async function main() {
  const start = createMathCheckStartHandler({
    createAdminClient: () => client,
    createSeed: () => "route-seed",
    generateItems: generateProbeItems,
  });
  const startResponse = await start(
    new NextRequest("http://localhost/api/math/checks", {
      body: JSON.stringify({ studentId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(startResponse.status, 201);
  const started = (await startResponse.json()) as {
    assessmentId: string;
    items: ReturnType<typeof generateProbeItems>;
  };
  assert.equal(started.assessmentId, assessmentId);
  assert.equal(started.items.length, 8);
  assert.equal(state.insertedRow?.passage_id, mathInstrumentPassageId);
  assert.equal((state.insertedRow?.analysis_json as MathCheckDraft).v, "math-check.v1");
  assert.equal(state.insertedRow?.teacher_confirmed, false);

  const complete = createMathCheckCompletionHandler({ createAdminClient: () => client });
  const completeResponse = await complete(
    new NextRequest(`http://localhost/api/math/checks/${assessmentId}`, {
      body: JSON.stringify({
        answers: started.items.map((item) => ({ answer: item.answer, itemId: item.id })),
        elapsedSec: 18,
        studentId,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    { params: Promise.resolve({ assessmentId }) },
  );
  assert.equal(
    completeResponse.status,
    200,
    JSON.stringify(await completeResponse.clone().json()),
  );
  assert.equal(state.savedAnalysis?.answers.length, 8);

  console.log("P2-T20 math-check routes passed: draft, sentinel storage, and completed answers.");
}

void main();
