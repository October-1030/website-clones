"use client";

import { notifyUsageChanged } from "@/lib/usage/client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Clock3,
  LoaderCircle,
  Mic,
  MonitorUp,
  Radio,
  Square,
  Trash2,
  Waves,
} from "lucide-react";
import {
  clearTranscribeSession,
  loadTranscribeSession,
  saveTranscribeSession,
} from "@/lib/transcribe/storage";
import {
  MAX_TRANSCRIBE_DURATION_SECONDS,
  type TranscribeSession,
  type TranscribeSourceKind,
} from "@/lib/transcribe/types";

type Phase = "idle" | "requesting" | "recording" | "processing";
type RestoreSource = "local" | "server" | null;

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => RecognitionLike;

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return fallback;
}

function setSessionInUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("transcribeSession", id);
    url.searchParams.delete("videoSession");
    url.searchParams.delete("homeworkSession");
    url.searchParams.delete("session");
  } else {
    url.searchParams.delete("transcribeSession");
  }
  window.history.replaceState(null, "", url);
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function recorderMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export default function TranscribeWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const durationRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const limitRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sourceRef = useRef<TranscribeSourceKind | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sourceKind, setSourceKind] = useState<TranscribeSourceKind | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [liveCaptionAvailable, setLiveCaptionAvailable] = useState(false);
  const [session, setSession] = useState<TranscribeSession | null>(null);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = loadTranscribeSession(window.localStorage);
    if (stored) {
      // Browser storage is an external system restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(stored);
      setSourceKind(stored.source.kind);
      setRestoreSource("local");
    }
    const urlId = new URLSearchParams(window.location.search).get("transcribeSession");
    const sessionId = urlId || stored?.id;
    if (sessionId) {
      void fetch(`/api/transcribe/session/${encodeURIComponent(sessionId)}`)
        .then(async (response) => response.ok ? (await response.json() as { session?: TranscribeSession }).session ?? null : null)
        .then((serverSession) => {
          if (!active || !serverSession) return;
          setSession(serverSession);
          setSourceKind(serverSession.source.kind);
          setRestoreSource("server");
          saveTranscribeSession(window.localStorage, serverSession);
          setSessionInUrl(serverSession.id);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      if (recorderRef.current) recorderRef.current.onstop = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      sourceStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (limitRef.current) window.clearTimeout(limitRef.current);
    };
  }, []);

  function stopClocks() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (limitRef.current) window.clearTimeout(limitRef.current);
    tickRef.current = null;
    limitRef.current = null;
  }

  function stopStreams() {
    sourceStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    sourceStreamRef.current = null;
    recordingStreamRef.current = null;
  }

  async function submitRecording(blob: Blob, kind: TranscribeSourceKind, durationSeconds: number) {
    setPhase("processing");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const extension = blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `studypal-${kind}-${Date.now()}.${extension}`, { type: blob.type || "audio/webm" });
    const body = new FormData();
    body.append("audio", file);
    body.append("sourceKind", kind);
    body.append("durationHint", String(durationSeconds));
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body, signal: controller.signal });
      const payload = await response.json() as { session?: TranscribeSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, "Transcription failed. Please retry."));
      setSession(payload.session);
      setRestoreSource(null);
      setCopied(false);
      setInterimText("");
      saveTranscribeSession(window.localStorage, payload.session);
      setSessionInUrl(payload.session.id);
      notifyUsageChanged();
      onToast("Final transcript saved. Temporary-file cleanup was requested.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setError("Transcription was cancelled. Temporary-file cleanup was requested.");
      else setError(caught instanceof Error ? caught.message : "Transcription failed. Please retry.");
    } finally {
      abortRef.current = null;
      setPhase("idle");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "recording") return;
    stopClocks();
    durationRef.current = Math.min((Date.now() - startedAtRef.current) / 1000, MAX_TRANSCRIBE_DURATION_SECONDS);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    else stopStreams();
  }

  async function startRecording(kind: TranscribeSourceKind) {
    if (phase !== "idle") return;
    setError(null);
    setInterimText("");
    setLiveCaptionAvailable(false);
    setSourceKind(kind);
    sourceRef.current = kind;
    setPhase("requesting");
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support audio recording.");
      }
      const sourceStream = kind === "microphone"
        ? await navigator.mediaDevices.getUserMedia({ audio: true })
        : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (sourceStream.getAudioTracks().length === 0) {
        sourceStream.getTracks().forEach((track) => track.stop());
        throw new Error(kind === "browser-tab" ? "No tab audio was shared. Choose a tab and enable Share tab audio." : "No microphone audio track is available.");
      }
      sourceStreamRef.current = sourceStream;
      const audioOnly = new MediaStream(sourceStream.getAudioTracks());
      recordingStreamRef.current = audioOnly;
      const mimeType = recorderMimeType();
      const recorder = mimeType ? new MediaRecorder(audioOnly, { mimeType }) : new MediaRecorder(audioOnly);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The browser recorder stopped unexpectedly.");
        stopClocks();
        stopStreams();
        setPhase("idle");
      };
      recorder.onstop = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        const recordedKind = sourceRef.current || kind;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        stopStreams();
        recorderRef.current = null;
        if (blob.size === 0) {
          setError("The recording is empty. Check the selected audio source and retry.");
          setPhase("idle");
          return;
        }
        void submitRecording(blob, recordedKind, durationRef.current);
      };

      if (kind === "microphone") {
        const recognitionWindow = window as Window & {
          SpeechRecognition?: RecognitionConstructor;
          webkitSpeechRecognition?: RecognitionConstructor;
        };
        const Recognition = recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;
        if (Recognition) {
          const recognition = new Recognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = navigator.language || "en-US";
          recognition.onresult = (event) => {
            let text = "";
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              text += `${event.results[index][0].transcript} `;
            }
            setInterimText(text.trim());
          };
          recognition.onerror = () => setLiveCaptionAvailable(false);
          recognition.start();
          recognitionRef.current = recognition;
          setLiveCaptionAvailable(true);
        }
      }

      sourceStream.getTracks().forEach((track) => {
        track.onended = () => stopRecording();
      });
      recorder.start(1000);
      startedAtRef.current = Date.now();
      durationRef.current = 0;
      setElapsed(0);
      setPhase("recording");
      tickRef.current = window.setInterval(() => setElapsed(Math.min((Date.now() - startedAtRef.current) / 1000, MAX_TRANSCRIBE_DURATION_SECONDS)), 250);
      limitRef.current = window.setTimeout(stopRecording, MAX_TRANSCRIBE_DURATION_SECONDS * 1000);
    } catch (caught) {
      stopClocks();
      stopStreams();
      setPhase("idle");
      if (caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "PermissionDeniedError")) {
        setError("Audio permission was not granted. Nothing was recorded.");
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to start audio capture.");
      }
    }
  }

  async function clearSession() {
    const id = session?.id;
    clearTranscribeSession(window.localStorage);
    setSessionInUrl(null);
    setSession(null);
    setRestoreSource(null);
    setInterimText("");
    setCopied(false);
    if (id) await fetch(`/api/transcribe/session/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    onToast("Transcription session cleared.");
  }

  async function copyTranscript() {
    if (!session) return;
    await navigator.clipboard?.writeText(session.text);
    setCopied(true);
    onToast("Transcript copied.");
  }

  return <section className="study-file-workspace transcribe-workspace" aria-label="Live transcription workspace">
    <header className="study-file-header">
      <div>
        <span className="everywhere-kicker">P5 Live Transcribe</span>
        <h2>Capture audio, then keep an accurate final transcript</h2>
        <p>Temporary browser captions may be processed by your browser or operating-system speech service. The saved final transcript comes from the StudyPal Faster-Whisper server after recording stops.</p>
      </div>
      <span className="demo-mode-badge">Faster-Whisper speech engine</span>
    </header>

    <div className="transcribe-privacy"><Check size={15} /><span><strong>Processing disclosure:</strong> audio is uploaded to the StudyPal server and written to temporary storage for Faster-Whisper transcription. The server attempts to remove the temporary file immediately after processing; saved sessions contain transcript text, not the audio recording.</span></div>

    <div className="audio-source-grid transcribe-source-grid">
      <button type="button" className={sourceKind === "microphone" ? "audio-source-active" : ""} onClick={() => void startRecording("microphone")} disabled={phase !== "idle"}>
        <Mic size={20} /><strong>Microphone</strong><span>Temporary live captions + final transcript</span>
      </button>
      <button type="button" className={sourceKind === "browser-tab" ? "audio-source-active" : ""} onClick={() => void startRecording("browser-tab")} disabled={phase !== "idle"}>
        <MonitorUp size={20} /><strong>Browser Tab</strong><span>Final transcript after you stop sharing</span>
      </button>
    </div>

    {phase === "requesting" && <div className="transcribe-status"><LoaderCircle size={17} className="spin" /><div><strong>Waiting for permission</strong><span>Select the audio source in your browser prompt.</span></div></div>}
    {phase === "recording" && <div className="recording-panel">
      <div className="recording-heading"><span><Radio size={16} />Recording</span><strong>{formatTime(elapsed)} / 10:00</strong></div>
      <div className="audio-level" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
      {sourceKind === "microphone" && <div className="interim-caption">
        <span><Waves size={14} />Temporary live captions</span>
        <p>{liveCaptionAvailable ? interimText || "Listening…" : "Live captions are unavailable in this browser. Recording is still active."}</p>
        <small>These captions are not saved and may change. Faster-Whisper produces the final transcript after Stop.</small>
      </div>}
      {sourceKind === "browser-tab" && <div className="interim-caption"><span><MonitorUp size={14} />Browser-tab capture</span><p>Capturing the shared tab audio…</p><small>The final transcript appears after Stop; this mode does not claim real-time captions.</small></div>}
      <button type="button" className="stop-recording-button" onClick={stopRecording}><Square size={14} fill="currentColor" />Stop and transcribe</button>
    </div>}

    {phase === "processing" && <div className="transcribe-status"><LoaderCircle size={18} className="spin" /><div><strong>Creating the final transcript</strong><span>Faster-Whisper is processing the recording. You can cancel; the server will stop processing and attempt to remove the temporary file.</span></div><button type="button" onClick={() => abortRef.current?.abort()}>Cancel</button></div>}

    {error && <div className="study-error" role="alert"><AlertCircle size={18} /><div><strong>Transcription could not continue</strong><span>{error}</span></div></div>}

    {session && <div className="transcribe-result">
      <div className="study-session-meta">
        <div className="study-file-icon"><Waves size={20} /></div>
        <div><strong>{session.source.kind === "microphone" ? "Microphone recording" : "Browser-tab recording"}</strong><span>{formatTime(session.source.durationSeconds)} · {session.language || "language auto-detected"} · {session.provider.label}</span></div>
        <div className="study-session-actions">
          {restoreSource && <span className="restored-badge"><Check size={13} />{restoreSource === "server" ? "Restored from local service" : "Restored from browser"}</span>}
          <button type="button" onClick={() => void copyTranscript()}><Clipboard size={14} />{copied ? "Copied" : "Copy"}</button>
          <button type="button" onClick={() => void clearSession()}><Trash2 size={14} />Clear</button>
        </div>
      </div>
      <div className="study-result-note"><Check size={15} /><span><strong>Final transcript</strong> · Generated locally from {session.segments.length} timestamped speech segments. Audio is no longer stored.</span></div>
      <article className="transcript-document"><h3>Full transcript</h3><p>{session.text}</p></article>
      <div className="transcript-segments">{session.segments.map((segment, index) => <article key={`${segment.startSeconds}-${index}`}><span><Clock3 size={12} />{formatTime(segment.startSeconds)}–{formatTime(segment.endSeconds)}</span><p>{segment.text}</p></article>)}</div>
    </div>}
  </section>;
}
