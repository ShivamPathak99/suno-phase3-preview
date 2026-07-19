import { NextRequest } from "next/server";

import { POST } from "../src/app/api/worksheets/route";
import { readingLevels } from "../src/lib/analysisSchema";
import { validateWorksheet } from "../src/lib/worksheetSchema";

function fail(message: string): never {
  throw new Error(`C-4 live verification failed: ${message}`);
}

function requestFor(payload: unknown) {
  return new NextRequest("http://localhost/api/worksheets", {
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    fail("OPENAI_API_KEY must be configured.");
  }

  const invalidResponse = await POST(
    requestFor({ level: "word", language: "en", unexpected: true }),
  );

  if (invalidResponse.status !== 400) {
    fail(`a malformed request must return 400, received ${invalidResponse.status}.`);
  }

  for (const level of readingLevels) {
    const response = await POST(requestFor({ level, language: "en" }));
    const payload: unknown = await response.json();

    if (response.status !== 200) {
      fail(`${level} request returned ${response.status}: ${JSON.stringify(payload)}`);
    }

    const worksheet = validateWorksheet(payload, level);
    console.log(`${level}: ${JSON.stringify(worksheet)}`);
  }

  console.log("C-4 live verification passed: valid GPT-5.6 worksheet JSON for all four English levels.");
}

void main();
