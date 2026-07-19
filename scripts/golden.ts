import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { analysisSchema } from "../src/lib/analysisSchema";
import { timestampedTranscriptSchema } from "../src/lib/assessment-contract";
import {
  evaluateGoldenOutcome,
  formatAnalysisErrors,
  formatGoldenExpectation,
  goldenManifestSchema,
  type GoldenActualOutcome,
  type GoldenCase,
  type GoldenEvaluation,
} from "../src/lib/golden-set";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sampleDataRoot = resolve(projectRoot, "sample-data");
const goldenFixtureRoot = resolve(sampleDataRoot, "golden");
const manifestPath = resolve(sampleDataRoot, "golden-set.json");
const maxAudioBytes = 25 * 1024 * 1024;
const appStartupTimeoutMs = 60_000;
const apiRequestTimeoutMs = 70_000;

const uploadUrlSchema = z
  .object({
    audioUrl: z.string().url(),
    contentType: z.string().min(1),
    path: z.string().min(1),
    signedUrl: z.string().url(),
  })
  .strict();

const analyzeResponseSchema = z
  .object({
    assessmentId: z.string().uuid(),
    analysis: analysisSchema,
  })
  .strict();

const unassessableResponseSchema = z
  .object({
    reason: z.string().min(1),
    unassessable: z.literal(true),
  })
  .strict();

type HarnessOptions = {
  baseUrl?: string;
  caseId?: string;
  includeOptional: boolean;
  isolatedLocal: boolean;
  syntheticOnly: boolean;
};

type ResolvedFixture = {
  bytes: Buffer;
  contentType: string;
  fileName: string;
};

type ApiCallResult = {
  actual: GoldenActualOutcome;
};

type CaseRun = {
  cleanupError?: string;
  elapsedMs: number;
  error?: string;
  outcome?: GoldenActualOutcome;
  testCase: GoldenCase;
};

type RunningApp = {
  baseUrl: string;
  child?: ChildProcess;
};

type AdminClient = ReturnType<typeof createSupabaseAdminClient>["supabase"];

type ActiveRun = {
  audioUrl?: string;
  objectPath?: string;
  runStartedAt: string;
  supabase: AdminClient;
  testCase: GoldenCase;
};

const activeRuns = new Set<ActiveRun>();

function fail(message: string): never {
  throw new Error(`Golden harness failed: ${message}`);
}

function usage() {
  console.log(`Usage: npm run golden -- [options]

Options:
  --base-url <url>       Run against a deployed or already-running Suno API.
  --case <id>            Run one manifest case (also selects an optional case).
  --include-optional     Include the Hindi quality gate after the required seven.
  --isolated-local       Build and start a separate production server.
  --synthetic-only       Run generated silence + seeded wrong-passage checks (uses APIs).
  --help                 Show this help.

With no --base-url, the command starts a temporary local Next server. The default
run requires all seven curated files described in sample-data/golden/README.md.
--base-url is an explicit trust decision: use only a Suno deployment you control.
`);
}

function parseArguments(argv: string[]): HarnessOptions | "help" {
  const options: HarnessOptions = {
    includeOptional: false,
    isolatedLocal: false,
    syntheticOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      return "help";
    }

    if (argument === "--include-optional") {
      options.includeOptional = true;
      continue;
    }

    if (argument === "--isolated-local") {
      options.isolatedLocal = true;
      continue;
    }

    if (argument === "--synthetic-only") {
      options.syntheticOnly = true;
      continue;
    }

    if (argument === "--base-url" || argument === "--case") {
      const value = argv[index + 1];

      if (!value || value.startsWith("--")) {
        fail(`${argument} requires a value.`);
      }

      if (argument === "--base-url") {
        options.baseUrl = value;
      } else {
        options.caseId = value;
      }

      index += 1;
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  if (options.syntheticOnly && (options.caseId || options.includeOptional)) {
    fail("--synthetic-only cannot be combined with --case or --include-optional.");
  }

  if (options.isolatedLocal && options.baseUrl) {
    fail("--isolated-local cannot be combined with --base-url.");
  }

  return options;
}

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
    .join("; ");
}

