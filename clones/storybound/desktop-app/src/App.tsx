import { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";
import { AppShell } from "./components/AppShell";
import { BenchmarkPage, type BenchmarkAiPayload, type BenchmarkTaskPayload } from "./components/BenchmarkPage";
import { BookSelectionPage, type CommerceTaskPayload } from "./components/BookSelectionPage";
import { CreatePage } from "./components/CreatePage";
import { DraftTemplatesPage } from "./components/DraftTemplatesPage";
import { HtmlVideoPage } from "./components/HtmlVideoPage";
import { LocalAccountPage } from "./components/LocalAccountPage";
import { MarketPage } from "./components/MarketPage";
import { MusicMvPage } from "./components/MusicMvPage";
import { PersonAssetsPage } from "./components/PersonAssetsPage";
import { PlaygroundPage } from "./components/PlaygroundPage";
import { PromptTemplatesPage } from "./components/PromptTemplatesPage";
import { SupportPage } from "./components/SupportPage";
import { TaskBuilder } from "./components/TaskBuilder";
import { TtsSettingsPage } from "./components/TtsSettingsPage";
import { VoiceLabPage } from "./components/VoiceLabPage";
import { defaultLlmConfig } from "./data/llm-data";
import { defaultTtsConfig } from "./data/tts-data";
import { transcribeBenchmarkVideo, transcribeMedia } from "./lib/asr-api";
import { fetchLlmStatus } from "./lib/llm-api";
import { runLlmPipelineStep } from "./lib/llm-api";
import { saveTaskHandoff } from "./lib/task-handoff";
import { fetchTtsStatus } from "./lib/tts-api";
import type { AppPage } from "./types/app";
import type { LlmConfig, LlmCredentialStatus, PipelineContext } from "./types/llm";
import type { TtsConfig, TtsCredentialStatus } from "./types/tts";

const emptyCredentialStatus: TtsCredentialStatus = {
  minimax: { available: false, source: null },
  volcengine: { available: false, source: null },
};

const emptyLlmCredentialStatus: LlmCredentialStatus = {
  available: false,
  source: null,
  provider: null,
  baseUrl: null,
  model: null,
};

const appPages: AppPage[] = ["create", "image-task", "html-video", "music-mv", "queue", "history", "playground", "voice-lab", "person-assets", "prompt-templates", "draft-templates", "book-selection", "benchmark", "market", "settings", "account", "activation"];

function readRoute(): { page: AppPage; taskId: string | null } {
  const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] === "task" && segments[1]) return { page: "image-task", taskId: segments[1] };
  const pathPages: Record<string, AppPage> = {
    create: "create",
    home: "image-task",
    "html-video": "html-video",
    "music-mv": "music-mv",
    queue: "queue",
    history: "history",
    playground: "playground",
    "voice-lab": "voice-lab",
    "person-assets": "person-assets",
    "prompt-templates": "prompt-templates",
    templates: "draft-templates",
    "book-selection": "book-selection",
    benchmark: "benchmark",
    market: "market",
    settings: "settings",
    account: "account",
    activation: "activation",
    "batch-summary": "queue",
  };
  if (segments[0] && pathPages[segments[0]]) return { page: pathPages[segments[0]], taskId: null };
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("task");
  const pageValue = params.get("page");
  const page = appPages.includes(pageValue as AppPage) ? pageValue as AppPage : taskId ? "image-task" : "create";
  return { page, taskId: page === "image-task" ? taskId : null };
}

function writeRoute(page: AppPage, taskId: string | null): void {
  const pagePaths: Record<AppPage, string> = {
    create: "/create",
    "image-task": taskId ? `/task/${encodeURIComponent(taskId)}` : "/home",
    "html-video": "/html-video",
    "music-mv": "/music-mv",
    queue: "/queue",
    history: "/history",
    playground: "/playground",
    "voice-lab": "/voice-lab",
    "person-assets": "/person-assets",
    "prompt-templates": "/prompt-templates",
    "draft-templates": "/templates",
    "book-selection": "/book-selection",
    benchmark: "/benchmark",
    market: "/market",
    settings: "/settings",
    account: "/account",
    activation: "/activation",
  };
  window.history.replaceState(null, "", pagePaths[page]);
}

function pushRoute(page: AppPage, taskId: string | null): void {
  const previousUrl = window.location.href;
  writeRoute(page, taskId);
  const nextUrl = window.location.href;
  window.history.replaceState(null, "", previousUrl);
  window.history.pushState(null, "", nextUrl);
}

function readQueue(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("storybound-active-queue") || "[]");
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function benchmarkContext(title: string, inputText: string): PipelineContext {
  return {
    title,
    inputText,
    track: "人物故事",
    videoForm: "narration",
    visualStyle: "现代电影",
    aspectRatio: "9:16",
    sourceMode: "paste",
    rewriteIntensity: "standard",
    narrativePov: "original",
    targetLength: null,
    targetScenes: null,
    fixedIntro: "",
    outroCta: "",
    ttsMode: "original-segmented",
  };
}

