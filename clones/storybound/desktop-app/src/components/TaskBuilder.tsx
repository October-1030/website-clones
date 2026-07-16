import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contentTracks, pipelineSteps, visualStyles } from "../data/app-data";
import { minimaxVoices, volcengineVoices } from "../data/tts-data";
import { runLlmPipelineStep } from "../lib/llm-api";
import { synthesizeTts } from "../lib/tts-api";
import type {
  ExecutionMode,
  PausePreset,
  PipelineStatus,
  TaskDraft,
  VideoForm,
} from "../types/app";
import type { LlmConfig, LlmCredentialStatus, LlmPipelineStep, PipelineLlmArtifacts } from "../types/llm";
import type { TtsConfig, TtsCredentialStatus, TtsProvider } from "../types/tts";
import "./TaskBuilder.css";

type TaskBuilderProps = {
  config: TtsConfig;
  credentialStatus: TtsCredentialStatus;
  llmConfig: LlmConfig;
  llmCredentialStatus: LlmCredentialStatus;
  onLlmConfigChange: (config: LlmConfig) => void;
  onTtsConfigChange: (config: TtsConfig) => void;
  onOpenPipeline: (taskDraft: TaskDraft) => void;
  onNavigateSettings: () => void;
};

type SourceMode = "paste" | "ai";
type PipelineRunState =
  | "idle"
  | "running"
  | "paused"
  | "cancelled"
  | "completed";

const modeOptions: Array<{
  value: ExecutionMode;
  title: string;
  description: string;
}> = [
  { value: "auto", title: "全自动", description: "AI 改写 + 智能分句" },
  { value: "semi_auto", title: "半自动", description: "不改写，AI 智能分句" },
  { value: "direct", title: "直接出片", description: "不改写，按空行机械切" },
];

const pauseOptions: Array<{
  value: PausePreset;
  title: string;
  description: string;
}> = [
  { value: "none", title: "不暂停", description: "一口气执行到底" },
  { value: "key", title: "关键节点", description: "在 1、3、4 步后确认" },
  { value: "every", title: "每步暂停", description: "逐步检查结果" },
  { value: "custom", title: "自定义", description: "选择需要确认的步骤" },
];

const videoFormOptions: Array<{
  value: VideoForm;
  title: string;
  description: string;
}> = [
  { value: "narration", title: "旁白视频", description: "单人解说 · 常规故事视频" },
  { value: "podcast", title: "播客视频", description: "双人对谈 · 支持 A/B 主播" },
];

const visualModes = ["按分镜配图", "单图封面"] as const;
const hostPairs = ["咪仔 × 大壹", "刘飞 × 潇磊"];
const speedOptions = ["0.9×", "1.0×", "1.1×", "1.2×"];
const llmStepMap: Partial<Record<number, LlmPipelineStep>> = {
  0: "precheck",
  1: "rewrite",
  2: "storyboard",
  3: "prompts",
};

const statusLabels: Record<PipelineStatus, string> = {
  pending: "等待中",
  running: "执行中",
  paused: "待确认",
  done: "已完成",
  skipped: "已跳过",
  failed: "失败",
};

function createTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `storybound-${Date.now().toString(36)}`;
}

function persistTask(taskDraft: TaskDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  let savedTasks: TaskDraft[] = [];

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem("storybound_clone_tasks") ?? "[]",
    );
    if (Array.isArray(parsed)) {
      savedTasks = parsed as TaskDraft[];
    }
  } catch {
    savedTasks = [];
  }

  const nextTasks = [taskDraft, ...savedTasks.filter((task) => task.id !== taskDraft.id)];
  window.localStorage.setItem("storybound_clone_tasks", JSON.stringify(nextTasks));
}

function initialStepStatuses(mode: ExecutionMode, startStep: number): PipelineStatus[] {
  return pipelineSteps.map((step) => {
    if (mode !== "auto" && step.id < 2) {
      return "skipped";
    }
    if (step.id < startStep) {
      return "done";
    }
    if (step.id === startStep) {
      return "running";
    }
    return "pending";
  });
}