async function loadManifest() {
  let raw: unknown;

  try {
    raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    fail(`could not read sample-data/golden-set.json: ${message}`);
  }

  const parsed = goldenManifestSchema.safeParse(raw);

  if (!parsed.success) {
    fail(`golden-set.json is invalid: ${formatZodIssues(parsed.error)}`);
  }

  return parsed.data;
}

function normaliseBaseUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    fail("--base-url or SUNO_APP_BASE_URL must be a valid HTTP(S) URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail("--base-url or SUNO_APP_BASE_URL must use HTTP or HTTPS.");
  }

  url.hash = "";
  url.search = "";

  return url.toString().replace(/\/$/u, "");
}

function describeUnknown(value: unknown) {
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (typeof candidate.error === "string") {
      return candidate.error;
    }

    if (typeof candidate.reason === "string") {
      return candidate.reason;
    }
  }

  return "Unexpected response.";
}

function parseUnassessable(value: unknown) {
  if (value && typeof value === "object" && (value as Record<string, unknown>).unassessable === true) {
    const parsed = unassessableResponseSchema.safeParse(value);

    if (!parsed.success) {
      fail(`unassessable response violated the frozen contract: ${formatZodIssues(parsed.error)}`);
    }

    return parsed.data.reason;
  }

  return null;
}

async function postJson(url: string, body: unknown) {
  let response: Response;

  try {
    response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(apiRequestTimeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error.";
    fail(`request to ${new URL(url).pathname} failed or timed out: ${message}`);
  }

  const payload: unknown = await response.json().catch(() => null);

  return { payload, response };
}

function isWithinDirectory(directory: string, path: string) {
  const pathRelativeToRoot = relative(directory, path);

  return (
    pathRelativeToRoot.length > 0 &&
    !pathRelativeToRoot.startsWith("..") &&
    !isAbsolute(pathRelativeToRoot)
  );
}

async function preflightFixture(testCase: GoldenCase): Promise<ResolvedFixture> {
  const filePath = resolve(sampleDataRoot, testCase.file.path);

  if (!isWithinDirectory(goldenFixtureRoot, filePath)) {
    fail(`${testCase.id} has a fixture path outside sample-data/golden.`);
  }

  let fileLink: Awaited<ReturnType<typeof lstat>>;

  try {
    fileLink = await lstat(filePath);
  } catch {
    fail(`missing fixture ${testCase.file.path} for ${testCase.id}.`);
  }

  if (fileLink.isSymbolicLink()) {
    fail(`fixture ${testCase.file.path} for ${testCase.id} cannot be a symbolic link.`);
  }

  let resolvedSampleDataRoot: string;
  let resolvedGoldenRoot: string;
  let resolvedFilePath: string;

  try {
    const goldenRootLink = await lstat(goldenFixtureRoot);

    if (goldenRootLink.isSymbolicLink()) {
      fail("sample-data/golden cannot be a symbolic link.");
    }

    [resolvedSampleDataRoot, resolvedGoldenRoot, resolvedFilePath] = await Promise.all([
      realpath(sampleDataRoot),
      realpath(goldenFixtureRoot),
      realpath(filePath),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Golden harness failed:")) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown path error.";
    fail(`could not resolve fixture ${testCase.file.path}: ${message}`);
  }

  if (
    !isWithinDirectory(resolvedSampleDataRoot, resolvedGoldenRoot) ||
    !isWithinDirectory(resolvedGoldenRoot, resolvedFilePath)
  ) {
    fail(`fixture ${testCase.file.path} resolves outside sample-data/golden.`);
  }

  const fileStats = await stat(resolvedFilePath);

  if (!fileStats.isFile()) {
    fail(`fixture ${testCase.file.path} for ${testCase.id} is not a file.`);
  }

  if (fileStats.size === 0) {
    fail(`fixture ${testCase.file.path} for ${testCase.id} is empty.`);
  }

  if (fileStats.size > maxAudioBytes) {
    fail(`${testCase.file.path} is larger than the ${maxAudioBytes / 1024 / 1024} MB API limit.`);
  }

  return {
    bytes: await readFile(resolvedFilePath),
    contentType: testCase.file.contentType,
    fileName: basename(resolvedFilePath),
  };
}

function printMissingFixtures(cases: GoldenCase[], missing: Array<{ id: string; reason: string }>) {
  const reasonById = new Map(missing.map((entry) => [entry.id, entry.reason]));

  console.table(
    cases.map((testCase) => ({
      Clip: testCase.label,
      Expected: formatGoldenExpectation(testCase.expected),
      Result: "MISSING",
      Level: "-",
      WCPM: "-",
      Accuracy: "-",
      "Errors found / guard": reasonById.get(testCase.id) ?? "-",
      Verdict: "BLOCKED",
    })),
  );
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }),
    supabaseUrl,
  };
}

