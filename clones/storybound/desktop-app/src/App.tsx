import { useCallback, useEffect, useRef, useState } from "react";

import "./App.css";
import { AppShell } from "./components/AppShell";
import { CreatePage } from "./components/CreatePage";
import { ModeBuilder } from "./components/ModeBuilder";
import { SupportPage } from "./components/SupportPage";
import { TaskBuilder } from "./components/TaskBuilder";
import { TtsSettingsPage } from "./components/TtsSettingsPage";
import { VoiceLabPage } from "./components/VoiceLabPage";
import { defaultLlmConfig } from "./data/llm-data";
import { defaultTtsConfig } from "./data/tts-data";
import { fetchLlmStatus } from "./lib/llm-api";
import { fetchTtsStatus } from "./lib/tts-api";
import type { AppPage } from "./types/app";
import type { LlmConfig, LlmCredentialStatus } from "./types/llm";
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
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get("task");
  const pageValue = params.get("page");
  const page = appPages.includes(pageValue as AppPage) ? pageValue as AppPage : taskId ? "image-task" : "create";
  return { page, taskId: page === "image-task" ? taskId : null };
}

function writeRoute(page: AppPage, taskId: string | null): void {
  const params = new URLSearchParams();
  if (page !== "create") params.set("page", page);
  if (page === "image-task" && taskId) params.set("task", taskId);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function readQueue(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("storybound-active-queue") || "[]");
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
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
  const providerWasAutoSelected = useRef(false);
  const llmProviderWasAutoSelected = useRef(false);
  const handleOpenPipeline = useCallback(() => undefined, []);
  const handleNavigate = useCallback((page: AppPage) => {
    if (page === "create") setCurrentTaskId(null);
    setCurrentPage(page);
  }, []);
  const handleCreateSelect = useCallback((page: "image-task" | "html-video" | "music-mv") => {
    if (page === "image-task") setCurrentTaskId(null);
    setCurrentPage(page);
  }, []);
  const handleOpenTask = useCallback((taskId: string | null) => {
    setCurrentTaskId(taskId);
    setCurrentPage("image-task");
  }, []);
  const handleRunQueue = useCallback((taskIds: string[]) => {
    const queue = [...new Set(taskIds)];
    activeQueueRef.current = queue;
    setActiveQueue(queue);
    if (queue[0]) {
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
      {currentPage === "html-video" ? <ModeBuilder kind="html-video" /> : null}
      {currentPage === "music-mv" ? <ModeBuilder kind="music-mv" /> : null}
      {currentPage === "voice-lab" ? (
        <VoiceLabPage
          config={ttsConfig}
          credentialStatus={credentialStatus}
          onChange={setTtsConfig}
          onOpenSettings={() => setCurrentPage("settings")}
        />
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
      {currentPage !== "create" &&
      currentPage !== "image-task" &&
      currentPage !== "html-video" &&
      currentPage !== "music-mv" &&
      currentPage !== "voice-lab" &&
      currentPage !== "settings" ? (
        <SupportPage page={currentPage} onOpenTask={handleOpenTask} onRunQueue={handleRunQueue} activeQueue={activeQueue} />
      ) : null}
    </AppShell>
  );
}

export default App;
