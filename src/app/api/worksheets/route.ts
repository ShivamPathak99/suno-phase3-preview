import { NextRequest, NextResponse } from "next/server";

import { parseAdaptiveAssessmentPayload } from "@/lib/adaptive/confirmation";
import {
  AdaptiveWorksheetResolutionError,
  createAdaptiveWorksheetContent,
  mostRecentAdaptiveCardId,
  planAdaptiveWorksheet,
  validateAdaptiveWorksheetFocus,
} from "@/lib/adaptive/worksheet";
import { generateWorksheet } from "@/lib/generate-worksheet";
import { guardOpenAiRoute } from "@/lib/auth/openai-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { worksheetRequestSchema } from "@/lib/worksheetSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

type QueryResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

type SupabaseQuery = {
  contains: (...args: unknown[]) => SupabaseQuery;
  delete: () => SupabaseQuery;
  eq: (...args: unknown[]) => SupabaseQuery;
  insert: (...args: unknown[]) => SupabaseQuery;
  limit: (...args: unknown[]) => SupabaseQuery;
  maybeSingle: () => Promise<QueryResult<unknown>>;
  order: (...args: unknown[]) => SupabaseQuery;
  select: (...args: unknown[]) => SupabaseQuery;
  single: () => Promise<QueryResult<unknown>>;
};

type SupabaseClientLike = {
  from: (table: string) => SupabaseQuery;
};

type WorksheetRouteDependencies = {
  createSupabaseAdminClient: () => unknown;
  generateWorksheet: typeof generateWorksheet;
};

type StudentRecord = {
  id: string;
  name: string;
};

type ConfirmedAssessmentRecord = {
  analysis_json: unknown;
};

type WorksheetRecord = {
  content_json: unknown;
};

type InsertedRecord = {
  id: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function adaptivePayloadFromAssessment(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return parseAdaptiveAssessmentPayload((value as { _adaptive?: unknown })._adaptive);
}

async function loadAdaptiveWorksheetContext(
  supabase: SupabaseClientLike,
  studentId: string,
) {
  const [studentResult, historyResult, worksheetsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, name")
      .eq("id", studentId)
      .maybeSingle() as Promise<QueryResult<StudentRecord>>,
    supabase
      .from("assessments")
      .select("analysis_json")
      .eq("student_id", studentId)
      .eq("teacher_confirmed", true)
      .order("created_at", { ascending: true }) as unknown as Promise<
      QueryResult<ConfirmedAssessmentRecord[]>
    >,
    supabase
      .from("worksheets")
      .select("content_json")
      .contains("content_json", { studentId })
      .order("created_at", { ascending: false })
      .limit(1) as unknown as Promise<QueryResult<WorksheetRecord[]>>,
  ]);

  return { historyResult, studentResult, worksheetsResult };
}

async function insertAdaptiveWorksheet(
  supabase: SupabaseClientLike,
  input: {
    contentJson: ReturnType<typeof createAdaptiveWorksheetContent>;
    language: "en" | "hi";
    level: "letter" | "word" | "paragraph" | "story";
    title: string;
  },
) {
  const { data: passage, error: passageError } = (await supabase
    .from("passages")
    .insert({
      body: input.contentJson.content.body,
      language: input.language,
      level: input.level,
      title: input.title,
    })
    .select("id")
    .single()) as QueryResult<InsertedRecord>;

  if (passageError || !passage?.id) {
    throw new Error("Couldn't save the adaptive practice passage.");
  }

  const contentJson = {
    ...input.contentJson,
    adaptive: {
      ...input.contentJson.adaptive,
      passageId: passage.id,
    },
  };

  const { data: worksheet, error: worksheetError } = (await supabase
    .from("worksheets")
    .insert({
      content_json: contentJson,
      language: input.language,
      level: input.level,
    })
    .select("id")
    .single()) as QueryResult<InsertedRecord>;

  if (worksheetError || !worksheet?.id) {
    await supabase.from("passages").delete().eq("id", passage.id);
    throw new Error("Couldn't save the adaptive practice card.");
  }

  return { contentJson, passageId: passage.id, worksheetId: worksheet.id };
}

/**
 * Dependency injection keeps the route testable without OpenAI or Supabase.
 * The legacy branch deliberately preserves the existing response byte shape.
 */