function delay(milliseconds: number) {
  return new Promise<void>((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

async function findFreePort() {
  return new Promise<number>((resolvePort, rejectPort) => {
    const server = createServer();

    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        rejectPort(new Error("Could not reserve a local port."));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          rejectPort(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

async function waitForLocalApp(baseUrl: string, child: ChildProcess, logs: () => string) {
  const deadline = Date.now() + appStartupTimeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`local Next server exited during startup. ${logs()}`);
    }

    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(1_500),
      });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Next is still starting or compiling; retry below.
    }

    await delay(300);
  }

  fail(`local Next server did not start within ${appStartupTimeoutMs / 1000}s. ${logs()}`);
}

async function startLocalApp(mode: "dev" | "start" = "dev"): Promise<RunningApp> {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextCli = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
  let logs = "";
  console.log(`[golden] Starting local ${mode} server at ${baseUrl}.`);
  const child = spawn(
    process.execPath,
    [nextCli, mode, "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const collectLogs = (chunk: Buffer) => {
    logs = `${logs}${chunk.toString()}`.slice(-4_000);
  };

  child.stdout?.on("data", collectLogs);
  child.stderr?.on("data", collectLogs);

  await waitForLocalApp(baseUrl, child, () => logs.trim());

  return { baseUrl, child };
}

async function buildIsolatedLocalApp() {
  const nextCli = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");
  let logs = "";
  console.log("[golden] Building the current app for --isolated-local.");

  await new Promise<void>((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [nextCli, "build"], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const collectLogs = (chunk: Buffer) => {
      logs = `${logs}${chunk.toString()}`.slice(-4_000);
    };

    child.stdout?.on("data", collectLogs);
    child.stderr?.on("data", collectLogs);
    child.once("error", rejectBuild);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveBuild();
        return;
      }

      rejectBuild(new Error(`isolated production build exited with ${code ?? "an unknown code"}. ${logs}`));
    });
  });
}

async function stopLocalApp(app: RunningApp) {
  if (!app.child || app.child.exitCode !== null) {
    return;
  }

  app.child.kill();
  await Promise.race([
    new Promise<void>((resolveExit) => {
      app.child?.once("exit", () => resolveExit());
    }),
    delay(5_000),
  ]);

  if (app.child.exitCode === null) {
    app.child.kill("SIGKILL");
  }
}

async function acquireApp(options: HarnessOptions): Promise<RunningApp> {
  const configuredUrl = options.baseUrl ?? process.env.SUNO_APP_BASE_URL;

  if (options.isolatedLocal) {
    if (configuredUrl) {
      fail("--isolated-local cannot be used while SUNO_APP_BASE_URL is configured.");
    }

    await buildIsolatedLocalApp();
    return startLocalApp("start");
  }

  if (configuredUrl) {
    const baseUrl = normaliseBaseUrl(configuredUrl);
    console.log(`[golden] Using explicitly configured Suno API at ${baseUrl}.`);
    return { baseUrl };
  }

  return startLocalApp();
}

function isSafeHarnessObjectPath(objectPath: string) {
  return (
    /^uploads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(?:mp4|webm)$/u.test(objectPath) ||
    /^verification\/golden-near-silent-[0-9a-f-]{36}\.wav$/u.test(objectPath)
  );
}

