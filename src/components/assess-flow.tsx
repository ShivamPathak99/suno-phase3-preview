"use client";

import Link from "next/link";
import { type MutableRefObject, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { analysisSchema, type ReadingAnalysis } from "@/lib/analysisSchema";
import type { AnalyzeResponse, TimestampedTranscript } from "@/lib/assessment-contract";
import type { AssessDebugMode } from "@/lib/assess-debug";
import type { AssessmentContext, ReadingLevel } from "@/lib/assessment-types";
import { uploadAudioFile } from "@/lib/upload-audio";

type FlowState =
  | "ready"
  | "recording"
  | "short-recording"
  | "processing"
  | "complete"
  | "mic-error"
  | "no-microphone-signal"
  | "processing-error"
  | "unassessable-quiet"
  | "unassessable-too-fast"
  | "unassessable-wrong-passage"
  | "upload-error";

type CapturedRecording = {
  durationSec: number;
  file: File;
};

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type ApiResponse = {
  ok: boolean;
  payload: unknown;
};

type AssessFlowProps = {
  context: AssessmentContext;
  debugMode?: AssessDebugMode;
  /** The explicit fixture path remains available for visual/debug checks only. */
  mode?: "live" | "mock";
  mockAnalysis?: ReadingAnalysis;
};

class PipelineTimeoutError extends Error {
  constructor() {
    super("This step took too long.");
  }
}

const maximumRecordingSeconds = 120;
const minimumKeepDurationSeconds = 5;
const microphoneSignalThreshold = 0.012;
const mockStageDelayMs = 2_000;
const stageTimeoutMs = 45_000;
const sampleRecordingSource = "/sample-recordings/child-struggling.mp4";
const uploadRetryCount = 2;

function initialFlowState(debugMode: AssessDebugMode | undefined): FlowState {
  switch (debugMode) {
    case "mic-denied":
      return "mic-error";
    case "upload-failed":
      return "upload-error";
    case "unassessable-quiet":
      return "unassessable-quiet";
    case "unassessable-too-fast":
      return "unassessable-too-fast";
    case "unassessable-wrong-passage":
      return "unassessable-wrong-passage";
    case "analysis-timeout":
      return "processing-error";
    default:
      return "ready";
  }
}

const processingStages = [
  "Uploading the recording",
  "Listening to the reading",
  "Checking each word…",
];

const levelLabels: Record<ReadingLevel, string> = {
  letter: "Letter",
  word: "Word",
  paragraph: "Paragraph",
  story: "Story",
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/u)[0] ?? name;
}

function supportedRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

