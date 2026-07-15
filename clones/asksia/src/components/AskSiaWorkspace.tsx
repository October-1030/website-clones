"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  BookOpenCheck,
  Check,
  CircleHelp,
  ChevronDown,
  Clipboard,
  Copy,
  FileText,
  Folder,
  GraduationCap,
  Globe2,
  Image as ImageIcon,
  LibraryBig,
  LockKeyhole,
  Mic,
  MessageSquareText,
  MoreHorizontal,
  MonitorUp,
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

type Mode = "default" | "homework";
type AppTab = "everywhere" | "library";
type GenerationStatus = "idle" | "thinking" | "working" | "done";
type Feedback = "like" | "dislike" | null;
type AnswerKind = "math" | "physics" | "generic";
type ToolKey = "homework" | "transcribe" | "file" | "video" | "quiz" | "study-guide" | "essay" | "detector" | "flashcard" | "headshot" | "web-search";

const toolDetails: Record<ToolKey, { label: string; description: string }> = {
  homework: { label: "Homework solver", description: "Work through a problem step by step." },
  transcribe: { label: "Live transcribe", description: "Choose a microphone or browser tab." },
  file: { label: "File summary", description: "Summarize PDF, Word, PowerPoint, audio, or video." },
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
}: {
  input: string;
  setInput: (value: string) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  status: GenerationStatus;
  onSend: () => void;
  onToast: (message: string) => void;
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
      placeholder={mode === "homework" ? "Ask Sia anything about your homework" : "Ask about your lecture, homework, or readings..."}
      aria-label={mode === "homework" ? "Ask Sia anything about your homework" : "Ask about your lecture, homework, or readings..."}
      rows={2}
      disabled={busy}
    />
    <div className="composer-toolbar">
      <div className="composer-tools">
        <button type="button" className="composer-tool-button" title="Tools" onClick={() => setToolsOpen(!toolsOpen)}><span className="tool-sliders">☷</span><span>Tools</span><ChevronDown size={13} /></button>
        <button type="button" className={`composer-tool-button${deepThink ? " tool-selected" : ""}`} title="Deep think" onClick={() => setDeepThink(!deepThink)}><Zap size={14} /><span>Deep think</span></button>
        {mode === "homework" && <><span className="composer-divider" /><span className="mode-chip"><BookOpenCheck size={14} />Homework solver</span><button type="button" className="clear-mode" aria-label="Clear input mode" onClick={() => setMode("default")}><X size={14} /></button></>}
        {toolsOpen && <div className="tools-popover"><button type="button" onClick={() => onToast("File summary is ready for local demo")}>File summary</button><button type="button" onClick={() => onToast("Live transcribe is a local preview")}>Live transcribe</button><button type="button" onClick={() => onToast("Video Link summary is a local preview")}>Video Link summary</button></div>}
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

function ToolEmptyState({ tool, onToast }: { tool: ToolKey; onToast: (message: string) => void }) {
  const detail = toolDetails[tool];
  const primaryLabel = tool === "transcribe" ? "Choose audio source" : tool === "file" ? "Upload material" : tool === "video" ? "Paste a URL" : tool === "headshot" ? "Preview styles" : "Choose material";
  return <div className="tool-empty-card"><div className="tool-empty-icon"><Sparkles size={20} /></div><div><span className="everywhere-kicker">Local preview</span><h2>{detail.label}</h2><p>{detail.description}</p>{tool === "detector" && <span className="quota-note">AI Detection · 0/10000 Chars</span>}{tool === "headshot" && <div className="style-pills"><button type="button" onClick={() => onToast("Classic school portrait selected")}>Classic school portrait</button><button type="button" onClick={() => onToast("Leadership portrait selected")}>Leadership portrait</button><button type="button" onClick={() => onToast("Black and white portrait selected")}>Black and white portrait</button></div>}<button type="button" className="empty-primary" onClick={() => onToast(`${detail.label}: local prototype does not execute real upload, URL processing, or generation`)}>{primaryLabel}</button></div></div>;
}

function HomePanel({ tab, setTab, onToast, onSelectTool }: { tab: AppTab; setTab: (tab: AppTab) => void; onToast: (message: string) => void; onSelectTool: (tool: ToolKey) => void }) {
  const [selectedSchool, setSelectedSchool] = useState("All schools");
  const schools = ["All schools", "Adelaide University", "University of Sydney", "McGill University"];
  return <>
    <ToolShortcuts onSelectTool={onSelectTool} />
    <div className="home-tabs" role="tablist" aria-label="Home content">
      <button type="button" role="tab" aria-selected={tab === "everywhere"} className={tab === "everywhere" ? "home-tab-active" : ""} onClick={() => setTab("everywhere")}>Get Sia everywhere</button>
      <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "home-tab-active" : ""} onClick={() => setTab("library")}>Library</button>
    </div>
    {tab === "everywhere" ? <div className="everywhere-panel" role="tabpanel">
      <div className="everywhere-copy"><span className="everywhere-kicker">AskSia Extension</span><h2>The Extension that keeps you in flow</h2><p>Summarize articles, get instant answers, and stay in flow — right in your browser.</p></div>
      <div className="extension-preview"><div className="preview-sidebar"><span className="preview-brand">A</span><span /><span /><span /><span /></div><div className="preview-window"><div className="preview-bar"><i /><i /><i /></div><div className="preview-lines"><b>AskSia</b><span>Summarize this page</span><span>Key ideas and useful context</span></div></div></div>
      <div className="carousel-dots"><i /><i /><i className="dot-active" /></div>
    </div> : <div className="library-panel" role="tabpanel"><div className="library-panel-heading"><div><span className="everywhere-kicker">Your library</span><h2>Everything you are learning</h2></div><div className="library-actions"><select aria-label="School filter" value={selectedSchool} onChange={(event) => setSelectedSchool(event.target.value)}>{schools.map((school) => <option key={school}>{school}</option>)}</select><button type="button" onClick={() => onToast("Library search is a local preview")}><Search size={15} /> Search</button></div></div><div className="library-grid"><article><GraduationCap size={18} /><b>Calculus II</b><span>{selectedSchool} · 28 documents</span></article><article><Folder size={18} /><b>Behavioral Economics</b><span>{selectedSchool} · 17 documents</span></article><article><FileText size={18} /><b>Lecture notes</b><span>12 recordings · 30 flashcards</span></article></div><button type="button" className="view-more" onClick={() => onToast("Course support is a local preview")}>View more</button></div>}
  </>;
}

