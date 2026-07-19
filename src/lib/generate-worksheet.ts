import {
  type WorksheetContent,
  type WorksheetRequest,
  worksheetJsonSchema,
  worksheetWordCountBands,
  validateWorksheet,
} from "@/lib/worksheetSchema";
import { callOpenAI, createOpenAIClient } from "@/lib/openai";

export const worksheetGenerationModel = "gpt-5.6";

const worksheetSystemPrompt = `You create reading-practice cards for early-grade children in India.
The cards must use familiar, age-appropriate vocabulary in an Indian primary-school
context. Keep the tone encouraging and concrete. Do not include an answer to the
question. Return only the requested structured worksheet content.`;

const languageNames: Record<WorksheetRequest["language"], string> = {
  en: "English",
  hi: "Hindi",
};

function levelInstruction(request: WorksheetRequest) {
  const band = worksheetWordCountBands[request.level];

  switch (request.level) {
    case "letter":
      return `${band.min}-${band.max} familiar letters, each separated by spaces or line breaks. Do not write a sentence. The question should ask the child to identify one displayed letter.`;
    case "word":
      return `${band.min}-${band.max} familiar, standalone words. Do not write connected sentences. The question should ask about one word on the card.`;
    case "paragraph":
      return `a connected ${band.min}-${band.max}-word micro-story or everyday paragraph. The question should check one concrete detail from the text.`;
    case "story":
      return `an ${band.min}-${band.max}-word short story with a clear beginning, middle, and end. The question should check one concrete detail from the story.`;
  }
}

function worksheetInput(request: WorksheetRequest, correction?: string) {
  const sections = [
    `Language: ${languageNames[request.language]}.`,
    `Reading level: ${request.level}.`,
    `Body requirement: ${levelInstruction(request)}`,
    "Create one concise title, the reading-card body, and exactly one short question ending in a question mark.",
  ];

  if (correction) {
    sections.push(
      `Your last output failed validation: ${correction}. Return a corrected worksheet that exactly follows the required JSON schema.`,
    );
  }

  return sections.join("\n");
}

function responseValidationMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 800) : "Unknown validation error.";
}

export type WorksheetGenerationResult = {
  worksheet: WorksheetContent;
  model: string;
};

/**
 * Generates a frozen worksheet response through GPT-5.6 Structured Outputs.
 * A local semantic check covers the prompt's level bands and retries once with
 * a precise correction when the structured response is not usable.
 */
export async function generateWorksheet(
  request: WorksheetRequest,
): Promise<WorksheetGenerationResult> {
  const client = createOpenAIClient();
  let correction: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await callOpenAI(() =>
      client.responses.create({
        model: worksheetGenerationModel,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: worksheetSystemPrompt },
          { role: "user", content: worksheetInput(request, correction) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "reading_worksheet",
            schema: worksheetJsonSchema,
            strict: true,
          },
        },
      }),
    );

    try {
      if (!response.output_text.trim()) {
        throw new Error("The model did not return structured JSON.");
      }

      return {
        worksheet: validateWorksheet(JSON.parse(response.output_text), request.level),
        model: response.model,
      };
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }

      correction = responseValidationMessage(error);
    }
  }

  throw new Error("The worksheet model did not return a valid worksheet.");
}