function publicAudioUrl(supabaseUrl: string, objectPath: string) {
  return new URL(`/storage/v1/object/public/audio/${objectPath}`, supabaseUrl).toString();
}

function validatePublicAudioUrl(audioUrl: string, objectPath: string, supabaseUrl: string) {
  const expected = new URL(publicAudioUrl(supabaseUrl, objectPath));
  let received: URL;

  try {
    received = new URL(audioUrl);
  } catch {
    fail("upload URL response returned an invalid public audio URL.");
  }

  if (
    received.origin !== expected.origin ||
    received.pathname !== expected.pathname ||
    received.search ||
    received.hash ||
    received.username ||
    received.password
  ) {
    fail("upload URL response returned an unexpected public audio URL.");
  }
}

async function assertObjectIsNew(activeRun: ActiveRun, objectPath: string) {
  const separatorIndex = objectPath.lastIndexOf("/");
  const folder = objectPath.slice(0, separatorIndex);
  const objectName = objectPath.slice(separatorIndex + 1);

  try {
    const { data, error } = await activeRun.supabase.storage.from("audio").list(folder, {
      limit: 10,
      search: objectName,
    });

    if (error) {
      fail(`could not verify the temporary upload path: ${error.message}`);
    }

    if ((data ?? []).some((object) => object.name === objectName)) {
      fail("the upload route returned an existing object path; refusing to overwrite or clean it up.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Golden harness failed:")) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown storage error.";
    fail(`could not verify the temporary upload path: ${message}`);
  }
}