function recordingFileName(mimeType: string) {
  return `suno-reading-${Date.now()}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function withStageTimeout<T>(
  activeAbortControllerRef: MutableRefObject<AbortController | null>,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, stageTimeoutMs);

  activeAbortControllerRef.current = controller;

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (didTimeout) {
      throw new PipelineTimeoutError();
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
    if (activeAbortControllerRef.current === controller) {
      activeAbortControllerRef.current = null;
    }
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return fallback;
}

function isUnassessable(payload: unknown): payload is { reason: string; unassessable: true } {
  return (
    Boolean(payload) &&
    typeof payload === "object" &&
    (payload as { unassessable?: unknown }).unassessable === true &&
    typeof (payload as { reason?: unknown }).reason === "string"
  );
}

function parseTranscript(payload: unknown): TimestampedTranscript | null {
  const parsed = payload && typeof payload === "object"
    ? (payload as TimestampedTranscript)
    : null;

  if (!parsed || typeof parsed.text !== "string" || !Number.isFinite(parsed.durationSec)) {
    return null;
  }

  if (!Array.isArray(parsed.words)) {
    return null;
  }

  return parsed.words.every(
    (word) =>
      word &&
      typeof word.word === "string" &&
      Number.isFinite(word.start) &&
      Number.isFinite(word.end),
  )
    ? parsed
    : null;
}

function parseAnalyzeResponse(payload: unknown): AnalyzeResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as { analysis?: unknown; assessmentId?: unknown };
  const analysis = analysisSchema.safeParse(candidate.analysis);

  if (!analysis.success || typeof candidate.assessmentId !== "string") {
    return null;
  }

  return { analysis: analysis.data, assessmentId: candidate.assessmentId };
}

function flowStateForUnassessable(reason: string): FlowState {
  const normalized = reason.toLowerCase();

  if (normalized.includes("too fast")) {
    return "unassessable-too-fast";
  }

  if (normalized.includes("did not match")) {
    return "unassessable-wrong-passage";
  }

  return "unassessable-quiet";
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" className="record-icon" fill="none" viewBox="0 0 24 24">
      <rect height="11" rx="3.5" stroke="currentColor" strokeWidth="1.9" width="7" x="8.5" y="2" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m5 12.5 4.3 4.3L19 7.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="spinner-icon" fill="none" viewBox="0 0 24 24">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.4v5.5M12 16.4h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

type AssessmentErrorCardProps = {
  actions: ReactNode;
  body: string;
  detail?: string;
  title: string;
};

function AssessmentErrorCard({ actions, body, detail, title }: AssessmentErrorCardProps) {
  return (
    <section aria-live="assertive" className="error-card" role="alert">
      <span aria-hidden="true" className="error-icon">
        <ErrorIcon />
      </span>
      <div className="error-card-copy">
        <h2>{title}</h2>
        <p>{body}</p>
        {detail ? <p className="error-detail">{detail}</p> : null}
      </div>
      <div className="error-actions">{actions}</div>
    </section>
  );
}

export function AssessFlow({ context, debugMode, mode = "live", mockAnalysis }: AssessFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>(() => initialFlowState(debugMode));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRequestingMicrophone, setIsRequestingMicrophone] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [microphoneMessage, setMicrophoneMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [recording, setRecording] = useState<CapturedRecording | null>(null);
  const [completedAssessment, setCompletedAssessment] = useState<AnalyzeResponse | null>(null);
  const [meterLevels, setMeterLevels] = useState([0, 0, 0, 0, 0]);
  const [hasLoadedSample, setHasLoadedSample] = useState(false);
  const [hasDetectedMicrophoneSignal, setHasDetectedMicrophoneSignal] = useState(false);

  const autoStopTimerRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef(0);
  const meterTimerRef = useRef<number | null>(null);
  const microphoneRequestRef = useRef(0);
  const pipelineRunRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const sampleRunRef = useRef(0);
  const sampleProcessingRef = useRef(false);
  const hasDetectedMicrophoneSignalRef = useRef(false);
  const canMeasureMicrophoneSignalRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const clearRecordingResources = useCallback((invalidateRecorder = false) => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    if (meterTimerRef.current !== null) {
      window.clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (invalidateRecorder && recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }, []);

  const stopSamplePlayback = useCallback(() => {
    const sampleAudio = sampleAudioRef.current;

    if (!sampleAudio) {
      return;
    }

    sampleAudio.pause();

    try {
      sampleAudio.currentTime = 0;
    } catch {
      // A browser can reject a seek before metadata is available. Pausing is
      // still sufficient cleanup for an interrupted sample preview.
    }
  }, []);

  const cancelPipeline = useCallback(() => {
    pipelineRunRef.current += 1;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
  }, []);

  const postJson = useCallback(
    async (path: string, body: unknown): Promise<ApiResponse> =>
      withStageTimeout(activeAbortControllerRef, async (signal) => {
        const response = await fetch(path, {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal,
        });
        const payload = await response.json().catch(() => null);

        return { ok: response.ok, payload };
      }),
    [],
  );

  const uploadWithRetries = useCallback(
    async (file: File) => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= uploadRetryCount; attempt += 1) {
        try {
          return await withStageTimeout(activeAbortControllerRef, (signal) =>
            uploadAudioFile(file, signal),
          );
        } catch (error) {
          if (error instanceof PipelineTimeoutError) {
            throw error;
          }

          lastError = error;
          if (attempt < uploadRetryCount) {
            setNotice("The upload paused. Trying again…");
            await wait((attempt + 1) * 600);
          }
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("The audio upload did not complete.");
    },
    [],
  );

  const runMockProcessing = useCallback(async () => {
    const runId = pipelineRunRef.current + 1;
    pipelineRunRef.current = runId;
    setCompletedAssessment(null);
    setFlowState("processing");

    try {
      for (const [index] of processingStages.entries()) {
        setProcessingStep(index);
        await wait(mockStageDelayMs);

        if (pipelineRunRef.current !== runId) {
          return;
        }
      }

      setFlowState("complete");
    } catch {
      if (pipelineRunRef.current === runId) {
        setFlowState("processing-error");
      }
    }
  }, []);

  const runLivePipeline = useCallback(
    async (capturedRecording: CapturedRecording) => {
      activeAbortControllerRef.current?.abort();
      const runId = pipelineRunRef.current + 1;
      pipelineRunRef.current = runId;
      let activeStage: "upload" | "transcribe" | "analyze" = "upload";
      setCompletedAssessment(null);
      setNotice("");
      setFlowState("processing");

      const isCurrentRun = () => pipelineRunRef.current === runId;

      try {
        setProcessingStep(0);
        const uploadedAudio = await uploadWithRetries(capturedRecording.file);

        if (!isCurrentRun()) {
          return;
        }

        activeStage = "transcribe";
        setProcessingStep(1);
        const transcriptionResponse = await postJson("/api/transcribe", {
          audioUrl: uploadedAudio.audioUrl,
        });

        if (!isCurrentRun()) {
          return;
        }

        if (isUnassessable(transcriptionResponse.payload)) {
          setNotice(transcriptionResponse.payload.reason);
          setFlowState(flowStateForUnassessable(transcriptionResponse.payload.reason));
          return;
        }

        const transcript = parseTranscript(transcriptionResponse.payload);
        if (!transcriptionResponse.ok || !transcript) {
          throw new Error(
            errorMessage(transcriptionResponse.payload, "Couldn't transcribe the recording. Please try again."),
          );
        }

        activeStage = "analyze";
        setProcessingStep(2);
        const analysisResponse = await postJson("/api/analyze", {
          audioUrl: uploadedAudio.audioUrl,
          passageId: context.passage.id,
          studentId: context.student.id,
          transcript,
        });

        if (!isCurrentRun()) {
          return;
        }

        if (isUnassessable(analysisResponse.payload)) {
          setNotice(analysisResponse.payload.reason);
          setFlowState(flowStateForUnassessable(analysisResponse.payload.reason));
          return;
        }

        const assessment = parseAnalyzeResponse(analysisResponse.payload);
        if (!analysisResponse.ok || !assessment) {
          throw new Error(
            errorMessage(analysisResponse.payload, "Couldn't analyze the reading. Please try again."),
          );
        }

        setCompletedAssessment(assessment);
        setFlowState("complete");
      } catch (error) {
        if (!isCurrentRun()) {
          return;
        }

        if (activeStage === "upload") {
          setNotice(
            error instanceof PipelineTimeoutError
              ? "The upload took too long. Check the connection and retry."
              : "The recording is still saved here. You can retry without recording again.",
          );
          setFlowState("upload-error");
          return;
        }

        setNotice(
          error instanceof PipelineTimeoutError
            ? "This step took too long. Please try once more."
            : "Something went wrong while checking the reading. Please try again.",
        );
        setFlowState("processing-error");
      }
    },
    [context.passage.id, context.student.id, postJson, uploadWithRetries],
  );

  const runAssessment = useCallback(
    (capturedRecording: CapturedRecording) => {
      if (mode === "mock") {
        return runMockProcessing();
      }

      return runLivePipeline(capturedRecording);
    },
    [mode, runLivePipeline, runMockProcessing],
  );

  const stopRecording = useCallback(
    (stoppedAtLimit = false) => {
      const recorder = recorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        return;
      }

      if (stoppedAtLimit) {
        setNotice("Recording stopped at 2:00.");
      }

      setIsStopping(true);
      recorder.stop();
    },
    [],
  );

  const startAudioMeter = useCallback((stream: MediaStream) => {
    const AudioContextConstructor =
      window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

    if (!AudioContextConstructor) {
      return;
    }

    canMeasureMicrophoneSignalRef.current = true;
    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 64;
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    void audioContext.resume().catch(() => {
      // The meter is advisory. Recording can still proceed on browsers that
      // postpone AudioContext playback permission.
    });

    meterTimerRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(
        data.reduce((sum, value) => {
          const normalized = (value - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / data.length,
      );

      if (rms >= microphoneSignalThreshold && !hasDetectedMicrophoneSignalRef.current) {
        hasDetectedMicrophoneSignalRef.current = true;
        setHasDetectedMicrophoneSignal(true);
      }

      const meterLevel = Math.min(1, rms * 9);
      setMeterLevels([0.42, 0.63, 1, 0.63, 0.42].map((weight) => meterLevel * weight));
    }, 120);
  }, []);

  const startRecording = useCallback(async () => {
    if (isRequestingMicrophone) {
      return;
    }

    cancelPipeline();
    sampleRunRef.current += 1;
    sampleProcessingRef.current = false;
    stopSamplePlayback();
    setHasLoadedSample(false);
    hasDetectedMicrophoneSignalRef.current = false;
    canMeasureMicrophoneSignalRef.current = false;
    setHasDetectedMicrophoneSignal(false);
    setMeterLevels([0, 0, 0, 0, 0]);
    setIsRequestingMicrophone(true);
    setMicrophoneMessage("");
    setNotice("");
    const microphoneRequestId = microphoneRequestRef.current + 1;
    microphoneRequestRef.current = microphoneRequestId;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setIsRequestingMicrophone(false);
      setMicrophoneMessage("This browser cannot record audio. Try a current browser or use a sample recording.");
      setFlowState("mic-error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (microphoneRequestRef.current !== microphoneRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = supportedRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const startedAt = Date.now();
      const recordingSessionId = recordingSessionRef.current + 1;

      recordingSessionRef.current = recordingSessionId;
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      setRecording(null);
      setCompletedAssessment(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordingSessionRef.current !== recordingSessionId) {
          return;
        }

        const durationSec = elapsedSecondsRef.current;
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recorderChunksRef.current, { type: finalMimeType });

        clearRecordingResources();
        setIsStopping(false);
        setMeterLevels([0, 0, 0, 0, 0]);

        if (blob.size === 0) {
          setMicrophoneMessage("No audio was captured. Check the microphone, then try again.");
          setFlowState("mic-error");
          return;
        }

        const capturedRecording = {
          durationSec,
          file: new File([blob], recordingFileName(finalMimeType), { type: finalMimeType }),
        };
        setRecording(capturedRecording);

        if (canMeasureMicrophoneSignalRef.current && !hasDetectedMicrophoneSignalRef.current) {
          setMicrophoneMessage(
            "No sound reached the selected microphone. Choose the correct microphone in your browser's site settings, then try again.",
          );
          setFlowState("no-microphone-signal");
          return;
        }

        if (durationSec < minimumKeepDurationSeconds) {
          setFlowState("short-recording");
          return;
        }

        void runAssessment(capturedRecording);
      };

      recorder.start(250);
      startAudioMeter(stream);
      setFlowState("recording");
      setIsRequestingMicrophone(false);

      recordingTimerRef.current = window.setInterval(() => {
        const nextElapsed = Math.min(
          maximumRecordingSeconds,
          Math.floor((Date.now() - startedAt) / 1_000),
        );

        elapsedSecondsRef.current = nextElapsed;
        setElapsedSeconds(nextElapsed);
      }, 250);

      autoStopTimerRef.current = window.setTimeout(() => {
        stopRecording(true);
      }, maximumRecordingSeconds * 1_000);
    } catch {
      recordingSessionRef.current += 1;
      clearRecordingResources(true);
      setIsRequestingMicrophone(false);
      setMicrophoneMessage("Allow microphone access in your browser, then try again.");
      setFlowState("mic-error");
    }
  }, [
    cancelPipeline,
    clearRecordingResources,
    isRequestingMicrophone,
    runAssessment,
    startAudioMeter,
    stopRecording,
    stopSamplePlayback,
  ]);

  const loadSampleRecording = useCallback(() => {
    if (sampleProcessingRef.current) {
      return;
    }

    const sampleRunId = sampleRunRef.current + 1;
    sampleRunRef.current = sampleRunId;
    sampleProcessingRef.current = true;
    microphoneRequestRef.current += 1;
    cancelPipeline();
    clearRecordingResources(true);
    setIsRequestingMicrophone(false);
    setIsStopping(false);
    setMicrophoneMessage("");
    setNotice("Playing a sample child recording.");
    setRecording(null);
    setCompletedAssessment(null);
    setElapsedSeconds(0);
    setHasLoadedSample(true);
    hasDetectedMicrophoneSignalRef.current = false;
    canMeasureMicrophoneSignalRef.current = false;
    setHasDetectedMicrophoneSignal(false);

    const sampleAudio = sampleAudioRef.current;

    if (sampleAudio) {
      try {
        sampleAudio.currentTime = 0;
        void sampleAudio.play().catch(() => {
          if (sampleRunRef.current === sampleRunId) {
            setNotice("Preparing the sample recording.");
          }
        });
      } catch {
        setNotice("Preparing the sample recording.");
      }
    }

    if (mode === "mock") {
      void runMockProcessing().finally(() => {
        if (sampleRunRef.current === sampleRunId) {
          sampleProcessingRef.current = false;
        }
      });
      return;
    }

    void (async () => {
      try {
        const response = await fetch(sampleRecordingSource);
        if (!response.ok) {
          throw new Error("The sample recording could not be loaded.");
        }

        const blob = await response.blob();
        if (sampleRunRef.current !== sampleRunId) {
          return;
        }

        const mimeType = blob.type === "audio/mp4" || blob.type === "video/mp4"
          ? blob.type
          : "audio/mp4";
        const duration = sampleAudio?.duration;
        const capturedRecording = {
          durationSec:
            typeof duration === "number" && Number.isFinite(duration) && duration > 0
              ? Math.round(duration)
              : minimumKeepDurationSeconds,
          file: new File([blob], "suno-sample-child.mp4", { type: mimeType }),
        };

        setRecording(capturedRecording);
        setNotice("Checking the sample child recording.");
        await runLivePipeline(capturedRecording);
      } catch {
        if (sampleRunRef.current === sampleRunId) {
          setNotice("The sample recording could not be prepared. Please try again.");
          setFlowState("processing-error");
        }
      } finally {
        if (sampleRunRef.current === sampleRunId) {
          sampleProcessingRef.current = false;
        }
      }
    })();
  }, [cancelPipeline, clearRecordingResources, mode, runLivePipeline, runMockProcessing]);

  const discardRecording = useCallback(() => {
    cancelPipeline();
    sampleRunRef.current += 1;
    sampleProcessingRef.current = false;
    stopSamplePlayback();
    setRecording(null);
    setCompletedAssessment(null);
    setElapsedSeconds(0);
    setNotice("");
    setMicrophoneMessage("");
    setHasLoadedSample(false);
    hasDetectedMicrophoneSignalRef.current = false;
    canMeasureMicrophoneSignalRef.current = false;
    setHasDetectedMicrophoneSignal(false);
    setMeterLevels([0, 0, 0, 0, 0]);
    setFlowState("ready");
  }, [cancelPipeline, stopSamplePlayback]);

  const retryRecording = useCallback(() => {
    if (!recording) {
      discardRecording();
      return;
    }

    void runAssessment(recording);
  }, [discardRecording, recording, runAssessment]);

  const assessWithoutMeterSignal = useCallback(() => {
    if (!recording) {
      discardRecording();
      return;
    }

    void runAssessment(recording);
  }, [discardRecording, recording, runAssessment]);

  useEffect(
    () => () => {
      cancelPipeline();
      microphoneRequestRef.current += 1;
      recordingSessionRef.current += 1;
      sampleRunRef.current += 1;
      sampleProcessingRef.current = false;
      stopSamplePlayback();
      clearRecordingResources(true);
    },
    [cancelPipeline, clearRecordingResources, stopSamplePlayback],
  );

  const passageIsDimmed = flowState === "processing";
  const levelClassName = `level-${context.passage.level}`;
  const completionAnalysis = completedAssessment?.analysis ?? mockAnalysis;
  const reviewHref = completedAssessment
    ? `/assess/${context.student.id}?assessmentId=${encodeURIComponent(completedAssessment.assessmentId)}`
    : `/assess/${context.student.id}?mock=confirm`;

  return (
    <main className="assessment-page">
      <section className="assessment-shell" aria-labelledby="assessment-title">
        <header className="assessment-header">
          <Link className="back-link" href="/" aria-label="Back to the class">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Class</span>
          </Link>
          <div className="assessment-heading">
            <p className="assessment-kicker">Reading check</p>
            <h1 id="assessment-title">{context.student.name}</h1>
          </div>
          <span className={`level-chip ${levelClassName}`}>
            <span aria-hidden="true" className="level-chip-mark">
              {context.passage.level === "letter" ? "A" : context.passage.level === "word" ? "—" : context.passage.level === "paragraph" ? "≡" : "▱"}
            </span>
            {levelLabels[context.passage.level]}
          </span>
        </header>

        <div className="passage-area">
          <article
            className={`ruled-passage${passageIsDimmed ? " is-dimmed" : ""}`}
            lang={context.passage.language}
          >
            <p className="passage-title">{context.passage.title}</p>
            <p className="passage-text">{context.passage.body}</p>
          </article>

          {flowState === "processing" ? (
            <section aria-live="polite" className="processing-card" role="status">
              <p className="processing-kicker">Reading check in progress</p>
              <ol className="processing-list">
                {processingStages.map((stage, index) => {
                  const isComplete = index < processingStep;
                  const isCurrent = index === processingStep;

                  return (
                    <li key={stage} className={isComplete ? "is-complete" : isCurrent ? "is-current" : ""}>
                      <span className="processing-icon">
                        {isComplete ? <CheckIcon /> : isCurrent ? <SpinnerIcon /> : <span />}
                      </span>
                      <span>{stage}</span>
                    </li>
                  );
                })}
              </ol>
              {notice ? <p className="processing-notice">{notice}</p> : null}
            </section>
          ) : null}
        </div>

        <section
          aria-live="polite"
          className={`sample-audio-player${hasLoadedSample ? " is-visible" : ""}`}
        >
          <p className="sample-audio-title">Sample child recording</p>
          <p className="sample-audio-note">
            {mode === "mock"
              ? "Practice playback for the visual demo."
              : "This sample is processed through the same reading check."}
          </p>
          <audio
            aria-label="Sample child recording"
            controls
            onError={() => {
              if (hasLoadedSample) {
                setNotice("The sample could not play here, but it can still be checked.");
              }
            }}
            preload="metadata"
            ref={sampleAudioRef}
            src={sampleRecordingSource}
          >
            Your browser cannot play this sample recording.
          </audio>
        </section>

        {flowState === "ready" ? (
          <section className="recording-control" aria-label="Start recording">
            <button
              className="record-button"
              disabled={isRequestingMicrophone}
              onClick={() => void startRecording()}
              type="button"
            >
              <MicrophoneIcon />
              <span className="sr-only">{isRequestingMicrophone ? "Opening microphone" : "Start recording"}</span>
            </button>
            <p className="recording-caption">
              {isRequestingMicrophone
                ? "Opening the microphone…"
                : `Hand the phone to ${firstName(context.student.name)}, then tap`}
            </p>
            <button
              className="quiet-action"
              disabled={isRequestingMicrophone}
              onClick={loadSampleRecording}
              type="button"
            >
              No mic? Try a sample child recording
            </button>
            <Link className="change-passage" href="/">
              Change passage
            </Link>
          </section>
        ) : null}

        {flowState === "recording" ? (
          <section className="recording-control recording-live" aria-label="Recording in progress">
            <div className="recording-meter-row">
              <div aria-label="Microphone level" className="audio-meter" role="img">
                {meterLevels.map((level, index) => (
                  <span key={index} style={{ height: `${Math.round(level * 100)}%` }} />
                ))}
              </div>
              <time className="recording-timer">{formatDuration(elapsedSeconds)}</time>
            </div>
            <button
              className="record-button stop-button"
              disabled={isStopping}
              onClick={() => stopRecording()}
              type="button"
            >
              <span aria-hidden="true" className="stop-square" />
              <span className="sr-only">{isStopping ? "Stopping recording" : "Stop recording"}</span>
            </button>
            <p className="recording-caption">Tap stop when {firstName(context.student.name)} has finished.</p>
            <p className="gentle-notice">
              {hasDetectedMicrophoneSignal
                ? "Sound detected from the selected microphone."
                : "Waiting for sound from the selected microphone."}
            </p>
            {notice ? <p className="gentle-notice">{notice}</p> : null}
          </section>
        ) : null}

        {flowState === "short-recording" ? (
          <section className="decision-card" aria-labelledby="short-recording-title">
            <p className="decision-kicker">Short recording · {formatDuration(recording?.durationSec ?? 0)}</p>
            <h2 id="short-recording-title">Record a little longer</h2>
            <p>Wait until the timer reaches 00:05 before stopping. This keeps the reading check reliable.</p>
            <div className="decision-actions">
              <button className="primary-action" onClick={discardRecording} type="button">
                Record again
              </button>
            </div>
            {notice ? <p className="gentle-notice">{notice}</p> : null}
          </section>
        ) : null}

        {flowState === "complete" && completionAnalysis ? (
          <section className="completion-card" aria-live="polite" role="status">
            <span className="completion-icon">
              <CheckIcon />
            </span>
            <div>
              <h2>Reading check complete</h2>
              <p>
                A {levelLabels[completionAnalysis.level].toLowerCase()}-level result is ready for teacher review.
              </p>
            </div>
            <div className="completion-actions">
              <Link className="primary-action completion-review" href={reviewHref}>
                Review result
              </Link>
              <button className="secondary-action" onClick={discardRecording} type="button">
                Record again
              </button>
            </div>
          </section>
        ) : null}

        {flowState === "mic-error" ? (
          <AssessmentErrorCard
            actions={
              <>
                <button className="primary-action" onClick={() => void startRecording()} type="button">
                  Try again
                </button>
                <button className="secondary-action" onClick={loadSampleRecording} type="button">
                  Use a sample
                </button>
              </>
            }
            body="Allow the microphone in your browser's address bar, or use a sample recording."
            detail={microphoneMessage || undefined}
            title="Microphone is blocked"
          />
        ) : null}

        {flowState === "no-microphone-signal" ? (
          <AssessmentErrorCard
            actions={
              <>
                <button className="primary-action" onClick={discardRecording} type="button">
                  Record again
                </button>
                <button className="secondary-action" onClick={assessWithoutMeterSignal} type="button">
                  Check anyway
                </button>
                <button className="secondary-action" onClick={loadSampleRecording} type="button">
                  Use a sample
                </button>
              </>
            }
            body="Suno did not detect sound from the selected microphone. Choose the correct microphone in your browser's site settings, then record again."
            detail={microphoneMessage || undefined}
            title="No sound detected"
          />
        ) : null}

        {flowState === "upload-error" ? (
          <AssessmentErrorCard
            actions={
              <button className="primary-action" onClick={retryRecording} type="button">
                Retry upload
              </button>
            }
            body={"Check the connection. The recording is saved — you won't need to record again."}
            detail={notice || undefined}
            title="The recording didn't upload"
          />
        ) : null}

        {flowState === "unassessable-quiet" ? (
          <AssessmentErrorCard
            actions={
              <button className="primary-action" onClick={discardRecording} type="button">
                Record again
              </button>
            }
            body={`The recording was too quiet or too short. Move closer to ${context.student.name} and try again.`}
            detail="If this repeats, make sure “Sound detected” appears while the child speaks. If it does not, choose the correct microphone in your browser's site settings."
            title="Couldn't hear the reading"
          />
        ) : null}

        {flowState === "unassessable-too-fast" ? (
          <AssessmentErrorCard
            actions={
              <button className="primary-action" onClick={discardRecording} type="button">
                Record again
              </button>
            }
            body={"The reading was too fast to assess — please try again."}
            title="The reading was too fast to assess"
          />
        ) : null}

        {flowState === "unassessable-wrong-passage" ? (
          <AssessmentErrorCard
            actions={
              <>
                <button className="primary-action" onClick={discardRecording} type="button">
                  Record again
                </button>
                <Link className="secondary-action" href="/">
                  Change passage
                </Link>
              </>
            }
            body="The reading didn't match the text on screen. Check the passage and try again."
            title="That didn't match the passage"
          />
        ) : null}

        {flowState === "processing-error" ? (
          <AssessmentErrorCard
            actions={
              <button className="primary-action" onClick={retryRecording} type="button">
                Retry
              </button>
            }
            body="Something's stuck on our side. Try once more."
            detail={notice || undefined}
            title="This is taking too long"
          />
        ) : null}
      </section>
    </main>
  );
}
