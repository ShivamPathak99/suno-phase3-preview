import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { createWorksheetPostHandler } from "../src/app/api/worksheets/route";
import type { AdaptiveAssessmentPayload } from "../src/lib/adaptive/confirmation";
import type { WorksheetContent } from "../src/lib/worksheetSchema";

const studentId = "10000000-0000-4000-8000-000000000001";

function requestFor(payload: unknown) {
  return new NextRequest("http://localhost/api/worksheets", {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function evidence(assessmentId: string, occurredAt: string): AdaptiveAssessmentPayload {
  return {
    candidateSignals: [],
    evidence: ["ship", "shop", "fish"].map((distinctWordKey, index) => ({
      accuracyCredit: index === 0 ? 1 : 0.1,
      assessmentId,
      automaticityCredit: index === 0 ? 1 : 0,
      directness: 1,
      distinctWordKey,
      occurredAt,
      outcome: index === 0 ? "correct" : "substituted",
      purpose: "benchmark",
      skillId: "en.digraph.sh",
      studentId,
      teacherConfirmed: true,
      v: "adaptive-evidence.v1",
      weight: 1,
    })),
    evidenceSummaryBySkill: {
      "en.digraph.sh": { errors: 2, hesitations: 0, opportunities: 3, readings: 1 },
    },
    focus: {
      evidenceSummary: { errors: 2, hesitations: 0, opportunities: 3, readings: 1 },
      kind: "focused_card",
      reason: "2 substitutions across 3 chances in 1 reading.",
      skillId: "en.digraph.sh",
      source: "algorithmic",
    },
    purpose: "benchmark",
    v: "adaptive-evidence.v1",
  };
}

function createSupabaseFixture(options: {
  history?: AdaptiveAssessmentPayload[];
  mostRecentCardId?: string;
} = {}) {
  const insertedPassages: Array<Record<string, unknown>> = [];
  const insertedWorksheets: Array<Record<string, unknown>> = [];
  const history = options.history ?? [];
  const worksheetRows = options.mostRecentCardId
    ? [
        {
          content_json: {
            adaptive: { cardId: options.mostRecentCardId, v: "adaptive-card.v1" },
            studentId,
            v: "adaptive-worksheet.v1",
          },
        },
      ]
    : [];

  const client = {
    from(table: string) {
      if (table === "students") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { id: studentId, name: "Maya" }, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === "assessments") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      order: async () => ({
                        data: history.map((payload) => ({ analysis_json: { _adaptive: payload } })),
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "worksheets") {
        return {
          insert(value: Record<string, unknown>) {
            insertedWorksheets.push(value);
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "worksheet-created" }, error: null }),
                };
              },
            };
          },
          select() {
            return {
              contains() {
                return {
                  order() {
                    return {
                      limit: async () => ({ data: worksheetRows, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "passages") {
        return {
          delete() {
            return { eq: async () => ({ data: null, error: null }) };
          },
          insert(value: Record<string, unknown>) {
            insertedPassages.push(value);
            return {
              select() {
                return {
                  single: async () => ({ data: { id: "passage-created" }, error: null }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { client, insertedPassages, insertedWorksheets };
}

async function main() {
const legacyWorksheet: WorksheetContent = {
  body: "sun bus cup red fish book milk hand mango water school chair",
  question: "Which word names something you can drink?",
  title: "Everyday words",
};
let legacyAdminCalled = false;
const legacyHandler = createWorksheetPostHandler({
  createSupabaseAdminClient: () => {
    legacyAdminCalled = true;
    throw new Error("Legacy worksheet requests must not use Supabase.");
  },
  generateWorksheet: async () => ({ model: "test-model", worksheet: legacyWorksheet }),
});
const legacyResponse = await legacyHandler(requestFor({ language: "en", level: "word" }));
assert.equal(legacyResponse.status, 200);
assert.deepEqual(await legacyResponse.json(), legacyWorksheet);
assert.equal(legacyAdminCalled, false, "Legacy path must remain byte-shape compatible and isolated.");

const directFixture = createSupabaseFixture({ mostRecentCardId: "en.digraph.sh.card1" });
const directHandler = createWorksheetPostHandler({
  createSupabaseAdminClient: () => directFixture.client,
  generateWorksheet: async () => {
    throw new Error("Adaptive requests must use the curated catalog, never GPT.");
  },
});
const directResponse = await directHandler(
  requestFor({
    adaptive: { focusSkillId: "en.digraph.sh", studentId },
    language: "en",
    level: "word",
  }),
);
assert.equal(directResponse.status, 200);
const directPayload = (await directResponse.json()) as {
  adaptive: { cardId: string; passageId: string; v: string };
  passageId: string;
  worksheetId: string;
};
assert.equal(directPayload.worksheetId, "worksheet-created");
assert.equal(directPayload.passageId, "passage-created");
assert.equal(directPayload.adaptive.cardId, "en.digraph.sh.card2");
assert.equal(directPayload.adaptive.passageId, "passage-created");
assert.equal(directFixture.insertedPassages.length, 1);
assert.equal(directFixture.insertedWorksheets.length, 1);

const groupFixture = createSupabaseFixture();
const groupHandler = createWorksheetPostHandler({
  createSupabaseAdminClient: () => groupFixture.client,
  generateWorksheet: async () => {
    throw new Error("Group cards must use the curated catalog, never GPT.");
  },
});
const groupResponse = await groupHandler(
  requestFor({
    adaptive: {
      focusSkillId: "en.digraph.sh",
      groupStudentIds: [
        studentId,
        "10000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000003",
      ],
    },
    language: "en",
    level: "word",
  }),
);
assert.equal(groupResponse.status, 200);
assert.equal((await groupResponse.json()).adaptive.mode, "group");
assert.equal(groupFixture.insertedWorksheets.length, 1);

const resolvedFixture = createSupabaseFixture({
  history: [
    evidence("maya-one", "2026-07-01T09:00:00.000Z"),
    evidence("maya-two", "2026-07-08T09:00:00.000Z"),
  ],
});
const resolvedHandler = createWorksheetPostHandler({
  createSupabaseAdminClient: () => resolvedFixture.client,
  generateWorksheet: async () => {
    throw new Error("Adaptive requests must use the curated catalog, never GPT.");
  },
});
const resolvedResponse = await resolvedHandler(
  requestFor({ adaptive: { studentId }, language: "en", level: "word" }),
);
assert.equal(resolvedResponse.status, 200);
assert.equal((await resolvedResponse.json()).adaptive.cardId, "en.digraph.sh.card1");

const invalidHandler = createWorksheetPostHandler({
  createSupabaseAdminClient: () => {
    throw new Error("Invalid focus must be rejected before any database call.");
  },
});
const invalidResponse = await invalidHandler(
  requestFor({
    adaptive: { focusSkillId: "en.digraph.sh", studentId },
    language: "hi",
    level: "word",
  }),
);
assert.equal(invalidResponse.status, 422);

console.log(
  "P2-T10 worksheet route passed: legacy regression, deterministic focus, override validation, and no-repeat card selection.",
);
}

void main();
