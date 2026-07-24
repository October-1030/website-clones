"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  BookOpenCheck,
  Check,
  CircleHelp,
  Cloud,
  ChevronDown,
  Clipboard,
  Copy,
  FileText,
  Globe2,
  Image as ImageIcon,
  LibraryBig,
  LockKeyhole,
  MessageSquareText,
  MoreHorizontal,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Square,
  Settings2,
  ThumbsDown,
  ThumbsUp,
  Upload,
  UserRound,
  Video,
  X,
  Zap,
} from "lucide-react";
import HomeworkWorkspace from "@/components/HomeworkWorkspace";
import AccountSettingsDialog from "@/components/AccountSettingsDialog";
import CloudAccountDialog from "@/components/CloudAccountDialog";
import LmsConnectorDialog from "@/components/LmsConnectorDialog";
import LearningToolsWorkspace from "@/components/LearningToolsWorkspace";
import PortraitWorkspace from "@/components/PortraitWorkspace";
import LibraryPanel from "@/components/LibraryPanel";
import StudyFileWorkspace from "@/components/StudyFileWorkspace";
import TranscribeWorkspace from "@/components/TranscribeWorkspace";
import VideoSummaryWorkspace from "@/components/VideoSummaryWorkspace";
import WebSearchWorkspace from "@/components/WebSearchWorkspace";
import WritingToolsWorkspace from "@/components/WritingToolsWorkspace";
import { loadAccountSettings } from "@/lib/account/settings";
import { HOMEWORK_SESSION_STORAGE_KEY } from "@/lib/homework/types";
import { STUDY_SESSION_STORAGE_KEY } from "@/lib/study/types";
import { TRANSCRIBE_SESSION_STORAGE_KEY } from "@/lib/transcribe/types";
import { VIDEO_SESSION_STORAGE_KEY } from "@/lib/video/types";

type Mode = "default" | "homework";
type AppTab = "everywhere" | "library";
type GenerationStatus = "idle" | "thinking" | "working" | "done";
type Feedback = "like" | "dislike" | null;
type AnswerKind = "math" | "physics" | "generic";
type ToolKey = "homework" | "transcribe" | "file" | "video" | "quiz" | "study-guide" | "essay" | "detector" | "flashcard" | "headshot" | "web-search";

const toolDetails: Record<ToolKey, { label: string; description: string }> = {
  homework: { label: "Homework solver", description: "Work through a problem step by step." },
  transcribe: { label: "Live transcribe", description: "Choose a microphone or browser tab." },
  file: { label: "File summary", description: "Extract and summarize PDF or TXT study materials." },
  video: { label: "Video Link summary", description: "Paste a video or podcast URL." },
  quiz: { label: "Quiz", description: "Choose material, questions, and difficulty." },
  "study-guide": { label: "Study guide", description: "Turn your material into a focused review guide." },
  essay: { label: "Essay", description: "Plan and improve an essay without submitting it." },
  detector: { label: "AI detector", description: "Review writing signals with a separate character quota." },
  flashcard: { label: "Flashcard", description: "Build a review deck from material." },
  headshot: { label: "LinkedIn headshot", description: "Choose from three local style previews." },
  "web-search": { label: "Web search", description: "Search the web from the shared workspace." },
};

const suggestions = [
  "Complete the integration and simplify the exact result for the integral.",
  "Verify the result by differentiating the antiderivative.",
  "Explain why the substitution method works for this integral.",
];

const physicsSuggestions = [
  "Show me the detailed calculation of the acceleration and final speed with units.",
  "Explain how the work-energy theorem applies to this problem step by step.",
  "Compare the kinematic approach and work-energy theorem for this scenario.",
];

function getAnswerKind(question: string): AnswerKind {
  const normalized = question.toLowerCase();
  if (normalized.includes("physics") || normalized.includes("frictionless") || normalized.includes("work–energy")) return "physics";
  if (normalized.includes("integral") || normalized.includes("∫") || normalized.includes("substitution")) return "math";
  return "generic";
}