function AccountMenu({ usage, onToast, onClose }: { usage: number; onToast: (message: string) => void; onClose: () => void }) {
  const actions = ["Credits Used", "Reward", "Update log", "Account settings", "Personalization", "Help center"];
  return <div className="account-menu" role="dialog" aria-label="Account menu"><div className="account-summary"><div className="account-avatar">E</div><div><strong>Elv</strong><span>Free</span></div><button type="button" aria-label="Close account menu" onClick={onClose}><X size={14} /></button></div><div className="account-quotas"><div><span>Usage</span><b>{usage}</b></div><div><span>File Page</span><b>0/100</b></div><div><span>Recording</span><b>0/10 min</b></div><div><span>AI Detection</span><b>0/10000</b></div></div><button type="button" className="account-upgrade" onClick={() => onToast("Upgrade is disabled in this local clone")}><Zap size={14} />Upgrade</button><div className="account-links">{actions.map((action) => <button type="button" key={action} onClick={() => onToast(`${action} is a local preview`)}>{action === "Account settings" ? <Settings2 size={14} /> : action === "Personalization" ? <UserRound size={14} /> : action === "Help center" ? <CircleHelp size={14} /> : <FileText size={14} />}{action}<ChevronDown size={13} className="account-link-chevron" /></button>)}<button type="button" onClick={() => onToast("Sign out is disabled in this local clone")}><LockKeyhole size={14} />Sign out</button></div></div>;
}