export function TaskBuilder({ config, credentialStatus, llmConfig, llmCredentialStatus, onLlmConfigChange: _onLlmConfigChange, onTtsConfigChange, onOpenPipeline, onNavigateSettings }: TaskBuilderProps) {
  const taskIdRef = useRef(createTaskId());
  const ttsControllerRef = useRef<AbortController | null>(null);
  const llmControllerRef = useRef<AbortController | null>(null);
  const pipelineAudioUrlRef = useRef("");
  const pipelineArtifactsRef = useRef<PipelineLlmArtifacts>({});
  const [title, setTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste");
  const [mode, setMode] = useState<ExecutionMode>("auto");
  const [pausePreset, setPausePreset] = useState<PausePreset>("key");
  const [videoForm, setVideoForm] = useState<VideoForm>("narration");
  const [track, setTrack] = useState(contentTracks[0] ?? "通用故事");
  const [visualStyle, setVisualStyle] = useState(visualStyles[3] ?? visualStyles[0] ?? "现代电影");
  const [visualMode, setVisualMode] = useState<(typeof visualModes)[number]>(visualModes[0]);
  const [hostPair, setHostPair] = useState(hostPairs[0] ?? "");
  const [speed, setSpeed] = useState(speedOptions[1] ?? "1.0×");
  const [customPauseSteps, setCustomPauseSteps] = useState<number[]>([3, 4]);
  const [saved, setSaved] = useState(false);
  const [runState, setRunState] = useState<PipelineRunState>("idle");
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepStatuses, setStepStatuses] = useState<PipelineStatus[]>(
    pipelineSteps.map(() => "pending"),
  );
  const [activeTask, setActiveTask] = useState<TaskDraft | null>(null);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineArtifacts, setPipelineArtifacts] = useState<PipelineLlmArtifacts>({});
  const [pipelineScript, setPipelineScript] = useState("");
  const [pipelineAudio, setPipelineAudio] = useState<{
    url: string;
    fileName: string;
    segments: number;
    bytes: number;
  } | null>(null);

  const characterCount = inputText.trim().length;
  const canStart = characterCount >= 50;
  const activeMode = activeTask?.mode ?? mode;
  const ttsProvider = config.provider;
  const availableVoices = useMemo(
    () => ttsProvider === "minimax"
      ? [...minimaxVoices, ...config.minimax.clonedVoices]
      : volcengineVoices.filter((item) => item.version === config.volcengine.version),
    [config.minimax.clonedVoices, config.volcengine.version, ttsProvider],
  );
  const selectedVoiceId = ttsProvider === "minimax" ? config.minimax.voiceId : config.volcengine.voiceId;
  const selectedVoice = availableVoices.find((item) => item.id === selectedVoiceId) ?? availableVoices[0];
  const hasTtsCredentials = ttsProvider === "minimax"
    ? Boolean(config.minimax.apiKey.trim() || credentialStatus.minimax.available)
    : Boolean(
        (config.volcengine.appId.trim() && config.volcengine.accessToken.trim())
        || credentialStatus.volcengine.available,
      );
  const hasLlmCredentials = Boolean(llmConfig.apiKey.trim() || llmCredentialStatus.available);
  const finishedCount = stepStatuses.filter(
    (status) => status === "done" || status === "skipped",
  ).length;

  const pauseStepSet = useMemo(() => new Set(customPauseSteps), [customPauseSteps]);

  useEffect(() => () => {
    llmControllerRef.current?.abort();
    ttsControllerRef.current?.abort();
    if (pipelineAudioUrlRef.current) URL.revokeObjectURL(pipelineAudioUrlRef.current);
  }, []);

  useEffect(() => {
    pipelineArtifactsRef.current = pipelineArtifacts;
  }, [pipelineArtifacts]);

  const finishCurrentStep = useCallback((): void => {
    const isLastStep = currentStep === pipelineSteps.length - 1;
    const shouldPause =
      !isLastStep &&
      (pausePreset === "every" ||
        (pausePreset === "key" && [1, 3, 4].includes(currentStep)) ||
        (pausePreset === "custom" && pauseStepSet.has(currentStep)));

    if (isLastStep) {
      setStepStatuses((statuses) =>
        statuses.map((status, index) => (index === currentStep ? "done" : status)),
      );
      setRunState("completed");
      setActiveTask((task) =>
        task ? { ...task, status: "completed", currentStep } : task,
      );
      return;
    }

    const nextStep = currentStep + 1;
    setStepStatuses((statuses) =>
      statuses.map((status, index) => {
        if (index === currentStep) {
          return "done";
        }
        if (index === nextStep) {
          return shouldPause ? "paused" : "running";
        }
        return status;
      }),
    );
    setCurrentStep(nextStep);
    setActiveTask((task) =>
      task
        ? {
            ...task,
            status: shouldPause ? "paused" : "running",
            currentStep: nextStep,
          }
        : task,
    );

    if (shouldPause) {
      setRunState("paused");
    }
  }, [currentStep, pausePreset, pauseStepSet]);

  useEffect(() => {
    if (activeTask) {
      persistTask(activeTask);
    }
  }, [activeTask]);

  useEffect(() => {
    if (runState !== "running" || currentStep < 0 || currentStep === 5 || (llmStepMap[currentStep] && hasLlmCredentials)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const isLastStep = currentStep === pipelineSteps.length - 1;
      const shouldPause =
        !isLastStep &&
        (pausePreset === "every" ||
          (pausePreset === "key" && [1, 3, 4].includes(currentStep)) ||
          (pausePreset === "custom" && pauseStepSet.has(currentStep)));

      if (isLastStep) {
        setStepStatuses((statuses) =>
          statuses.map((status, index) => (index === currentStep ? "done" : status)),
        );
        setRunState("completed");
        setActiveTask((task) =>
          task ? { ...task, status: "completed", currentStep } : task,
        );
        return;
      }

      const nextStep = currentStep + 1;
      setStepStatuses((statuses) =>
        statuses.map((status, index) => {
          if (index === currentStep) {
            return "done";
          }
          if (index === nextStep) {
            return shouldPause ? "paused" : "running";
          }
          return status;
        }),
      );
      setCurrentStep(nextStep);
      setActiveTask((task) =>
        task
          ? {
              ...task,
              status: shouldPause ? "paused" : "running",
              currentStep: nextStep,
            }
          : task,
      );

      if (shouldPause) {
        setRunState("paused");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [currentStep, hasLlmCredentials, pausePreset, pauseStepSet, runState]);

  useEffect(() => {
    const llmStep = llmStepMap[currentStep];
    if (runState !== "running" || !llmStep) return;

    if (!hasLlmCredentials) {
      return;
    }

    const controller = new AbortController();
    llmControllerRef.current = controller;
    setPipelineError("");

    void runLlmPipelineStep({
      step: llmStep,
      config: llmConfig,
      context: {
        title: activeTask?.title ?? title,
        inputText,
        track,
        videoForm,
        visualStyle,
      },
      artifacts: pipelineArtifactsRef.current,
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      setPipelineArtifacts((current) => ({ ...current, [result.step]: result.data }));
      if (result.step === "precheck") {
        setPipelineScript(result.data.cleanText);
      }
      if (result.step === "rewrite") {
        setPipelineScript(result.data.narration);
        if (!title.trim()) setTitle(result.data.title);
      }
      if (result.step === "storyboard") {
        setPipelineScript(result.data.shots.map((shot) => shot.text).join("\n"));
      }
      finishCurrentStep();
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setPipelineError(error instanceof Error ? error.message : "LLM 处理失败");
      setStepStatuses((statuses) => statuses.map((status, index) => (index === currentStep ? "failed" : status)));
      setRunState("paused");
      setActiveTask((task) => (task ? { ...task, status: "paused", currentStep } : task));
    }).finally(() => {
      if (llmControllerRef.current === controller) llmControllerRef.current = null;
    });

    return () => controller.abort();
  }, [activeTask?.title, currentStep, finishCurrentStep, hasLlmCredentials, inputText, llmConfig, runState, title, track, videoForm, visualStyle]);

  useEffect(() => {
    if (runState !== "running" || currentStep !== 5) return;

    if (!selectedVoice || !hasTtsCredentials) {
      setPipelineError(!selectedVoice ? "没有可用音色" : "当前 TTS 引擎缺少凭据，请先前往系统设置");
      setStepStatuses((statuses) => statuses.map((status, index) => (index === 5 ? "failed" : status)));
      setRunState("paused");
      setActiveTask((task) => (task ? { ...task, status: "paused", currentStep: 5 } : task));
      return;
    }

    const controller = new AbortController();
    ttsControllerRef.current = controller;
    setPipelineError("");
    const speedValue = Number(speed.replace("×", "")) || 1;
    const ttsText = pipelineScript.trim() || inputText;

    void synthesizeTts({
      provider: ttsProvider,
      text: ttsText,
      voiceId: selectedVoice.id,
      speed: speedValue,
      config,
      signal: controller.signal,
    }).then((audio) => {
      if (controller.signal.aborted) return;
      if (pipelineAudioUrlRef.current) URL.revokeObjectURL(pipelineAudioUrlRef.current);
      const url = URL.createObjectURL(audio.blob);
      pipelineAudioUrlRef.current = url;
      setPipelineAudio({
        url,
        fileName: `${activeTask?.title ?? "Storybound任务"}-配音.mp3`,
        segments: audio.segments,
        bytes: audio.blob.size,
      });
      setStepStatuses((statuses) => statuses.map((status, index) => {
        if (index === 5) return "done";
        if (index === 6) return "running";
        return status;
      }));
      setCurrentStep(6);
      setActiveTask((task) => (task ? { ...task, status: "running", currentStep: 6 } : task));
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setPipelineError(error instanceof Error ? error.message : "TTS 配音失败");
      setStepStatuses((statuses) => statuses.map((status, index) => (index === 5 ? "failed" : status)));
      setRunState("paused");
      setActiveTask((task) => (task ? { ...task, status: "paused", currentStep: 5 } : task));
    }).finally(() => {
      if (ttsControllerRef.current === controller) ttsControllerRef.current = null;
    });

    return () => controller.abort();
  }, [activeTask?.title, config, currentStep, hasTtsCredentials, inputText, pipelineScript, runState, selectedVoice, speed, ttsProvider]);

  function buildTaskDraft(status: TaskDraft["status"]): TaskDraft {
    const compactText = inputText.trim();
    const fallbackTitle = compactText
      ? `${compactText.slice(0, 18)}${compactText.length > 18 ? "…" : ""}`
      : "未命名视频";

    return {
      id: taskIdRef.current,
      title: title.trim() || fallbackTitle,
      inputText: compactText,
      mode,
      videoForm,
      track,
      status,
      currentStep: mode === "auto" ? 0 : 2,
      createdAt: Date.now(),
    };
  }

  function handleSaveDraft(): void {
    const draft = buildTaskDraft("draft");
    persistTask(draft);
    setSaved(true);
  }

  function handleStart(): void {
    if (!canStart) {
      return;
    }

    const taskDraft = buildTaskDraft("running");
    const startStep = taskDraft.currentStep;
    persistTask(taskDraft);
    setSaved(false);
    setPipelineError("");
    setPipelineArtifacts({});
    pipelineArtifactsRef.current = {};
    setPipelineScript(inputText.trim());
    if (pipelineAudioUrlRef.current) URL.revokeObjectURL(pipelineAudioUrlRef.current);
    pipelineAudioUrlRef.current = "";
    setPipelineAudio(null);
    setActiveTask(taskDraft);
    setCurrentStep(startStep);
    setStepStatuses(initialStepStatuses(taskDraft.mode, startStep));
    setRunState("running");
    onOpenPipeline(taskDraft);
  }

  function handlePause(): void {
    setRunState("paused");
    setStepStatuses((statuses) =>
      statuses.map((status, index) =>
        index === currentStep && status === "running" ? "paused" : status,
      ),
    );
    setActiveTask((task) => (task ? { ...task, status: "paused" } : task));
  }

  function handleContinue(): void {
    setStepStatuses((statuses) =>
      statuses.map((status, index) =>
        index === currentStep && (status === "paused" || status === "failed") ? "running" : status,
      ),
    );
    setActiveTask((task) => (task ? { ...task, status: "running" } : task));
    setRunState("running");
  }

  function handleCancel(): void {
    llmControllerRef.current?.abort();
    ttsControllerRef.current?.abort();
    setRunState("cancelled");
    setStepStatuses((statuses) =>
      statuses.map((status, index) =>
        index === currentStep && (status === "running" || status === "paused")
          ? "failed"
          : status,
      ),
    );
    setActiveTask((task) => (task ? { ...task, status: "failed" } : task));
  }

  function runFromStep(stepId: number): void {
    llmControllerRef.current?.abort();
    ttsControllerRef.current?.abort();
    setPipelineError("");
    if (stepId <= 0) {
      setPipelineArtifacts({});
      pipelineArtifactsRef.current = {};
    }
    if (stepId <= 1) setPipelineScript(inputText.trim());
    if (stepId <= 5) {
      if (pipelineAudioUrlRef.current) URL.revokeObjectURL(pipelineAudioUrlRef.current);
      pipelineAudioUrlRef.current = "";
      setPipelineAudio(null);
    }
    setCurrentStep(stepId);
    setStepStatuses(initialStepStatuses(activeMode, stepId));
    setRunState("running");
    setActiveTask((task) =>
      task ? { ...task, status: "running", currentStep: stepId } : task,
    );
  }

  function toggleCustomPause(stepId: number): void {
    setCustomPauseSteps((steps) =>
      steps.includes(stepId)
        ? steps.filter((id) => id !== stepId)
        : [...steps, stepId].sort((left, right) => left - right),
    );
  }

  function chooseTtsProvider(provider: TtsProvider): void {
    onTtsConfigChange({ ...config, provider });
  }

  function chooseTtsVoice(voiceId: string): void {
    if (ttsProvider === "minimax") {
      onTtsConfigChange({ ...config, minimax: { ...config.minimax, voiceId } });
    } else {
      onTtsConfigChange({ ...config, volcengine: { ...config.volcengine, voiceId } });
    }
  }

  function downloadPipelineAudio(): void {
    if (!pipelineAudio) return;
    const anchor = document.createElement("a");
    anchor.href = pipelineAudio.url;
    anchor.download = pipelineAudio.fileName;
    anchor.click();
  }

  return (
    <main className="task-builder">
      <div className="task-builder__content">
        <header className="task-builder__header">
          <span className="task-builder__header-icon" aria-hidden="true">
            ✧
          </span>
          <div>
            <h1>创建视频任务</h1>
            <p>粘贴一段人物故事，几分钟后在剪映里打开</p>
          </div>
        </header>

        <aside className={`credential-warning${hasTtsCredentials && hasLlmCredentials ? " credential-warning--ready" : hasTtsCredentials || hasLlmCredentials ? " credential-warning--partial" : ""}`} aria-label="凭证配置提醒">
          <span className="credential-warning__icon" aria-hidden="true">
            △
          </span>
          <div className="credential-warning__copy">
            <strong>{hasTtsCredentials && hasLlmCredentials ? "LLM 与 TTS 均已就绪" : hasTtsCredentials || hasLlmCredentials ? "还有 1 项凭证未配置" : "还有 2 项凭证未配置"}</strong>
            <span>
              {hasTtsCredentials && hasLlmCredentials
                ? `${llmCredentialStatus.model ?? llmConfig.model} 生成文案链路 · ${ttsProvider === "minimax" ? "MiniMax" : "火山引擎"} 配音`
                : hasTtsCredentials
                  ? `${ttsProvider === "minimax" ? "MiniMax" : "火山引擎"}可直接配音 · 仍需 LLM API Key`
                  : hasLlmCredentials
                    ? `${llmCredentialStatus.model ?? llmConfig.model} 可生成文案链路 · 仍需 TTS 凭证`
                    : "LLM API Key、TTS 凭证"}
            </span>
          </div>
          <button type="button" onClick={onNavigateSettings}>
            前往设置 <span aria-hidden="true">→</span>
          </button>
        </aside>

        <section className="builder-card copy-card">
          <div className="builder-card__heading">
            <span className="builder-card__icon" aria-hidden="true">
              ▤
            </span>
            <div>
              <h2>文案</h2>
              <p>处理模式 · 改写 · 分镜数</p>
            </div>
          </div>

          <label className="field-label" htmlFor="task-title">
            <span>标题</span>
            <small>可选</small>
          </label>
          <input
            id="task-title"
            className="text-input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
            placeholder="留空会从文案自动提取"
          />

          <div className="source-switch" aria-label="文案来源">
            <button
              type="button"
              className={sourceMode === "paste" ? "is-selected" : ""}
              aria-pressed={sourceMode === "paste"}
              onClick={() => setSourceMode("paste")}
            >
              <strong>粘贴文案</strong>
              <span>已有对标文案，直接贴进来改写</span>
            </button>
            <button
              type="button"
              className={sourceMode === "ai" ? "is-selected" : ""}
              aria-pressed={sourceMode === "ai"}
              onClick={() => setSourceMode("ai")}
            >
              <strong>
                AI 创作 <em>NEW</em>
              </strong>
              <span>输入关键词，AI 自动搜资料并创作原稿</span>
            </button>
          </div>

          <label className="field-label" htmlFor="task-copy">
            <span>{sourceMode === "paste" ? "文案内容" : "创作要求"}</span>
            <small className={canStart ? "is-ready" : ""}>{characterCount} / 至少 50 字</small>
          </label>
          <textarea
            id="task-copy"
            className="copy-textarea"
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              setSaved(false);
            }}
            placeholder={
              sourceMode === "paste"
                ? "粘贴一段人物故事原始文案，AI 会自动改写为口播版、拆分分镜、配图配音。"
                : "描述主题、人物和希望呈现的故事方向，至少输入 50 字。"
            }
          />

          <div className="field-group">
            <span className="field-label field-label--standalone">视频形式</span>
            <div className="choice-grid choice-grid--two">
              {videoFormOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice-card ${videoForm === option.value ? "is-selected" : ""}`}
                  aria-pressed={videoForm === option.value}
                  onClick={() => setVideoForm(option.value)}
                >
                  <span className="choice-card__radio" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <span className="field-label field-label--standalone">内容赛道</span>
            <div className="chip-list">
              {contentTracks.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={track === item ? "chip is-selected" : "chip"}
                  aria-pressed={track === item}
                  onClick={() => setTrack(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="builder-card">
          <div className="builder-card__heading">
            <span className="builder-card__icon" aria-hidden="true">
              ⚙
            </span>
            <div>
              <h2>高级选项</h2>
              <p>控制自动化程度与人工确认节点</p>
            </div>
          </div>

          <div className="field-group">
            <span className="field-label field-label--standalone">执行模式</span>
            <div className="choice-grid choice-grid--three">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice-card choice-card--compact ${mode === option.value ? "is-selected" : ""}`}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  <span className="choice-card__radio" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <span className="field-label field-label--standalone">暂停策略</span>
            <div className="choice-grid choice-grid--four">
              {pauseOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice-card choice-card--compact ${pausePreset === option.value ? "is-selected" : ""}`}
                  aria-pressed={pausePreset === option.value}
                  onClick={() => setPausePreset(option.value)}
                >
                  <span className="choice-card__radio" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {pausePreset === "custom" && (
            <div className="custom-pause-panel">
              <span>完成以下步骤后暂停</span>
              <div className="custom-pause-grid">
                {pipelineSteps.slice(0, -1).map((step) => (
                  <label key={step.id}>
                    <input
                      type="checkbox"
                      checked={customPauseSteps.includes(step.id)}
                      onChange={() => toggleCustomPause(step.id)}
                    />
                    <span>{step.id + 1}. {step.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="builder-card">
          <div className="builder-card__heading">
            <span className="builder-card__icon" aria-hidden="true">
              ◇
            </span>
            <div>
              <h2>出图</h2>
              <p>选择画面风格与配图方式</p>
            </div>
          </div>

          <div className="field-group">
            <span className="field-label field-label--standalone">视觉风格</span>
            <div className="chip-list">
              {visualStyles.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={visualStyle === item ? "chip is-selected" : "chip"}
                  aria-pressed={visualStyle === item}
                  onClick={() => setVisualStyle(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {videoForm === "podcast" && (
            <div className="field-group">
              <span className="field-label field-label--standalone">播客画面</span>
              <div className="segmented-control">
                {visualModes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={visualMode === item ? "is-selected" : ""}
                    aria-pressed={visualMode === item}
                    onClick={() => setVisualMode(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="builder-card">
          <div className="builder-card__heading">
            <span className="builder-card__icon" aria-hidden="true">
              ♫
            </span>
            <div>
              <h2>配音</h2>
              <p>{videoForm === "podcast" ? "配置双主播组合" : "配置旁白音色与语速"}</p>
            </div>
          </div>

          {videoForm === "podcast" ? (
            <>
              <div className="field-group">
                <span className="field-label field-label--standalone">主播组合</span>
                <div className="choice-grid choice-grid--two">
                  {hostPairs.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`choice-card host-choice ${hostPair === item ? "is-selected" : ""}`}
                      aria-pressed={hostPair === item}
                      onClick={() => setHostPair(item)}
                    >
                      <span className="host-choice__avatars" aria-hidden="true">
                        <b>A</b><b>B</b>
                      </span>
                      <strong>{item}</strong>
                    </button>
                  ))}
                </div>
              </div>

              {(mode === "semi_auto" || mode === "direct") && (
                <div className="speaker-hint">
                  <span className="speaker-tag">[A]</span>
                  <span className="speaker-tag">[B]</span>
                  <p>请在文案段落前添加说话人标签，未标记内容默认由主播 A 朗读。</p>
                </div>
              )}
            </>
          ) : (
            <div className="audio-settings-stack">
              <div className="audio-provider-row">
                <span className="field-label field-label--standalone">TTS 引擎</span>
                <div className="segmented-control">
                  <button type="button" className={ttsProvider === "minimax" ? "is-selected" : ""} onClick={() => chooseTtsProvider("minimax")}>MiniMax</button>
                  <button type="button" className={ttsProvider === "volcengine" ? "is-selected" : ""} onClick={() => chooseTtsProvider("volcengine")}>豆包</button>
                </div>
                <span className={hasTtsCredentials ? "audio-credential is-ready" : "audio-credential"}>{hasTtsCredentials ? `✓ 已就绪${ttsProvider === "minimax" && credentialStatus.minimax.source ? ` · ${credentialStatus.minimax.source}` : ""}` : "未配置"}</span>
              </div>
              <div className="audio-settings-grid">
              <label>
                <span className="field-label field-label--standalone">音色</span>
                <select value={selectedVoice?.id ?? ""} onChange={(event) => chooseTtsVoice(event.target.value)}>
                  {availableVoices.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.tag}</option>
                  ))}
                </select>
              </label>
              <div>
                <span className="field-label field-label--standalone">语速</span>
                <div className="segmented-control">
                  {speedOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={speed === item ? "is-selected" : ""}
                      aria-pressed={speed === item}
                      onClick={() => setSpeed(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              </div>
              {!hasTtsCredentials ? <button type="button" className="audio-settings-link" onClick={onNavigateSettings}>前往系统设置配置 TTS →</button> : null}
            </div>
          )}
        </section>

        {runState !== "idle" && (
          <section className="pipeline-panel" aria-live="polite">
            <div className="pipeline-panel__header">
              <div>
                <span className={`pipeline-state pipeline-state--${runState}`}>
                  {runState === "running" && "流水线执行中"}
                  {runState === "paused" && (pipelineError ? "处理失败，等待处理" : "已暂停，等待确认")}
                  {runState === "cancelled" && "任务已取消"}
                  {runState === "completed" && "全部完成"}
                </span>
                <h2>{activeTask?.title ?? "当前视频任务"}</h2>
                <p>
                  {finishedCount} / {pipelineSteps.length} 步已处理
                  {activeMode === "semi_auto" && " · 半自动模式"}
                  {activeMode === "direct" && " · 直接出片模式"}
                </p>
              </div>
              <div className="pipeline-actions">
                {runState === "running" && (
                  <button type="button" className="secondary-button" onClick={handlePause}>
                    暂停
                  </button>
                )}
                {runState === "paused" && (
                  <button type="button" className="primary-button" onClick={handleContinue}>
                    继续执行
                  </button>
                )}
                {(runState === "running" || runState === "paused") && (
                  <button type="button" className="danger-button" onClick={handleCancel}>
                    取消
                  </button>
                )}
                {(runState === "cancelled" || runState === "completed") && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => runFromStep(activeMode === "auto" ? 0 : 2)}
                  >
                    重新开始
                  </button>
                )}
              </div>
            </div>

            {pipelineError ? <div className="pipeline-error"><span>步骤失败：{pipelineError}</span><div><button type="button" onClick={onNavigateSettings}>检查设置</button><button type="button" onClick={handleContinue}>重试本步骤</button></div></div> : null}

            <progress value={finishedCount} max={pipelineSteps.length}>
              {finishedCount} / {pipelineSteps.length}
            </progress>

            <ol className="pipeline-steps">
              {pipelineSteps.map((step, index) => {
                const status = stepStatuses[index] ?? "pending";
                const isMechanical = activeMode === "direct" && step.id === 2;

                return (
                  <li key={step.id} className={`pipeline-step pipeline-step--${status}`}>
                    <span className="pipeline-step__number" aria-hidden="true">
                      {status === "done" ? "✓" : status === "skipped" ? "–" : step.id + 1}
                    </span>
                    <div className="pipeline-step__copy">
                      <div>
                        <strong>{step.title}</strong>
                        {isMechanical && <em>机械切分</em>}
                      </div>
                      <span>
                        {isMechanical ? "按标点拆分，不调用 AI" : step.description}
                      </span>
                    </div>
                    <span className="pipeline-step__status">{statusLabels[status]}</span>
                    {status === "done" && (
                      <button type="button" onClick={() => runFromStep(step.id)}>
                        从此重跑
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            {(pipelineArtifacts.precheck || pipelineArtifacts.rewrite || pipelineArtifacts.storyboard || pipelineArtifacts.prompts) ? (
              <div className="pipeline-artifacts">
                <strong>真实 LLM 产物</strong>
                <div>
                  {pipelineArtifacts.precheck ? <span>预审：{pipelineArtifacts.precheck.warnings.length} 条提醒</span> : null}
                  {pipelineArtifacts.rewrite ? <span>改写：{pipelineArtifacts.rewrite.title}</span> : null}
                  {pipelineArtifacts.storyboard ? <span>分镜：{pipelineArtifacts.storyboard.shots.length} 镜</span> : null}
                  {pipelineArtifacts.prompts ? <span>绘图 prompt：{pipelineArtifacts.prompts.prompts.length} 条</span> : null}
                </div>
              </div>
            ) : !hasLlmCredentials ? (
              <div className="pipeline-artifacts pipeline-artifacts--muted"><strong>LLM 未配置</strong><div><span>前 4 步以模拟方式通过；配置 LLM 后会生成真实改写、分镜和绘图 prompt。</span></div></div>
            ) : null}
            {pipelineAudio ? <div className="pipeline-audio"><div><strong>真实 TTS 音频已生成</strong><span>{selectedVoice?.name ?? "当前音色"} · {pipelineAudio.segments} 段 · {(pipelineAudio.bytes / 1024).toFixed(1)} KB</span></div><audio controls src={pipelineAudio.url} /><button type="button" onClick={downloadPipelineAudio}>下载 MP3</button></div> : null}
          </section>
        )}
      </div>

      <footer className="task-builder__footer">
        <div className="task-builder__footer-inner">
          <div className="footer-status">
            <span className={canStart ? "is-ready" : ""}>
              {canStart ? "文案长度已满足" : `还需 ${Math.max(0, 50 - characterCount)} 字`}
            </span>
            {saved && <strong>草稿已保存</strong>}
          </div>
          <div className="footer-actions">
            <button type="button" className="secondary-button" onClick={handleSaveDraft}>
              保存草稿
            </button>
            <button
              type="button"
              className="start-button"
              disabled={!canStart}
              onClick={handleStart}
            >
              <span aria-hidden="true">▶</span>
              开始制作
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