function RailButton({ label, active, children, onClick }: { label: string; active?: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" className={`rail-button${active ? " rail-button-active" : ""}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function Composer({
  input,
  setInput,
  mode,
  setMode,
  status,
  onSend,
  onToast,
  onSelectTool,
}: {
  input: string;
  setInput: (value: string) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  status: GenerationStatus;
  onSend: () => void;
  onToast: (message: string) => void;
  onSelectTool: (tool: ToolKey) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [deepThink, setDeepThink] = useState(false);
  const busy = status === "thinking" || status === "working";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return <form className="composer-card" onSubmit={submit}>
    <textarea
      value={input}
      onChange={(event) => setInput(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={mode === "homework" ? "Ask StudyPal anything about your homework" : "Ask about your lecture, homework, or readings..."}
      aria-label={mode === "homework" ? "Ask StudyPal anything about your homework" : "Ask about your lecture, homework, or readings..."}
      rows={2}
      disabled={busy}
    />
    <div className="composer-toolbar">
      <div className="composer-tools">
        <button type="button" className="composer-tool-button" title="Tools" onClick={() => setToolsOpen(!toolsOpen)}><span className="tool-sliders">☷</span><span>Tools</span><ChevronDown size={13} /></button>
        <button type="button" className={`composer-tool-button${deepThink ? " tool-selected" : ""}`} title="Deep think" onClick={() => setDeepThink(!deepThink)}><Zap size={14} /><span>Deep think</span></button>
        {mode === "homework" && <><span className="composer-divider" /><span className="mode-chip"><BookOpenCheck size={14} />Homework solver</span><button type="button" className="clear-mode" aria-label="Clear input mode" onClick={() => setMode("default")}><X size={14} /></button></>}
        {toolsOpen && <div className="tools-popover"><button type="button" onClick={() => { onSelectTool("file"); setToolsOpen(false); }}>File summary</button><button type="button" onClick={() => { onSelectTool("transcribe"); setToolsOpen(false); }}>Live transcribe</button><button type="button" onClick={() => { onSelectTool("video"); setToolsOpen(false); }}>Video Link summary</button></div>}
      </div>
      <div className="composer-actions">
        <button type="button" className="composer-icon-button" aria-label="Upload image" onClick={() => onToast("Image upload is disabled in this local clone")}><ImageIcon size={16} /></button>
        <button type="submit" className={`send-button${input.trim() && !busy ? " send-button-ready" : ""}`} aria-label="Send" disabled={!input.trim() || busy}>{busy ? <Square size={14} fill="currentColor" /> : <ArrowUp size={18} />}</button>
      </div>
    </div>
  </form>;
}

function ToolShortcuts({ onSelectTool }: { onSelectTool: (tool: ToolKey) => void }) {
  const [menu, setMenu] = useState<"tools" | "more" | null>(null);
  const primaryTools: ToolKey[] = ["transcribe", "file", "homework", "video"];
  const menuTools: ToolKey[] = ["quiz", "study-guide", "essay", "detector", "flashcard", "headshot", "web-search"];
  return <div className="tool-shortcut-row" aria-label="Study tools">
    {primaryTools.map((tool) => <button type="button" key={tool} className="tool-shortcut" onClick={() => onSelectTool(tool)}>{toolDetails[tool].label}</button>)}
    <div className="tool-menu-wrap"><button type="button" className={`tool-shortcut${menu === "tools" ? " tool-shortcut-active" : ""}`} onClick={() => setMenu(menu === "tools" ? null : "tools")}><Settings2 size={13} />Tools</button>{menu === "tools" && <div className="tool-menu"><span>Study tools</span>{menuTools.slice(0, 4).map((tool) => <button type="button" key={tool} onClick={() => { onSelectTool(tool); setMenu(null); }}>{toolDetails[tool].label}</button>)}</div>}</div>
    <div className="tool-menu-wrap"><button type="button" className={`tool-shortcut${menu === "more" ? " tool-shortcut-active" : ""}`} onClick={() => setMenu(menu === "more" ? null : "more")}><MoreHorizontal size={14} />More</button>{menu === "more" && <div className="tool-menu"><span>More tools</span>{menuTools.slice(4).map((tool) => <button type="button" key={tool} onClick={() => { onSelectTool(tool); setMenu(null); }}>{toolDetails[tool].label}</button>)}</div>}</div>
  </div>;
}

function HomePanel({ tab, setTab, onSelectTool, onLms }: { tab: AppTab; setTab: (tab: AppTab) => void; onSelectTool: (tool: ToolKey) => void; onLms: () => void }) {
  return <>
    <ToolShortcuts onSelectTool={onSelectTool} />
    <div className="home-tabs" role="tablist" aria-label="Home content">
      <button type="button" role="tab" aria-selected={tab === "everywhere"} className={tab === "everywhere" ? "home-tab-active" : ""} onClick={() => setTab("everywhere")}>Get StudyPal everywhere</button>
      <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "home-tab-active" : ""} onClick={() => setTab("library")}>Library</button>
    </div>
    {tab === "everywhere" ? <div className="everywhere-panel" role="tabpanel">
      <div className="everywhere-copy"><span className="everywhere-kicker">StudyPal Extension</span><h2>Keep your study flow in one place</h2><p>The browser extension is a planned companion. Connect Canvas now to synchronize course structure and materials into StudyPal.</p><button type="button" className="tool-shortcut" onClick={onLms}>Connect Canvas LMS</button></div>
      <div className="extension-preview"><div className="preview-sidebar"><span className="preview-brand">S</span><span /><span /><span /><span /></div><div className="preview-window"><div className="preview-bar"><i /><i /><i /></div><div className="preview-lines"><b>StudyPal AI</b><span>Summarize this page</span><span>Key ideas and useful context</span></div></div></div>
      <div className="carousel-dots"><i /><i /><i className="dot-active" /></div>
    </div> : <LibraryPanel />}
  </>;
}

function AccountMenu({
  username,
  usage,
  onToast,
  onClose,
  onOpen,
  onCloud,
  onLms,
}: {
  username: string;
  usage: number;
  onToast: (message: string) => void;
  onClose: () => void;
  onOpen: (kind: "account" | "personalization" | "help" | "updates") => void;
  onCloud: () => void;
  onLms: () => void;
}) {
  const initial = username.trim().charAt(0).toUpperCase() || "S";
  const actions: Array<{ label: string; kind?: "account" | "personalization" | "help" | "updates"; icon: ReactNode }> = [
    { label: "Credits Used", icon: <FileText size={14} /> },
    { label: "Reward", icon: <Sparkles size={14} /> },
    { label: "Update log", kind: "updates", icon: <FileText size={14} /> },
    { label: "Account settings", kind: "account", icon: <Settings2 size={14} /> },
    { label: "Personalization", kind: "personalization", icon: <UserRound size={14} /> },
    { label: "Help center", kind: "help", icon: <CircleHelp size={14} /> },
  ];
  return <div className="account-menu" role="dialog" aria-label="Account menu"><div className="account-summary"><div className="account-avatar">{initial}</div><div><strong>{username}</strong><span>Local plan</span></div><button type="button" aria-label="Close account menu" onClick={onClose}><X size={14} /></button></div><div className="account-quotas"><div><span>Usage</span><b>{usage}</b></div><div><span>File Page</span><b>Local</b></div><div><span>Recording</span><b>10 min</b></div><div><span>AI Detection</span><b>10k</b></div></div><button type="button" className="account-upgrade" onClick={() => onToast("Payments are intentionally disabled in this local build")}><LockKeyhole size={14} />Upgrade unavailable</button><div className="account-links">{actions.map((action) => <button type="button" key={action.label} onClick={() => { if (action.kind) { onOpen(action.kind); onClose(); } else { onToast(action.label === "Credits Used" ? "Local features do not consume paid credits" : "Rewards are not part of this local product"); } }}>{action.icon}{action.label}{action.kind && <ChevronDown size={13} className="account-link-chevron" />}</button>)}<button type="button" onClick={() => { onCloud(); onClose(); }}><Cloud size={14} />Cloud account & sync</button><button type="button" onClick={() => { onLms(); onClose(); }}><BookOpenCheck size={14} />LMS connections</button></div></div>;
}

function MathAnswer() {
  return <div className="answer-body">
    <h2>Evaluate</h2>
    <div className="math-display">∫<sub>0</sub><sup>1</sup> x · e<sup>x²</sup> dx</div>
    <h3>1. Substitution</h3>
    <p>Let <span className="inline-math">u = x²</span>.</p>
    <p>Then <span className="inline-math">du = 2x dx ⟹ x dx = ½ du</span>.</p>
    <p>Change the limits: when <span className="inline-math">x = 0</span>, <span className="inline-math">u = 0</span>; when <span className="inline-math">x = 1</span>, <span className="inline-math">u = 1</span>.</p>
    <div className="math-display compact">∫<sub>0</sub><sup>1</sup> x · e<sup>x²</sup> dx = ½∫<sub>0</sub><sup>1</sup> e<sup>u</sup> du</div>
    <h3>2. Evaluate and simplify</h3>
    <div className="math-display compact">½∫<sub>0</sub><sup>1</sup> e<sup>u</sup> du = ½[e<sup>u</sup>]<sub>0</sub><sup>1</sup> = <strong>(e − 1) / 2</strong></div>
    <h3>3. Verification</h3>
    <p>An antiderivative is <span className="inline-math">F(x) = ½e<sup>x²</sup></span>.</p>
    <p>Using the chain rule, <span className="inline-math">F′(x) = ½e<sup>x²</sup>(2x) = xe<sup>x²</sup></span>, which matches the integrand.</p>
    <div className="final-answer">∫<sub>0</sub><sup>1</sup> x · e<sup>x²</sup> dx = <strong>(e − 1) / 2</strong></div>
  </div>;
}

function PhysicsAnswer() {
  return <div className="answer-body">
    <h2>Given</h2>
    <ul className="given-list"><li><b>Mass:</b> <span className="inline-math">m = 2.0 kg</span></li><li><b>Applied force:</b> <span className="inline-math">F = 6.0 N</span></li><li><b>Displacement:</b> <span className="inline-math">d = 4.0 m</span></li><li><b>Initial speed:</b> <span className="inline-math">v₀ = 0 m/s</span></li><li>The surface is frictionless.</li></ul>
    <h3>1. Find the acceleration</h3>
    <p>Using Newton’s second law, <span className="inline-math">F = ma</span>.</p>
    <div className="math-display compact">a = F / m = (6.0 N) / (2.0 kg) = <strong>3.0 m/s²</strong></div>
    <h3>2. Find the final speed</h3>
    <p>Use the constant-acceleration equation:</p>
    <div className="math-display compact">v<sub>f</sub>² = v₀² + 2ad = 0 + 2(3.0)(4.0) = 24 m²/s²</div>
    <p>Taking the positive square root:</p>
    <div className="math-display compact">v<sub>f</sub> = √24 ≈ <strong>4.9 m/s</strong></div>
    <h3>3. Verify using the work–energy theorem</h3>
    <p>The work–energy theorem states <span className="inline-math">W<sub>net</sub> = ΔK</span>. Because the force is parallel to the displacement:</p>
    <div className="math-display compact">W<sub>net</sub> = Fd = (6.0 N)(4.0 m) = 24 J</div>
    <div className="math-display compact">24 J = ½(2.0 kg)v<sub>f</sub>² ⟹ v<sub>f</sub>² = 24 m²/s² ⟹ v<sub>f</sub> ≈ 4.9 m/s</div>
    <p>The work–energy result agrees with the kinematics result.</p>
    <h2 className="final-heading">Final answers</h2>
    <div className="final-answer"><strong>a = 3.0 m/s²</strong><br /><strong>v<sub>f</sub> ≈ 4.9 m/s</strong></div>
  </div>;
}

function GenericAnswer() {
  return <div className="answer-body"><h2>Let’s work through it</h2><p>I’ll break the problem into known values, a clear method, and a final check. Start by identifying the quantities given and the result the question asks for.</p><h3>1. Set up the method</h3><p>Write the governing definition or equation, substitute the known values, and keep units attached to every step.</p><h3>2. Check the result</h3><p>Substitute the result back into the original relationship. If the units and both sides agree, the solution is consistent.</p><div className="final-answer">The worked solution is ready for the next step.</div></div>;
}

function AnswerCard({ kind }: { kind: AnswerKind }) {
  return <article className="answer-card">{kind === "math" ? <MathAnswer /> : kind === "physics" ? <PhysicsAnswer /> : <GenericAnswer />}</article>;
}

export default function AskSiaWorkspace() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("default");
  const [tab, setTab] = useState<AppTab>("everywhere");
  const [activeRail, setActiveRail] = useState("home");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [usage, setUsage] = useState(7);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [visualMap, setVisualMap] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [cloudAccountOpen, setCloudAccountOpen] = useState(false);
  const [lmsOpen, setLmsOpen] = useState(false);
  const [homeworkDraft, setHomeworkDraft] = useState("");
  const [accountDialog, setAccountDialog] = useState<"account" | "personalization" | "help" | "updates" | null>(null);
  const [username, setUsername] = useState("Elv");

  const answerKind = useMemo(() => getAnswerKind(submitted ?? ""), [submitted]);
  const activeSuggestions = answerKind === "physics" ? physicsSuggestions : suggestions;

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2300);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      setUsername(loadAccountSettings(window.localStorage).username);
      const hasHomeworkSession = parameters.has("homeworkSession") || window.localStorage.getItem(HOMEWORK_SESSION_STORAGE_KEY);
      const hasStudySession = parameters.has("session") || window.localStorage.getItem(STUDY_SESSION_STORAGE_KEY);
      const hasVideoSession = parameters.has("videoSession") || window.localStorage.getItem(VIDEO_SESSION_STORAGE_KEY);
      const hasTranscribeSession = parameters.has("transcribeSession") || window.localStorage.getItem(TRANSCRIBE_SESSION_STORAGE_KEY);
      if (hasTranscribeSession) {
        setActiveTool("transcribe");
      } else if (hasVideoSession) {
        setActiveTool("video");
      } else if (hasHomeworkSession) {
        setActiveTool("homework");
        setMode("homework");
      } else if (hasStudySession) {
        setActiveTool("file");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function beginGeneration(question: string, consumeUsage = true) {
    setSubmitted(question);
    setInput("");
    setStatus("thinking");
    setFeedback(null);
    setVisualMap(false);
    setCopied(false);
    if (consumeUsage) setUsage((current) => Math.max(0, current - 1));
    window.setTimeout(() => setStatus("working"), 850);
    window.setTimeout(() => setStatus("done"), 1650);
  }

  function sendCurrent() {
    const question = input.trim();
    if (!question || status === "thinking" || status === "working") return;
    setHomeworkDraft(question);
    setInput("");
    setSubmitted(null);
    setStatus("idle");
    setMode("homework");
    setActiveTool("homework");
    setToast("Question moved to the real Homework Solver");
  }

  function selectTool(tool: ToolKey) {
    setActiveTool(tool);
    setSubmitted(null);
    setStatus("idle");
    setMode(tool === "homework" ? "homework" : "default");
    const messages: Partial<Record<ToolKey, string>> = {
      homework: "Homework Solver is ready",
      video: "Paste a public video or podcast link with captions",
      transcribe: "Choose an audio source when you are ready to grant permission",
      file: "Choose a PDF or TXT study material",
      quiz: "Quiz will use your latest saved study material",
      "study-guide": "Study guide will use your latest saved study material",
      flashcard: "Flashcards will use your latest saved study material",
      essay: "Plan and revise your own draft",
      detector: "Review measurable writing signals without a fake AI probability",
      headshot: "Prepare a portrait locally without uploading it",
      "web-search": "Search public Wikipedia sources with direct links",
    };
    setToast(messages[tool] || `${toolDetails[tool].label} is ready`);
  }

  function regenerate() {
    if (submitted) beginGeneration(submitted, false);
  }

  function copyAnswer() {
    setCopied(true);
    setToast("Answer copied to clipboard");
    if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText("StudyPal AI local answer");
  }

  return (
    <main className="workspace-page">
      <aside className="workspace-rail">
        <div className="rail-logo" aria-label="StudyPal AI">S</div>
        <nav className="rail-nav" aria-label="StudyPal AI navigation">
          <RailButton label="Home" active={activeRail === "home"} onClick={() => { setActiveRail("home"); setActiveTool(null); setSubmitted(null); setStatus("idle"); }}><PanelLeft size={17} /></RailButton>
          <RailButton label="New chat" onClick={() => { setActiveTool(null); setHomeworkDraft(""); setSubmitted(null); setInput(""); setStatus("idle"); }}><Plus size={18} /></RailButton>
          <RailButton label="Search" active={activeRail === "search"} onClick={() => { setActiveRail("search"); setActiveTool(null); setTab("library"); setSubmitted(null); setToast("Search your saved sessions in Library"); }}><Search size={17} /></RailButton>
          <RailButton label="Chats" active={activeRail === "chats"} onClick={() => { setActiveRail("chats"); setActiveTool(null); setTab("library"); setSubmitted(null); setToast("Saved study and homework sessions are available in Library"); }}><MessageSquareText size={17} /></RailButton>
          <RailButton label="Library" active={activeRail === "library"} onClick={() => { setActiveRail("library"); setActiveTool(null); setTab("library"); setSubmitted(null); }}><LibraryBig size={17} /></RailButton>
          <RailButton label="Study tools" active={activeRail === "tools"} onClick={() => { setActiveRail("tools"); setToast("Study tools are ready in the composer"); }}><Sparkles size={17} /></RailButton>
          <RailButton label="Explore" active={activeRail === "explore"} onClick={() => { setActiveRail("explore"); setActiveTool(null); setTab("library"); setSubmitted(null); setToast("Explore your saved work and learning tools"); }}><Globe2 size={17} /></RailButton>
        </nav>
        <button type="button" className="profile-avatar" aria-label="Profile" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>{username.trim().charAt(0).toUpperCase() || "S"}</button>
        {accountOpen && <AccountMenu username={username} usage={usage} onToast={setToast} onClose={() => setAccountOpen(false)} onOpen={setAccountDialog} onCloud={() => setCloudAccountOpen(true)} onLms={() => setLmsOpen(true)} />}
      </aside>

      <section className={`workspace-content${submitted ? " workspace-content-conversation" : ""}`}>
        {submitted ? (
          <div className="conversation-stage">
            <header className="conversation-header"><div className="material-actions"><button type="button" onClick={() => setToast("All files is a local preview")}><Clipboard size={15} />All files</button><button type="button" onClick={() => setToast("Upload is disabled in this local clone")}><Upload size={15} />Upload</button><button type="button" onClick={() => setToast("Recording is disabled in this local clone")}><Video size={15} />Recording</button></div><div className="conversation-actions"><button type="button" onClick={() => setToast("Notes are a local preview")}><FileText size={15} />Note</button><button type="button" onClick={() => setToast("Share is disabled in this local clone")}><Share2 size={15} />Share</button></div></header>
            <div className="conversation-body">
              <p className="question-block">{submitted}</p>
              {status !== "done" ? (
                <div className="generation-state"><div className="thinking-dots"><i /><i /><i /></div><strong>{status === "thinking" ? "Thinking..." : "Working..."}</strong><span>{status === "thinking" ? "Preparing your answer..." : "Solve Homework"}</span><button type="button" onClick={() => { setStatus("done"); setToast("Generation stopped"); }}>Stop</button></div>
              ) : (
                <>
                  <AnswerCard kind={answerKind} />
                  <div className="result-toolbar"><button type="button" className={visualMap ? "toolbar-active" : ""} onClick={() => setVisualMap(!visualMap)}><Sparkles size={15} />Visual map</button><button type="button" aria-label="Regenerate" onClick={regenerate}><RefreshCw size={15} /></button><button type="button" aria-label="Copy answer" onClick={copyAnswer}>{copied ? <Check size={15} /> : <Copy size={15} />}</button><button type="button" aria-label="Add note" onClick={() => setToast("Note saved in local preview")}><Plus size={16} /></button><button type="button" aria-label="Like" className={feedback === "like" ? "toolbar-active" : ""} onClick={() => setFeedback("like")}><ThumbsUp size={15} /></button><button type="button" aria-label="Dislike" className={feedback === "dislike" ? "toolbar-active" : ""} onClick={() => setFeedback("dislike")}><ThumbsDown size={15} /></button></div>
                  {visualMap && <div className="visual-map"><span>Visual map</span><div><b>Question</b><i>→</i><b>Known values</b><i>→</i><b>Method</b><i>→</i><b>Verified result</b></div></div>}
                  {feedback && <div className="feedback-prompt">Was this explanation helpful? <span>{feedback === "like" ? "Thanks for the feedback." : "Thanks — we’ll improve it."}</span></div>}
                  <div className="suggestions"><div className="suggestions-heading"><span>You might be interested</span><button type="button" aria-label="Hide suggested questions" onClick={() => setToast("Suggested questions hidden")}>×</button></div>{activeSuggestions.map((suggestion, index) => <button type="button" key={suggestion} onClick={() => setInput(suggestion)}><span>{index + 1}</span>{suggestion}</button>)}</div>
                </>
              )}
            </div>
            <Composer input={input} setInput={setInput} mode="homework" setMode={setMode} status={status} onSend={sendCurrent} onToast={setToast} onSelectTool={selectTool} />
          </div>
        ) : (
          <div className="home-stage">
            {activeTool !== "homework" && <>
              <div className="welcome-panel"><div className="welcome-orb"><Sparkles size={23} /></div><h1>Hi {username}, what are we studying today?</h1></div>
              {bannerVisible && <div className="usage-banner"><span>You have <strong>{usage}</strong> usage left. Upgrade to enjoy seamless study journey.</span><button type="button" className="upgrade-button" onClick={() => setToast("Upgrade is disabled in this local clone")}>Upgrade</button><button type="button" className="banner-close" aria-label="Close usage banner" onClick={() => setBannerVisible(false)}><X size={17} /></button></div>}
              <Composer input={input} setInput={setInput} mode={mode} setMode={setMode} status={status} onSend={sendCurrent} onToast={setToast} onSelectTool={selectTool} />
            </>}
            {activeTool === "essay" || activeTool === "detector" ? <WritingToolsWorkspace tool={activeTool} onToast={setToast} /> : activeTool === "quiz" || activeTool === "study-guide" || activeTool === "flashcard" ? <LearningToolsWorkspace tool={activeTool} onToast={setToast} onOpenFileSummary={() => selectTool("file")} /> : activeTool === "headshot" ? <PortraitWorkspace onToast={setToast} /> : activeTool === "web-search" ? <WebSearchWorkspace onToast={setToast} /> : activeTool === "transcribe" ? <TranscribeWorkspace onToast={setToast} /> : activeTool === "file" ? <StudyFileWorkspace onToast={setToast} /> : activeTool === "homework" ? <HomeworkWorkspace key={homeworkDraft} initialProblem={homeworkDraft} onToast={setToast} /> : activeTool === "video" ? <VideoSummaryWorkspace onToast={setToast} /> : <>
              <HomePanel tab={tab} setTab={setTab} onSelectTool={selectTool} onLms={() => setLmsOpen(true)} />
              <div className="onboarding-card"><div className="onboarding-orb"><Sparkles size={20} /></div><div><strong>Get started with StudyPal AI</strong><span>0/2</span><div className="progress-track"><i /></div></div></div>
            </>}
          </div>
        )}
      </section>
      {cloudAccountOpen && <CloudAccountDialog onClose={() => setCloudAccountOpen(false)} onChanged={setToast} />}
      {lmsOpen && <LmsConnectorDialog onClose={() => setLmsOpen(false)} onChanged={setToast} />}
      {accountDialog && <AccountSettingsDialog kind={accountDialog} onClose={() => setAccountDialog(null)} onSaved={(settings) => { setUsername(settings.username); setToast("Local settings saved"); }} />}
      {toast && <div className="workspace-toast" role="status">{toast}</div>}
    </main>
  );
}
