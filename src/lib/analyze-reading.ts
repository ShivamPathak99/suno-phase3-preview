import {
  analysisJsonSchema,
  type ReadingAnalysis,
  validateReadingAnalysis,
} from "@/lib/analysisSchema";
import type { TimestampedTranscription } from "@/lib/transcribe-audio";
import { callOpenAI, createOpenAIClient } from "@/lib/openai";

export const readingAnalysisModel = "gpt-5.6";

const readingAssessmentSystemPrompt = `You are an oral reading fluency assessor for early-grade children in India,
following ASER methodology. You receive: (1) the passage text the child was
shown, (2) a word-timestamped transcript of the child reading aloud.
Align the transcript against the passage word-by-word. Children may skip
words, substitute similar-looking words, self-correct, repeat, or pause.
A gap >3s before a word = hesitation. Ignore filler sounds and self-corrections
that end correct. Be generous on accent and pronunciation variants — score
decoding, not accent. Classify overall level per ASER: "letter" | "word" |
"paragraph" | "story". Return ONLY the JSON schema provided.`;

export type ReadingAnalysisResult = {
  analysis: ReadingAnalysis;
  model: string;
};

function analysisInput(
  passageText: string,
  transcript: TimestampedTranscription,
  correction?: string,
) {
  const sections = [
    "Passage text:",
    passageText,
    "",
    "Timestamped transcript JSON:",
    JSON.stringify(transcript),
  ];

  if (correction) {
    sections.push(
      "",
      `Your last output failed validation: ${correction}. Return a corrected JSON response that exactly follows the provided schema.`,
    );
  }

  return sections.join("\n");
}

function responseValidationMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 800) : "Unknown validation error.";
}

/**
 * Runs the frozen prompt through GPT-5.6 Structured Outputs. A schema-valid
 * response is still checked against the selected passage, then retried once
 * with a precise correction request if that relationship is invalid.
 */
export async function analyzeReading(
  passageText: string,
  transcript: TimestampedTranscription,
): Promise<ReadingAnalysisResult> {
  const client = createOpenAIClient();
  let correction: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await callOpenAI(() =>
      client.responses.create({
        model: readingAnalysisModel,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: readingAssessmentSystemPrompt },
          {
            role: "user",
            content: analysisInput(passageText, transcript, correction),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "reading_assessment",
            schema: analysisJsonSchema,
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
        analysis: validateReadingAnalysis(JSON.parse(response.output_text), passageText),
        model: response.model,
      };
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }

      correction = responseValidationMessage(error);
    }
  }

  throw new Error("The analysis model did not return a valid assessment.");
}
