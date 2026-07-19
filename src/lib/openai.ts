import OpenAI, { APIConnectionError, APIError } from "openai";

const openAiTimeoutMs = 30_000;
const retryDelayMs = 500;

function wait(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function shouldRetry(error: unknown) {
  if (error instanceof APIConnectionError) {
    return true;
  }

  return (
    error instanceof APIError &&
    (error.status === 429 || (error.status !== undefined && error.status >= 500))
  );
}

/**
 * Creates the server-side OpenAI client. SDK retries are disabled so every
 * OpenAI request follows the one-retry policy in callOpenAI().
 */
export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be configured on the server.");
  }

  return new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: openAiTimeoutMs,
  });
}

/**
 * Runs an OpenAI operation once, with one backoff retry for a transient
 * connection, rate-limit, or server error.
 */
export async function callOpenAI<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === 1 || !shouldRetry(error)) {
        throw error;
      }

      await wait(retryDelayMs);
    }
  }

  throw lastError;
}
