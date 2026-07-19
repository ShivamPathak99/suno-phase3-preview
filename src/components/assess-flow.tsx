"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { ReadingAnalysis } from "@/lib/analysisSchema";
import type { AssessDebugMode } from "@/lib/assess-debug";
import type { MockAssessmentContext, ReadingLevel } from "@/lib/mock-assessment";

type FlowState =
  | "ready"
  | "recording"
  | "short-recording"
  | "processing"
  | "complete"
  | "mic-error"
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

type AssessFlowProps = {
  context: MockAssessmentContext;
  debugMode?: AssessDebugMode;
  mockAnalysis: ReadingAnalysis;
};

const maximumRecordingSeconds = 120;
const minimumKeepDurationSeconds = 5;
const stageDelayMs = 2_000;
const stageTimeoutMs = 45_000;
const sampleRecordingSource = "/sample-recordings/child-struggling.mp4";

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

function waitForMockStage(delayMs: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const finishTimer = window.setTimeout(() => {
      window.clearTimeout(timeoutTimer);
      resolve();
    }, delayMs);
    const timeoutTimer = window.setTimeout(() => {
      window.clearTimeout(finishTimer);
      reject(new Error("The mock processing stage timed out."));
    }, timeoutMs);
  });
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

export function AssessFlow({ context, debugMode, mockAnalysis }: AssessFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>(() => initialFlowState(debugMode));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRequestingMicrophone, setIsRequestingMicrophone] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [microphoneMessage, setMicrophoneMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [recording, setRecording] = useState<CapturedRecording | null>(null);
  const [meterLevels, setMeterLevels] = useState([0.18, 0.28, 0.42, 0.28, 0.18]);
  const [hasLoadedSample, setHasLoadedSample] = useState(false);

  const autoStopTimerRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef(0);
  const meterTimerRef = useRef<number | null>(null);
  const microphoneRequestRef = useRef(0);
  const mockRunRef = useRef(0);
  const sampleRunRef = useRef(0);
  const sampleProcessingRef = useRef(false);
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

  const runMockProcessing = useCallback(async () => {
    const runId = mockRunRef.current + 1;
    mockRunRef.current = runId;
    setFlowState("processing");

    try {
      for (const [index] of processingStages.entries()) {
        setProcessingStep(index);
        await waitForMockStage(stageDelayMs, stageTimeoutMs);

        if (mockRunRef.current !== runId) {
          return;
        }
      }

      setFlowState("complete");
    } catch {
      if (mockRunRef.current === runId) {
        stopSamplePlayback();
        setFlowState("processing-error");
      }
    }
  }, [stopSamplePlayback]);

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

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 64;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    meterTimerRef.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length / 255;

      setMeterLevels([0.42, 0.63, 1, 0.63, 0.42].map((weight) => Math.max(0.12, average * weight + 0.1)));
    }, 120);
  }, []);

  const startRecording = useCallback(async () => {
    if (isRequestingMicrophone) {
      return;
    }

    sampleRunRef.current += 1;
    sampleProcessingRef.current = false;
    stopSamplePlayback();
    setHasLoadedSample(false);
    setIsRequestingMicrophone(true);
    setMicrophoneMessage("");
    setNotice("");
    mockRunRef.current += 1;
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
        setMeterLevels([0.18, 0.28, 0.42, 0.28, 0.18]);

        if (blob.size === 0) {
          setMicrophoneMessage("No audio was captured. Check the microphone, then try again.");
          setFlowState("mic-error");
          return;
        }

        setRecording({
          durationSec,
          file: new File([blob], recordingFileName(finalMimeType), { type: finalMimeType }),
        });

        if (durationSec < minimumKeepDurationSeconds) {
          setFlowState("short-recording");
          return;
        }

        void runMockProcessing();
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
    clearRecordingResources,
    isRequestingMicrophone,
    runMockProcessing,
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
    clearRecordingResources(true);
    setIsRequestingMicrophone(false);
    setIsStopping(false);
    setMicrophoneMessage("");
    setNotice("Playing a sample child recording.");
    setRecording(null);
    setElapsedSeconds(0);
    setHasLoadedSample(true);

    const sampleAudio = sampleAudioRef.current;

    if (sampleAudio) {
      try {
        sampleAudio.currentTime = 0;
        void sampleAudio.play().catch(() => {
          if (sampleRunRef.current === sampleRunId) {
            setNotice("Processing the sample recording.");
          }
        });
      } catch {
        setNotice("Processing the sample recording.");
      }
    }

    void runMockProcessing().finally(() => {
      if (sampleRunRef.current === sampleRunId) {
        sampleProcessingRef.current = false;
      }
    });
  }, [clearRecordingResources, runMockProcessing]);

  const discardRecording = useCallback(() => {
    mockRunRef.current += 1;
    sampleRunRef.current += 1;
    sampleProcessingRef.current = false;
    stopSamplePlayback();
    setRecording(null);
    setElapsedSeconds(0);
    setNotice("");
    setMicrophoneMessage("");
    setHasLoadedSample(false);
    setFlowState("ready");
  }, [stopSamplePlayback]);

  const keepShortRecording = useCallback(() => {
    if (!recording) {
      discardRecording();
      return;
    }

    void runMockProcessing();
  }, [discardRecording, recording, runMockProcessing]);

  useEffect(
    () => () => {
      mockRunRef.current += 1;
      microphoneRequestRef.current += 1;
      recordingSessionRef.current += 1;
      sampleRunRef.current += 1;
      sampleProcessingRef.current = false;
      stopSamplePlayback();
      clearRecordingResources(true);
    },
    [clearRecordingResources, stopSamplePlayback],
  );

  const passageIsDimmed = flowState === "processing";
  const levelClassName = `level-${context.passage.level}`;

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
          <p className="sample-audio-note">Demo playback — the result that follows is a fixed practice result.</p>
          <audio
            aria-label="Sample child recording"
            controls
            onError={() => {
              if (hasLoadedSample) {
                setNotice("The sample could not play here. The demo is still processing its mock result.");
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
            {notice ? <p className="gentle-notice">{notice}</p> : null}
          </section>
        ) : null}

        {flowState === "short-recording" ? (
          <section className="decision-card" aria-labelledby="short-recording-title">
            <p className="decision-kicker">Short recording · {formatDuration(recording?.durationSec ?? 0)}</p>
            <h2 id="short-recording-title">Keep or discard this recording?</h2>
            <p>It was recorded in under five seconds. Keep it if {firstName(context.student.name)} finished reading.</p>
            <div className="decision-actions">
              <button className="primary-action" onClick={keepShortRecording} type="button">
                Keep recording
              </button>
              <button className="secondary-action" onClick={discardRecording} type="button">
                Discard
              </button>
            </div>
            {notice ? <p className="gentle-notice">{notice}</p> : null}
          </section>
        ) : null}

        {flowState === "complete" ? (
          <section className="completion-card" aria-live="polite" role="status">
            <span className="completion-icon">
              <CheckIcon />
            </span>
            <div>
              <h2>Reading check complete</h2>
              <p>
                A {levelLabels[mockAnalysis.level].toLowerCase()}-level mock result is ready for teacher review.
              </p>
            </div>
            <div className="completion-actions">
              <Link
                className="primary-action completion-review"
                href={"/assess/" + context.student.id + "?mock=confirm"}
              >
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

        {flowState === "upload-error" ? (
          <AssessmentErrorCard
            actions={
              <button className="primary-action" onClick={() => void runMockProcessing()} type="button">
                Retry upload
              </button>
            }
            body={"Check the connection. The recording is saved \u2014 you won't need to record again."}
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
            body={"The reading was too fast to assess \u2014 please try again."}
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
              <button className="primary-action" onClick={() => void runMockProcessing()} type="button">
                Retry
              </button>
            }
            body="Something's stuck on our side. Try once more."
            title="This is taking too long"
          />
        ) : null}
      </section>
    </main>
  );
}
