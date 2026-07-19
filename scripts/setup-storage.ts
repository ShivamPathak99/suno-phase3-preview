import { createClient } from "@supabase/supabase-js";

const bucketId = "audio";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message: string): never {
  console.error(`Storage setup failed: ${message}`);
  process.exit(1);
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const candidate = error as {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      message?: unknown;
      statusCode?: unknown;
    };
    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.code,
      candidate.statusCode,
    ].filter((part): part is string | number =>
      (typeof part === "string" && part.length > 0) || typeof part === "number",
    );

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  return "Unknown error";
}

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

async function main() {
  try {
    const { data: existingBucket, error: readError } =
      await supabase.storage.getBucket(bucketId);

    if (readError && readError.statusCode !== "404") {
      throw readError;
    }

    if (!existingBucket) {
      const { error: createError } = await supabase.storage.createBucket(bucketId, {
        public: true,
      });

      if (createError) {
        throw createError;
      }
    } else if (!existingBucket.public) {
      const { error: updateError } = await supabase.storage.updateBucket(bucketId, {
        public: true,
      });

      if (updateError) {
        throw updateError;
      }
    }

    const { data: verifiedBucket, error: verifyError } =
      await supabase.storage.getBucket(bucketId);

    if (verifyError || !verifiedBucket) {
      throw verifyError ?? new Error(`Bucket ${bucketId} was not found after setup.`);
    }

    if (!verifiedBucket.public) {
      throw new Error(`Bucket ${bucketId} is not configured for public reads.`);
    }

    const { data: publicUrl } = supabase.storage
      .from(bucketId)
      .getPublicUrl("verification-placeholder.webm");

    console.log(
      `Storage ready: ${bucketId} bucket is public. Public URL pattern: ${publicUrl.publicUrl}`,
    );
  } catch (error) {
    console.error(`Storage setup failed: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

void main();
