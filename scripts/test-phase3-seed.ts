import assert from "node:assert/strict";

import { benchmarkLevels, englishBenchmarkPassageMetadata } from "../src/lib/benchmark-passage-pool";
import { demoSeedConfig } from "../src/lib/demo-seed-config";
import {
  demoAssessmentIds,
  demoClassroom,
  demoClassroomId,
  demoPassageIds,
  demoStudentIds,
  seedDemoData,
} from "./seed";

type UpsertCall = {
  rows: unknown[];
  table: string;
};

function createSeedFixtureClient() {
  const upserts: UpsertCall[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string) {
              if (table === "students" && column === "classroom_id") {
                return Promise.resolve({ count: demoStudentIds.length, error: null });
              }
              return Promise.resolve({ count: 0, error: null });
            },
            in(_column: string, values: unknown) {
              const count = Array.isArray(values)
                ? table === "assessments"
                  ? demoAssessmentIds.length
                  : values.length
                : 0;
              return Promise.resolve({ count, error: null });
            },
          };
        },
        upsert(rows: unknown[]) {
          upserts.push({ rows, table });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client, upserts };
}

function upsertRows(calls: readonly UpsertCall[], table: string) {
  const rows = calls.find((call) => call.table === table)?.rows;
  assert.ok(rows, `Expected ${table} to be seeded.`);
  return rows;
}

async function main() {
  const first = createSeedFixtureClient();
  const firstResult = await seedDemoData(first.client as never);
  const second = createSeedFixtureClient();
  const secondResult = await seedDemoData(second.client as never);

  assert.deepEqual(firstResult, secondResult, "Seed counts must be stable across repeated runs.");
  assert.deepEqual(first.upserts, second.upserts, "Seed rows must be deterministic across runs.");
  assert.deepEqual(upsertRows(first.upserts, "classrooms"), [demoClassroom]);

  const studentRows = upsertRows(first.upserts, "students") as Array<{
    classroom_id: string;
    id: string;
    is_archived: boolean;
    name: string;
    placement_source: string;
  }>;
  assert.equal(studentRows.length, demoStudentIds.length);
  assert.ok(studentRows.every((student) => student.classroom_id === demoClassroomId));
  assert.ok(studentRows.every((student) => !student.is_archived));
  assert.ok(studentRows.every((student) => student.placement_source === "benchmark"));

  const passageRows = upsertRows(first.upserts, "passages") as Array<{
    id: string;
    language: string;
    level: string;
  }>;
  assert.equal(passageRows.length, demoPassageIds.length);
  for (const level of benchmarkLevels) {
    assert.equal(
      englishBenchmarkPassageMetadata.filter((metadata) => metadata.level === level).length,
      3,
      `Expected three English ${level} benchmark forms.`,
    );
  }

  const assessmentRows = upsertRows(first.upserts, "assessments") as Array<{
    analysis_json: Record<string, unknown>;
    created_at: string;
    level: string | null;
    student_id: string;
  }>;
  assert.equal(assessmentRows.length, demoAssessmentIds.length);
  const chronological = assessmentRows
    .map((assessment) => Date.parse(assessment.created_at))
    .sort((left, right) => left - right);
  const historyDays =
    (chronological[chronological.length - 1]! - chronological[0]!) / (24 * 60 * 60 * 1000);
  assert.ok(historyDays >= demoSeedConfig.analyticsHistory.minimumDays);
  assert.ok(historyDays <= demoSeedConfig.analyticsHistory.maximumDays);

  const chitra = studentRows.find(
    (student) => student.name === "Chitra",
  );
  assert.ok(chitra);
  assert.deepEqual(
    new Set(assessmentRows.filter((assessment) => assessment.student_id === chitra.id).map((a) => a.level)),
    new Set(["letter", "word"]),
    "Chitra's seeded benchmark history must include a promotion arc.",
  );

  const maya = studentRows.find(
    (student) => student.name === "Maya",
  );
  assert.equal(
    assessmentRows.filter(
      (assessment) =>
        assessment.student_id === maya?.id &&
        (assessment.analysis_json._adaptive as { purpose?: string } | undefined)?.purpose ===
          "focused_readback",
    ).length,
    2,
    "Maya must retain a completed two-read focus episode.",
  );

  const arjun = studentRows.find(
    (student) => student.name === "Arjun",
  );
  const arjunMath = assessmentRows.filter(
    (assessment) =>
      assessment.student_id === arjun?.id && assessment.analysis_json.v === "math-check.v1",
  );
  assert.equal(arjunMath.length, 2, "Arjun needs a math diagnostic and re-check arc.");
  assert.equal(
    (arjunMath[0]?.analysis_json._adaptive as { mathDiagnosis?: { recommendation?: unknown } })
      .mathDiagnosis?.recommendation !== null,
    true,
  );
  assert.equal(
    (arjunMath[1]?.analysis_json._adaptive as { mathDiagnosis?: { recommendation?: unknown } })
      .mathDiagnosis?.recommendation,
    null,
  );

  console.log("P3-T2 seed passed: classroom chain, 3× EN pool, dated reading arcs, math arc, and idempotence.");
}

void main();
