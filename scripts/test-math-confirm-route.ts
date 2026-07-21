import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { createMathCheckConfirmHandler } from "../src/app/api/math/checks/[assessmentId]/confirm/route";
import arjunFixture from "../src/lib/adaptive/math/__fixtures__/arjun-diagnosis.json";
import { completeMathCheck, createMathCheckDraft, type MathCheckDraft } from "../src/lib/adaptive/math/check-contract";
import type { MathItem } from "../src/lib/adaptive/math/item-generator";
import type { UserScopedSupabaseClient } from "../src/lib/supabase/user-scoped";

const assessmentId = "40000000-0000-4000-8000-000000000021";
const studentId = "10000000-0000-4000-8000-000000000019";
const items = arjunFixture.responses.map((response) => response.item) as MathItem[];
const state: { analysis: MathCheckDraft; teacherConfirmed: boolean } = {
  analysis: completeMathCheck(
    createMathCheckDraft({ items, seed: "arjun-confirm" }),
    {
      answers: arjunFixture.responses.map((response) => ({ answer: response.answer, itemId: response.item.id })),
      elapsedSec: 16,
    },
  ),
  teacherConfirmed: false,
};

const client = {
  from(table: string) {
    if (table !== "assessments") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select() {
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  analysis_json: state.analysis,
                  created_at: "2026-03-01T09:00:00.000Z",
                  id: assessmentId,
                  student_id: studentId,
                  teacher_confirmed: state.teacherConfirmed,
                },
                error: null,
              }),
            }),
          }),
        };
      },
      update(row: { analysis_json: MathCheckDraft; teacher_confirmed: boolean }) {
        state.analysis = row.analysis_json;
        state.teacherConfirmed = row.teacher_confirmed;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: assessmentId }, error: null }) }),
            }),
          }),
        };
      },
    };
  },
} as unknown as UserScopedSupabaseClient;

async function main() {
  const handler = createMathCheckConfirmHandler({ createSupabaseClient: () => client });
  const response = await handler(
    new NextRequest(`http://localhost/api/math/checks/${assessmentId}/confirm`, {
      body: JSON.stringify({
        reviews: items.map((item) => ({ itemId: item.id, reviewTag: "slip" })),
        studentId,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    { params: Promise.resolve({ assessmentId }) },
  );

  assert.equal(response.status, 200);
  assert.equal(state.teacherConfirmed, true);
  const adaptive = state.analysis._adaptive as typeof state.analysis._adaptive & {
    evidence: unknown[];
    mathDiagnosis: { bugs: Record<string, { confirmed: boolean; score: number }> };
  };
  assert.equal(adaptive.evidence.length, 0);
  assert.equal(adaptive.mathDiagnosis.bugs["add.dropped_carry"]?.score, 0);
  assert.equal(adaptive.mathDiagnosis.bugs["add.dropped_carry"]?.confirmed, false);

  console.log("P2-T21 confirmation route passed: slip re-tag persists no dropped-carry evidence.");
}

void main();