export function createWorksheetPostHandler(
  overrides: Partial<WorksheetRouteDependencies> = {},
) {
  const dependencies: WorksheetRouteDependencies = {
    createSupabaseAdminClient,
    generateWorksheet,
    ...overrides,
  };

  return async function POST(request: NextRequest) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const input = worksheetRequestSchema.safeParse(body);

    if (!input.success) {
      return jsonError(
        "level must be letter, word, paragraph, or story, and language must be en or hi.",
        400,
      );
    }

    // The pre-Phase-2 request remains a GPT worksheet request and returns the
    // exact frozen WorksheetContent object with no new wrapper fields.
    if (!input.data.adaptive) {
      try {
        const result = await dependencies.generateWorksheet(input.data, request.signal);

        console.info(`Worksheet generation completed with ${result.model}.`);

        return NextResponse.json(result.worksheet);
      } catch (error) {
        console.error("Worksheet generation route failed.", error);
        return jsonError("Couldn't generate the worksheet. Please try again.", 502);
      }
    }

    const adaptiveRequest = input.data.adaptive;
    const scope = {
      language: input.data.language,
      level: input.data.level,
    } as const;

    // Reject a bad teacher override before touching persistence, so callers
    // receive the promised 422 rather than an unrelated database error.
    if (adaptiveRequest.focusSkillId) {
      try {
        validateAdaptiveWorksheetFocus(adaptiveRequest.focusSkillId, scope);
      } catch (error) {
        if (error instanceof AdaptiveWorksheetResolutionError) {
          return jsonError(error.message, 422);
        }
        throw error;
      }
    }

    try {
      const supabase = dependencies.createSupabaseAdminClient() as SupabaseClientLike;

      if (adaptiveRequest.groupStudentIds) {
        if (!adaptiveRequest.focusSkillId) {
          return jsonError("Choose a common practice focus before creating a group card.", 422);
        }

        const groupId = "group:" + [...adaptiveRequest.groupStudentIds].sort().join(":");
        const plan = planAdaptiveWorksheet({
          assessments: [],
          mostRecentCardId: null,
          requestedFocusSkillId: adaptiveRequest.focusSkillId,
          scope: {
            ...scope,
            studentId: groupId,
            studentName: "this group",
          },
        });
        const provisionalContent = createAdaptiveWorksheetContent({
          card: plan.card,
          focus: plan.focus,
          mode: "group",
          passageId: "pending",
          qualityChecks: plan.qualityChecks,
          studentId: groupId,
        });
        const persisted = await insertAdaptiveWorksheet(supabase, {
          contentJson: provisionalContent,
          language: input.data.language,
          level: input.data.level,
          title: plan.card.title,
        });

        return NextResponse.json({
          adaptive: persisted.contentJson.adaptive,
          content: persisted.contentJson.content,
          passageId: persisted.passageId,
          worksheetId: persisted.worksheetId,
        });
      }

      if (!adaptiveRequest.studentId) {
        return jsonError("A student is required for an individual practice card.", 400);
      }
      const studentId = adaptiveRequest.studentId;

      const { historyResult, studentResult, worksheetsResult } = await loadAdaptiveWorksheetContext(
        supabase,
        studentId,
      );

      if (studentResult.error || historyResult.error || worksheetsResult.error) {
        console.error(
          "Adaptive worksheet context lookup failed.",
          studentResult.error ?? historyResult.error ?? worksheetsResult.error,
        );
        return jsonError("Couldn't prepare the practice card. Please try again.", 502);
      }
      if (!studentResult.data) {
        return jsonError("The selected student was not found.", 404);
      }

      const assessments = (historyResult.data ?? []).flatMap((record) => {
        const adaptive = adaptivePayloadFromAssessment(record.analysis_json);
        return adaptive ? [adaptive] : [];
      });
      const mostRecentCardId = (worksheetsResult.data ?? [])
        .map((record) => mostRecentAdaptiveCardId(record.content_json, studentId))
        .find((cardId): cardId is string => cardId !== null);
      const plan = planAdaptiveWorksheet({
        assessments,
        confirmedReadingCount: (historyResult.data ?? []).length,
        mostRecentCardId,
        requestedFocusSkillId: adaptiveRequest.focusSkillId,
        scope: {
          ...scope,
          studentId: studentResult.data.id,
          studentName: studentResult.data.name,
        },
      });

      // passageId is replaced by the actual insert ID below. Keeping a stable
      // temporary value lets the content JSON be assembled in one pure step.
      const provisionalContent = createAdaptiveWorksheetContent({
        card: plan.card,
        focus: plan.focus,
        passageId: "pending",
        qualityChecks: plan.qualityChecks,
        studentId,
      });
      const persisted = await insertAdaptiveWorksheet(supabase, {
        contentJson: provisionalContent,
        language: input.data.language,
        level: input.data.level,
        title: plan.card.title,
      });

      return NextResponse.json({
        adaptive: persisted.contentJson.adaptive,
        content: persisted.contentJson.content,
        passageId: persisted.passageId,
        worksheetId: persisted.worksheetId,
      });
    } catch (error) {
      if (error instanceof AdaptiveWorksheetResolutionError) {
        return jsonError(error.message, 422);
      }

      console.error("Adaptive worksheet route failed.", error);
      return jsonError("Couldn't create the practice card. Please try again.", 502);
    }
  };
}

const worksheetPostHandler = createWorksheetPostHandler();

export async function POST(request: NextRequest) {
  const rateLimitResponse = await guardOpenAiRoute();

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return worksheetPostHandler(request);
}
