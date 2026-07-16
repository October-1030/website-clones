import { useEffect, useRef, useState } from "react";

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

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>("create");
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(defaultTtsConfig);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultLlmConfig);
  const [credentialStatus, setCredentialStatus] = useState<TtsCredentialStatus>(emptyCredentialStatus);
  const [llmCredentialStatus, setLlmCredentialStatus] = useState<LlmCredentialStatus>(emptyLlmCredentialStatus);
  const providerWasAutoSelected = useRef(false);
  const llmProviderWasAutoSelected = useRef(false);

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
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === "create" ? <CreatePage onSelect={setCurrentPage} /> : null}
      {currentPage === "image-task" ? (
        <TaskBuilder
          config={ttsConfig}
          credentialStatus={credentialStatus}
          llmConfig={llmConfig}
          llmCredentialStatus={llmCredentialStatus}
          onLlmConfigChange={setLlmConfig}
          onTtsConfigChange={setTtsConfig}
          onOpenPipeline={() => undefined}
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
        <SupportPage page={currentPage} onOpenTask={() => setCurrentPage("image-task")} />
      ) : null}
    </AppShell>
  );
}

export default App;