async function uploadFixture(
  baseUrl: string,
  fixture: ResolvedFixture,
  activeRun: ActiveRun,
  supabaseUrl: string,
): Promise<z.infer<typeof uploadUrlSchema>> {
  const { payload, response } = await postJson(`${baseUrl}/api/upload-url`, {
    contentType: fixture.contentType,
    fileName: fixture.fileName,
  });

  if (response.status !== 201) {
    fail(`upload URL request returned ${response.status}: ${describeUnknown(payload)}`);
  }

  const parsedUpload = uploadUrlSchema.safeParse(payload);

  if (!parsedUpload.success) {
    fail(`upload URL response violated the frozen contract: ${formatZodIssues(parsedUpload.error)}`);
  }

  if (!isSafeHarnessObjectPath(parsedUpload.data.path)) {
    fail("upload URL response returned an unsafe cleanup path.");
  }

  validatePublicAudioUrl(parsedUpload.data.audioUrl, parsedUpload.data.path, supabaseUrl);
  await assertObjectIsNew(activeRun, parsedUpload.data.path);
  activeRun.objectPath = parsedUpload.data.path;
  activeRun.audioUrl = parsedUpload.data.audioUrl;

  const uploadBytes = new Uint8Array(fixture.bytes.byteLength);
  uploadBytes.set(fixture.bytes);
  let uploadResponse: Response;

  try {
    uploadResponse = await fetch(parsedUpload.data.signedUrl, {
      body: new Blob([uploadBytes], { type: parsedUpload.data.contentType }),
      headers: {
        "cache-control": "max-age=3600",
        "content-type": parsedUpload.data.contentType,
      },
      method: "PUT",
      signal: AbortSignal.timeout(apiRequestTimeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload error.";
    fail(`signed audio upload failed or timed out: ${message}`);
  }

  if (!uploadResponse.ok) {
    fail(`signed audio upload returned ${uploadResponse.status}.`);
  }

  return parsedUpload.data;
}

async function callTranscription(
  baseUrl: string,
  audioUrl: string,
  testCase: GoldenCase,
): Promise<ApiCallResult> {
  const { payload, response } = await postJson(`${baseUrl}/api/transcribe`, { audioUrl });
  const guardReason = parseUnassessable(payload);

  if (guardReason) {
    if (response.status !== 200) {
      fail(`transcription guard returned ${response.status}, expected 200.`);
    }

    return {
      actual: {
        outcome: "unassessable",
        reason: guardReason,
        stage: "transcription",
      },
    };
  }

  if (!response.ok) {
    fail(`transcription returned ${response.status}: ${describeUnknown(payload)}`);
  }

  const transcript = timestampedTranscriptSchema.safeParse(payload);

  if (!transcript.success) {
    fail(`transcription response violated the frozen contract: ${formatZodIssues(transcript.error)}`);
  }

  return callAnalysis(baseUrl, audioUrl, transcript.data, testCase);
}

async function callAnalysis(
  baseUrl: string,
  audioUrl: string,
  transcript: z.infer<typeof timestampedTranscriptSchema>,
  testCase: GoldenCase,
): Promise<ApiCallResult> {
  const { payload, response } = await postJson(`${baseUrl}/api/analyze`, {
    audioUrl,
    passageId: testCase.passageId,
    studentId: testCase.studentId,
    transcript,
  });
  const guardReason = parseUnassessable(payload);

  if (guardReason) {
    if (response.status !== 422) {
      fail(`analysis guard returned ${response.status}, expected 422.`);
    }

    return {
      actual: {
        outcome: "unassessable",
        reason: guardReason,
        stage: "analysis",
      },
    };
  }

  if (response.status !== 200) {
    fail(`analysis returned ${response.status}: ${describeUnknown(payload)}`);
  }

  const parsed = analyzeResponseSchema.safeParse(payload);

  if (!parsed.success) {
    fail(`analysis response violated the frozen contract: ${formatZodIssues(parsed.error)}`);
  }

  return {
    actual: {
      outcome: "assessment",
      analysis: parsed.data.analysis,
    },
  };
}

function beginActiveRun(testCase: GoldenCase, supabase: AdminClient): ActiveRun {
  const activeRun: ActiveRun = {
    runStartedAt: new Date().toISOString(),
    supabase,
    testCase,
  };

  activeRuns.add(activeRun);

  return activeRun;
}

function isOwnedDraftRecord(value: unknown, activeRun: ActiveRun) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const createdAt = typeof record.created_at === "string" ? Date.parse(record.created_at) : Number.NaN;
  const cleanupCutoff = Date.parse(activeRun.runStartedAt) - 60_000;

  return (
    typeof record.id === "string" &&
    record.student_id === activeRun.testCase.studentId &&
    record.passage_id === activeRun.testCase.passageId &&
    record.audio_url === activeRun.audioUrl &&
    record.teacher_confirmed === false &&
    Number.isFinite(createdAt) &&
    createdAt >= cleanupCutoff
  );
}

async function cleanupArtifacts(activeRun: ActiveRun) {
  const errors: string[] = [];
  const cleanupCutoff = new Date(Date.parse(activeRun.runStartedAt) - 60_000).toISOString();

  if (activeRun.audioUrl) {
    try {
      const { data, error } = await activeRun.supabase
        .from("assessments")
        .select("id, student_id, passage_id, audio_url, teacher_confirmed, created_at")
        .eq("student_id", activeRun.testCase.studentId)
        .eq("passage_id", activeRun.testCase.passageId)
        .eq("audio_url", activeRun.audioUrl)
        .eq("teacher_confirmed", false)
        .gte("created_at", cleanupCutoff);

      if (error) {
        errors.push(`could not find temporary drafts: ${error.message}`);
      } else {
        for (const draft of data ?? []) {
          if (!isOwnedDraftRecord(draft, activeRun)) {
            errors.push("refused to remove a draft that did not match this golden run.");
            continue;
          }

          const { error: deleteError } = await activeRun.supabase
            .from("assessments")
            .delete()
            .eq("id", draft.id);

          if (deleteError) {
            errors.push(`could not remove temporary draft ${draft.id}: ${deleteError.message}`);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown draft cleanup error.";
      errors.push(`could not clean up temporary drafts: ${message}`);
    }
  }

  if (activeRun.objectPath) {
    if (!isSafeHarnessObjectPath(activeRun.objectPath)) {
      errors.push("refused to remove an unsafe temporary audio path.");
      return errors.join(" | ");
    }

    try {
      const { error } = await activeRun.supabase.storage
        .from("audio")
        .remove([activeRun.objectPath]);

      if (error) {
        errors.push(`could not remove temporary audio ${activeRun.objectPath}: ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown storage cleanup error.";
      errors.push(`could not clean up temporary audio: ${message}`);
    }
  }

  return errors.join(" | ");
}

async function cleanupAllActiveRuns() {
  const errors: string[] = [];

  for (const activeRun of activeRuns) {
    const cleanupError = await cleanupArtifacts(activeRun);

    if (cleanupError) {
      errors.push(`${activeRun.testCase.id}: ${cleanupError}`);
    }

    activeRuns.delete(activeRun);
  }

  return errors;
}

function installSignalCleanup(signal: NodeJS.Signals) {
  process.once(signal, () => {
    console.error(`[golden] ${signal} received; cleaning up temporary artifacts.`);
    void cleanupAllActiveRuns().then((errors) => {
      if (errors.length > 0) {
        console.error(`[golden] Cleanup warnings: ${errors.join(" | ")}`);
      }

      process.exit(130);
    });
  });
}

installSignalCleanup("SIGINT");
installSignalCleanup("SIGTERM");

async function runFixtureCase(
  testCase: GoldenCase,
  fixture: ResolvedFixture,
  baseUrl: string,
  supabase: AdminClient,
  supabaseUrl: string,
): Promise<CaseRun> {
  const startedAt = performance.now();
  const activeRun = beginActiveRun(testCase, supabase);
  let outcome: GoldenActualOutcome | undefined;
  let error: string | undefined;

  try {
    console.log(`[golden] ${testCase.id}: uploading, transcribing, and analyzing.`);
    const uploaded = await uploadFixture(baseUrl, fixture, activeRun, supabaseUrl);
    const transcription = await callTranscription(baseUrl, uploaded.audioUrl, testCase);
    outcome = transcription.actual;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unknown pipeline error.";
  }

  const cleanupError = await cleanupArtifacts(activeRun);
  activeRuns.delete(activeRun);

  return {
    ...(cleanupError ? { cleanupError } : {}),
    elapsedMs: Math.round(performance.now() - startedAt),
    ...(error ? { error } : {}),
    ...(outcome ? { outcome } : {}),
    testCase,
  };
}

function makeSilentWav(durationSec: number) {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const audioDataBytes = sampleRate * durationSec * channels * bytesPerSample;
  const wav = Buffer.alloc(44 + audioDataBytes);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + audioDataBytes, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  wav.writeUInt16LE(channels * bytesPerSample, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(audioDataBytes, 40);

  return wav;
}

async function runSyntheticSilence(
  testCase: GoldenCase,
  baseUrl: string,
  supabase: AdminClient,
  supabaseUrl: string,
): Promise<CaseRun> {
  const startedAt = performance.now();
  const objectPath = `verification/golden-near-silent-${randomUUID()}.wav`;
  const activeRun = beginActiveRun(testCase, supabase);
  activeRun.objectPath = objectPath;
  activeRun.audioUrl = publicAudioUrl(supabaseUrl, objectPath);
  let outcome: GoldenActualOutcome | undefined;
  let error: string | undefined;

  try {
    console.log("[golden] near-silent: generating and transcribing four seconds of silence.");
    await assertObjectIsNew(activeRun, objectPath);
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(objectPath, makeSilentWav(4), {
        contentType: "audio/wav",
        upsert: false,
      });

    if (uploadError) {
      fail(`could not upload generated silence: ${uploadError.message}`);
    }

    outcome = (await callTranscription(baseUrl, activeRun.audioUrl, testCase)).actual;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unknown synthetic silence error.";
  }

  const cleanupError = await cleanupArtifacts(activeRun);
  activeRuns.delete(activeRun);

  return {
    ...(cleanupError ? { cleanupError } : {}),
    elapsedMs: Math.round(performance.now() - startedAt),
    ...(error ? { error } : {}),
    ...(outcome ? { outcome } : {}),
    testCase,
  };
}

function passageWords(body: string) {
  return body
    .split(/\s+/u)
    .map((word) => word.replace(/[^\p{L}\p{M}\p{N}]/gu, ""))
    .filter(Boolean);
}

async function runSyntheticWrongPassage(
  testCase: GoldenCase,
  baseUrl: string,
  supabase: AdminClient,
  supabaseUrl: string,
): Promise<CaseRun> {
  const startedAt = performance.now();
  const sourcePassageId = "20000000-0000-4000-8000-000000000003";
  const activeRun = beginActiveRun(testCase, supabase);
  let outcome: GoldenActualOutcome | undefined;
  let error: string | undefined;

  try {
    const { data: sourcePassage, error: sourceError } = await supabase
      .from("passages")
      .select("body")
      .eq("id", sourcePassageId)
      .single();

    if (sourceError || !sourcePassage || typeof sourcePassage.body !== "string") {
      fail(`could not load the synthetic wrong-passage source: ${sourceError?.message ?? "missing body"}`);
    }

    const words = passageWords(sourcePassage.body);
    const transcript = {
      durationSec: words.length * 0.7,
      text: words.join(" "),
      words: words.map((word, index) => ({
        end: Number((index * 0.7 + 0.45).toFixed(2)),
        start: Number((index * 0.7).toFixed(2)),
        word,
      })),
    };
    activeRun.audioUrl = new URL(
      `/storage/v1/object/public/audio/verification/golden-wrong-passage-${randomUUID()}.webm`,
      supabaseUrl,
    ).toString();
    console.log("[golden] wrong-passage: analyzing a seeded transcript against a different passage.");
    const result = await callAnalysis(baseUrl, activeRun.audioUrl, transcript, testCase);

    outcome = result.actual;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unknown synthetic wrong-passage error.";
  }

  const cleanupError = await cleanupArtifacts(activeRun);
  activeRuns.delete(activeRun);

  return {
    ...(cleanupError ? { cleanupError } : {}),
    elapsedMs: Math.round(performance.now() - startedAt),
    ...(error ? { error } : {}),
    ...(outcome ? { outcome } : {}),
    testCase,
  };
}

function evaluationForRun(run: CaseRun): GoldenEvaluation | undefined {
  if (!run.outcome) {
    return undefined;
  }

  return evaluateGoldenOutcome(run.testCase.expected, run.outcome);
}

function printResults(runs: CaseRun[]) {
  const evaluations = runs.map(evaluationForRun);
  const rows = runs.map((run, index) => {
    const evaluation = evaluations[index];
    const outcome = run.outcome;
    const analysis = outcome?.outcome === "assessment" ? outcome.analysis : undefined;
    const guard = outcome?.outcome === "unassessable" ? outcome.reason : undefined;
    const guardStage = outcome?.outcome === "unassessable" ? outcome.stage : undefined;
    const issues = [run.error, run.cleanupError, ...(evaluation?.failures ?? [])].filter(
      (value): value is string => Boolean(value),
    );
    const verdict = run.error || run.cleanupError ? "FAIL" : (evaluation?.verdict ?? "FAIL");

    return {
      Clip: run.testCase.label,
      Expected: formatGoldenExpectation(run.testCase.expected),
      Result: analysis ? "assessment" : guard ? `${guardStage} guard` : "ERROR",
      Level: analysis?.level ?? "-",
      WCPM: analysis ? analysis.wcpm.toFixed(1) : "-",
      Accuracy: analysis ? `${analysis.accuracy_pct.toFixed(1)}%` : "-",
      "Errors found / guard": analysis
        ? formatAnalysisErrors(analysis)
        : (guard ?? issues.join(" | ")) || "-",
      Elapsed: `${(run.elapsedMs / 1000).toFixed(1)}s`,
      Verdict: verdict,
    };
  });

  console.table(rows);

  for (const [index, run] of runs.entries()) {
    const evaluation = evaluations[index];
    const notes = [
      ...(evaluation?.notes ?? []),
      ...(evaluation?.failures ?? []),
      ...(run.error ? [run.error] : []),
      ...(run.cleanupError ? [run.cleanupError] : []),
    ];

    if (notes.length > 0) {
      console.log(`- ${run.testCase.id}: ${notes.join(" | ")}`);
    }
  }

  const failures = rows.filter((row) => row.Verdict === "FAIL").length;
  const reviews = rows.filter((row) => row.Verdict === "REVIEW").length;

  console.log(
    `Golden set complete: ${runs.length - failures - reviews} passed, ${reviews} need human review, ${failures} failed.`,
  );

  return { failures, reviews };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options === "help") {
    usage();
    return;
  }

  const manifest = await loadManifest();
  const requiredCases = manifest.cases;
  const selectableCases = [...requiredCases, ...manifest.optionalCases];
  let selectedCases: GoldenCase[];

  if (options.syntheticOnly) {
    const silenceCase = requiredCases.find((testCase) => testCase.id === "near-silent");
    const wrongPassageCase = requiredCases.find((testCase) => testCase.id === "wrong-passage");

    if (!silenceCase || !wrongPassageCase) {
      fail("The required synthetic guard cases are missing from the manifest.");
    }

    selectedCases = [silenceCase, wrongPassageCase];
  } else if (options.caseId) {
    const selected = selectableCases.find((testCase) => testCase.id === options.caseId);

    if (!selected) {
      fail(`No golden case is named ${options.caseId}.`);
    }

    selectedCases = [selected];
  } else {
    selectedCases = options.includeOptional
      ? [...requiredCases, ...manifest.optionalCases]
      : requiredCases;
  }

  const { supabase, supabaseUrl } = createSupabaseAdminClient();

  if (!options.syntheticOnly) {
    const fixtureEntries = await Promise.all(
      selectedCases.map(async (testCase) => {
        try {
          return { fixture: await preflightFixture(testCase), testCase };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message.replace(/^Golden harness failed: /u, "") : "Unknown preflight error.",
            testCase,
          };
        }
      }),
    );
    const missing = fixtureEntries
      .filter((entry): entry is { error: string; testCase: GoldenCase } => "error" in entry)
      .map((entry) => ({ id: entry.testCase.id, reason: entry.error }));

    if (missing.length > 0) {
      printMissingFixtures(selectedCases, missing);
      console.error(
        "Add the curated fixtures listed in sample-data/golden/README.md before running the live golden set. No network calls were made.",
      );
      process.exitCode = 1;
      return;
    }

    const fixtures = new Map(
      fixtureEntries.map((entry) => [
        entry.testCase.id,
        (entry as { fixture: ResolvedFixture; testCase: GoldenCase }).fixture,
      ]),
    );
    const app = await acquireApp(options);

    try {
      const runs: CaseRun[] = [];

      for (const testCase of selectedCases) {
        const fixture = fixtures.get(testCase.id);

        if (!fixture) {
          fail(`Fixture preflight lost ${testCase.id}.`);
        }

        runs.push(await runFixtureCase(testCase, fixture, app.baseUrl, supabase, supabaseUrl));
      }

      const summary = printResults(runs);

      if (summary.failures > 0 || summary.reviews > 0) {
        process.exitCode = 1;
      }
    } finally {
      await stopLocalApp(app);
    }

    return;
  }

  const app = await acquireApp(options);

  try {
    const [silenceCase, wrongPassageCase] = selectedCases;

    if (!silenceCase || !wrongPassageCase) {
      fail("Synthetic guard cases were unavailable.");
    }

    const runs = [
      await runSyntheticSilence(silenceCase, app.baseUrl, supabase, supabaseUrl),
      await runSyntheticWrongPassage(wrongPassageCase, app.baseUrl, supabase, supabaseUrl),
    ];

    const summary = printResults(runs);

    if (summary.failures > 0 || summary.reviews > 0) {
      process.exitCode = 1;
    }
  } finally {
    await stopLocalApp(app);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[golden] ${message}`);
  process.exitCode = 1;
});