function TranscribeDialog({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  return <div className="dialog-backdrop" role="presentation"><div className="transcribe-dialog" role="dialog" aria-modal="true" aria-labelledby="transcribe-title"><button type="button" className="dialog-close" aria-label="Close audio source dialog" onClick={onClose}><X size={16} /></button><div className="dialog-icon"><Mic size={20} /></div><h2 id="transcribe-title">Choose your audio source</h2><p>Pick a source for the local preview. No microphone or browser permission is requested.</p><div className="audio-source-grid"><button type="button" onClick={() => onToast("Microphone permission is intentionally not requested")}><Mic size={19} /><strong>Microphone</strong><span>Record a lecture</span></button><button type="button" onClick={() => onToast("Browser Tab permission is intentionally not requested")}><MonitorUp size={19} /><strong>Browser Tab</strong><span>Capture a tab preview</span></button></div><button type="button" className="dialog-cancel" onClick={onClose}>Cancel</button></div></div>;
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
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const answerKind = useMemo(() => getAnswerKind(submitted ?? ""), [submitted]);
  const activeSuggestions = answerKind === "physics" ? physicsSuggestions : suggestions;

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2300);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
    beginGeneration(question);
  }

  function selectTool(tool: ToolKey) {
    setActiveTool(tool);
    setSubmitted(null);
    setStatus("idle");
    if (tool === "homework") {
      setMode("homework");
      setToast("Homework solver mode selected");
    } else if (tool === "transcribe") {
      setTranscribeOpen(true);
      setToast("Choose your audio source");
    } else {
      setMode("default");
      setToast(`${toolDetails[tool].label} is a local preview`);
    }
  }

  function regenerate() {
    if (submitted) beginGeneration(submitted, false);
  }

  function copyAnswer() {
    setCopied(true);
    setToast("Answer copied to clipboard");
    if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText("AskSia local answer");
  }

  return (
    <main className="workspace-page">
      <aside className="workspace-rail">
        <div className="rail-logo" aria-label="AskSia">A</div>
        <nav className="rail-nav" aria-label="AskSia navigation">
          <RailButton label="Home" active={activeRail === "home"} onClick={() => { setActiveRail("home"); setActiveTool(null); setSubmitted(null); setStatus("idle"); }}><PanelLeft size={17} /></RailButton>
          <RailButton label="New chat" onClick={() => { setActiveTool(null); setSubmitted(null); setInput(""); setStatus("idle"); }}><Plus size={18} /></RailButton>
          <RailButton label="Search" active={activeRail === "search"} onClick={() => { setActiveRail("search"); setToast("Search is a local preview"); }}><Search size={17} /></RailButton>
          <RailButton label="Chats" active={activeRail === "chats"} onClick={() => { setActiveRail("chats"); setToast("Chat history is a local preview"); }}><MessageSquareText size={17} /></RailButton>
          <RailButton label="Library" active={activeRail === "library"} onClick={() => { setActiveRail("library"); setActiveTool(null); setTab("library"); setSubmitted(null); }}><LibraryBig size={17} /></RailButton>
          <RailButton label="Study tools" active={activeRail === "tools"} onClick={() => { setActiveRail("tools"); setToast("Study tools are ready in the composer"); }}><Sparkles size={17} /></RailButton>
          <RailButton label="Explore" active={activeRail === "explore"} onClick={() => { setActiveRail("explore"); setToast("Explore is a local preview"); }}><Globe2 size={17} /></RailButton>
        </nav>
        <button type="button" className="profile-avatar" aria-label="Profile" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>E</button>
        {accountOpen && <AccountMenu usage={usage} onToast={setToast} onClose={() => setAccountOpen(false)} />}
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
            <Composer input={input} setInput={setInput} mode="homework" setMode={setMode} status={status} onSend={sendCurrent} onToast={setToast} />
          </div>
        ) : (
          <div className="home-stage">
            <div className="welcome-panel"><div className="welcome-orb"><Sparkles size={23} /></div><h1>Hi Elv, what are we studying today?</h1></div>
            {bannerVisible && <div className="usage-banner"><span>You have <strong>{usage}</strong> usage left. Upgrade to enjoy seamless study journey.</span><button type="button" className="upgrade-button" onClick={() => setToast("Upgrade is disabled in this local clone")}>Upgrade</button><button type="button" className="banner-close" aria-label="Close usage banner" onClick={() => setBannerVisible(false)}><X size={17} /></button></div>}
            <Composer input={input} setInput={setInput} mode={mode} setMode={setMode} status={status} onSend={sendCurrent} onToast={setToast} />
            {activeTool && activeTool !== "homework" && <ToolEmptyState tool={activeTool} onToast={setToast} />}
            <HomePanel tab={tab} setTab={setTab} onToast={setToast} onSelectTool={selectTool} />
            <div className="onboarding-card"><div className="onboarding-orb"><Sparkles size={20} /></div><div><strong>Get started with AskSia</strong><span>0/2</span><div className="progress-track"><i /></div></div></div>
          </div>
        )}
      </section>
      {transcribeOpen && <TranscribeDialog onClose={() => setTranscribeOpen(false)} onToast={(message) => { setToast(message); setTranscribeOpen(false); }} />}
      {toast && <div className="workspace-toast" role="status">{toast}</div>}
    </main>
  );
}