function App() {
  const initialRoute = useRef(readRoute());
  const [currentPage, setCurrentPage] = useState<AppPage>(initialRoute.current.page);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(initialRoute.current.taskId);
  const [activeQueue, setActiveQueue] = useState<string[]>(readQueue);
  const activeQueueRef = useRef(activeQueue);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(defaultTtsConfig);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultLlmConfig);
  const [credentialStatus, setCredentialStatus] = useState<TtsCredentialStatus>(emptyCredentialStatus);
  const [llmCredentialStatus, setLlmCredentialStatus] = useState<LlmCredentialStatus>(emptyLlmCredentialStatus);
  const [benchmarkSearch, setBenchmarkSearch] = useState("");
  const providerWasAutoSelected = useRef(false);
  const llmProviderWasAutoSelected = useRef(false);
  const handleOpenPipeline = useCallback(() => undefined, []);
  const handleNavigate = useCallback((page: AppPage) => {
    if (page === "create") setCurrentTaskId(null);
    const taskId = page === "image-task" ? currentTaskId : null;
    pushRoute(page, taskId);
    setCurrentPage(page);
  }, [currentTaskId]);
  const handleCreateSelect = useCallback((page: "image-task" | "html-video" | "music-mv") => {
    if (page === "image-task") setCurrentTaskId(null);
    pushRoute(page, null);
    setCurrentPage(page);
  }, []);
  const handleOpenTask = useCallback((taskId: string | null) => {
    pushRoute("image-task", taskId);
    setCurrentTaskId(taskId);
    setCurrentPage("image-task");
  }, []);
  const handleRunQueue = useCallback((taskIds: string[]) => {
    const queue = [...new Set(taskIds)];
    activeQueueRef.current = queue;
    setActiveQueue(queue);
    if (queue[0]) {
      pushRoute("image-task", queue[0]);
      setCurrentTaskId(queue[0]);
      setCurrentPage("image-task");
    }
  }, []);
  const handleQueueAdvance = useCallback((taskId: string) => {
    const remaining = activeQueueRef.current.filter((id) => id !== taskId);
    activeQueueRef.current = remaining;
    setActiveQueue(remaining);
    if (remaining[0]) {
      setCurrentTaskId(remaining[0]);
      setCurrentPage("image-task");
    } else {
      setCurrentTaskId(null);
      setCurrentPage("queue");
    }
  }, []);
  const handleBenchmarkCreateTask = useCallback((payload: BenchmarkTaskPayload) => {
    saveTaskHandoff({
      title: payload.title,
      inputText: [payload.transcript, payload.notes].filter(Boolean).join("\n\n"),
      track: "人物故事",
    });
    pushRoute("image-task", null);
    setCurrentTaskId(null);
    setCurrentPage("image-task");
  }, []);
  const handleBookCreateTask = useCallback((payload: CommerceTaskPayload) => {
    saveTaskHandoff({
      title: `《${payload.title}》带货文案`,
      inputText: [
        `书名：《${payload.title}》`,
        payload.author ? `作者：${payload.author}` : "",
        payload.price ? `价格：${payload.price}` : "",
        `类别：${payload.category}`,
        `核心卖点：\n${payload.sellingPoints}`,
        payload.notes ? `补充说明：\n${payload.notes}` : "",
        payload.sourceUrl ? `资料来源：${payload.sourceUrl}` : "",
      ].filter(Boolean).join("\n\n"),
      track: "电商带货",
    });
    pushRoute("image-task", null);
    setCurrentTaskId(null);
    setCurrentPage("image-task");
  }, []);
  const handleBookBenchmark = useCallback((query: string) => {
    setBenchmarkSearch(query);
    pushRoute("benchmark", null);
    setCurrentPage("benchmark");
  }, []);
  const handleBenchmarkCorrect = useCallback(async (payload: BenchmarkAiPayload) => {
    const result = await runLlmPipelineStep({
      step: "precheck",
      config: llmConfig,
      context: benchmarkContext(payload.work.title, payload.transcript),
      artifacts: {},
    });
    return result.step === "precheck" ? result.data.cleanText : payload.transcript;
  }, [llmConfig]);
  const handleBenchmarkAnalyze = useCallback(async (payload: BenchmarkAiPayload) => {
    const context = benchmarkContext(payload.work.title, payload.transcript);
    const result = await runLlmPipelineStep({
      step: "storyboard",
      config: llmConfig,
      context,
      artifacts: {
        precheck: {
          title: payload.work.title,
          cleanText: payload.transcript,
          warnings: [],
          sensitiveTerms: [],
        },
      },
    });
    if (result.step !== "storyboard") return "";
    return result.data.shots.map((shot) => `### ${shot.id}. ${shot.text}\n\n- 画面：${shot.visual}\n- 情绪：${shot.emotion}`).join("\n\n");
  }, [llmConfig]);

  useEffect(() => {
    writeRoute(currentPage, currentTaskId);
  }, [currentPage, currentTaskId]);

  useEffect(() => {
    activeQueueRef.current = activeQueue;
    window.localStorage.setItem("storybound-active-queue", JSON.stringify(activeQueue));
  }, [activeQueue]);

  useEffect(() => {
    const restoreRoute = () => {
      const route = readRoute();
      setCurrentPage(route.page);
      setCurrentTaskId(route.taskId);
    };
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  useEffect(() => {
    void fetchTtsStatus().then((status) => {
      setCredentialStatus(status);
      if (status.minimax.available && !providerWasAutoSelected.current) {
        providerWasAutoSelected.current = true;
        setTtsConfig((current) => ({ ...current, provider: "minimax" }));
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    void fetchLlmStatus().then((status) => {
      setLlmCredentialStatus(status);
      if (status.available && !llmProviderWasAutoSelected.current) {
        llmProviderWasAutoSelected.current = true;
        setLlmConfig((current) => ({
          ...current,
          provider: status.provider ?? current.provider,
          baseUrl: status.baseUrl ?? current.baseUrl,
          model: status.model ?? current.model,
        }));
      }
    }).catch(() => undefined);
  }, []);

  return (
    <AppShell currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === "create" ? <CreatePage onSelect={handleCreateSelect} /> : null}
      {currentPage === "image-task" ? (
        <TaskBuilder
          config={ttsConfig}
          credentialStatus={credentialStatus}
          llmConfig={llmConfig}
          llmCredentialStatus={llmCredentialStatus}
          taskId={currentTaskId}
          autoRun={Boolean(currentTaskId && activeQueue.includes(currentTaskId))}
          onTaskIdChange={setCurrentTaskId}
          onLlmConfigChange={setLlmConfig}
          onTtsConfigChange={setTtsConfig}
          onOpenPipeline={handleOpenPipeline}
          onQueueAdvance={handleQueueAdvance}
          onNavigateSettings={() => setCurrentPage("settings")}
        />
      ) : null}
      {currentPage === "html-video" ? <HtmlVideoPage llmConfig={llmConfig} ttsConfig={ttsConfig} /> : null}
      {currentPage === "music-mv" ? <MusicMvPage ttsConfig={ttsConfig} /> : null}
      {currentPage === "voice-lab" ? (
        <VoiceLabPage
          config={ttsConfig}
          credentialStatus={credentialStatus}
          onChange={setTtsConfig}
          onOpenSettings={() => setCurrentPage("settings")}
        />
      ) : null}
      {currentPage === "playground" ? <PlaygroundPage /> : null}
      {currentPage === "person-assets" ? <PersonAssetsPage /> : null}
      {currentPage === "prompt-templates" ? <PromptTemplatesPage /> : null}
      {currentPage === "draft-templates" ? <DraftTemplatesPage /> : null}
      {currentPage === "benchmark" ? (
        <BenchmarkPage
          initialSearch={benchmarkSearch}
          onCreateTask={handleBenchmarkCreateTask}
          onAiCorrect={llmCredentialStatus.available || llmConfig.apiKey.trim() ? handleBenchmarkCorrect : undefined}
          onAiAnalyze={llmCredentialStatus.available || llmConfig.apiKey.trim() ? handleBenchmarkAnalyze : undefined}
          onTranscribeMedia={(file) => transcribeMedia(file)}
          onTranscribeSource={(url) => transcribeBenchmarkVideo(url)}
        />
      ) : null}
      {currentPage === "book-selection" ? (
        <BookSelectionPage onCreateCommerceTask={handleBookCreateTask} onSearchBenchmark={handleBookBenchmark} />
      ) : null}
      {currentPage === "settings" ? (
        <TtsSettingsPage
          config={ttsConfig}
          credentialStatus={credentialStatus}
          llmConfig={llmConfig}
          llmCredentialStatus={llmCredentialStatus}
          onChange={setTtsConfig}
          onLlmChange={setLlmConfig}
        />
      ) : null}
      {currentPage === "market" ? <MarketPage /> : null}
      {currentPage === "account" || currentPage === "activation" ? (
        <LocalAccountPage
          kind={currentPage}
          llmStatus={llmCredentialStatus}
          ttsStatus={credentialStatus}
          onOpenSettings={() => setCurrentPage("settings")}
        />
      ) : null}
      {currentPage !== "create" &&
      currentPage !== "image-task" &&
      currentPage !== "html-video" &&
      currentPage !== "music-mv" &&
      currentPage !== "voice-lab" &&
      currentPage !== "playground" &&
      currentPage !== "person-assets" &&
      currentPage !== "prompt-templates" &&
      currentPage !== "draft-templates" &&
      currentPage !== "benchmark" &&
      currentPage !== "book-selection" &&
      currentPage !== "settings" &&
      currentPage !== "market" &&
      currentPage !== "account" &&
      currentPage !== "activation" ? (
        <SupportPage page={currentPage} onOpenTask={handleOpenTask} onRunQueue={handleRunQueue} activeQueue={activeQueue} />
      ) : null}
    </AppShell>
  );
}

export default App;
