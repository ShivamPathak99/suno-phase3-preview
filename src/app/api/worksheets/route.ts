import { NextRequest, NextResponse } from "next/server";

import { generateWorksheet } from "@/lib/generate-worksheet";
import { worksheetRequestSchema } from "@/lib/worksheetSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
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

  try {
    const result = await generateWorksheet(input.data);

    console.info(`Worksheet generation completed with ${result.model}.`);

    return NextResponse.json(result.worksheet);
  } catch (error) {
    console.error("Worksheet generation route failed.", error);
    return jsonError("Couldn't generate the worksheet. Please try again.", 502);
  }
}
