import { useMemo, useRef, useState, type ChangeEvent } from "react";

import { draftTemplates } from "../data/draft-templates";
import {
  readCustomDraftTemplates,
  writeCustomDraftTemplates,
} from "../lib/draft-template-store";
import type { DraftTemplateConfig, DraftTemplateDefinition } from "../types/draft-template";
import { DraftTemplateEditor } from "./DraftTemplateEditor";
import "./DraftTemplatesPage.css";

function downloadTemplate(template: DraftTemplateDefinition) {
  const payload = {
    kind: "storybound-clone-draft-template",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    template,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${template.name.replace(/[<>:"/\\|?*]/gu, "-") || "draft-template"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function cloneDefinition(template: DraftTemplateDefinition, name = `${template.name} · 副本`): DraftTemplateDefinition {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name,
    config: structuredClone(template.config),
  };
}

function isDraftTemplateDefinition(value: unknown): value is DraftTemplateDefinition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraftTemplateDefinition>;
  return Boolean(
    candidate.name
    && candidate.config?.canvas
    && candidate.config?.caption,
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function DraftTemplatesPage() {
  const [customTemplates, setCustomTemplates] = useState(readCustomDraftTemplates);
  const [selectedId, setSelectedId] = useState(draftTemplates[0].id);
  const [draftName, setDraftName] = useState(draftTemplates[0].name);
  const [draftConfig, setDraftConfig] = useState<DraftTemplateConfig>(() => structuredClone(draftTemplates[0].config));
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const allTemplates = useMemo(() => [...draftTemplates, ...customTemplates], [customTemplates]);
  const selected = allTemplates.find((template) => template.id === selectedId) ?? allTemplates[0];
  const isCustom = selected.id.startsWith("custom-");

  function selectTemplate(template: DraftTemplateDefinition) {
    setSelectedId(template.id);
    setDraftName(template.name);
    setDraftConfig(structuredClone(template.config));
    setNotice("");
  }

  function persist(next: DraftTemplateDefinition[]) {
    setCustomTemplates(next);
    writeCustomDraftTemplates(next);
  }

  function saveTemplate() {
    const name = draftName.trim();
    if (!name) {
      setNotice("请先填写模板名称。");
      return;
    }
    if (isCustom) {
      const next = customTemplates.map((template) => template.id === selected.id
        ? { ...template, name, config: structuredClone(draftConfig) }
        : template);
      persist(next);
      setNotice("模板已保存，创建任务页会立即读取这份配置。");
      return;
    }
    const created = cloneDefinition({ ...selected, config: draftConfig }, name === selected.name ? `${name} · 自定义` : name);
    persist([...customTemplates, created]);
    selectTemplate(created);
    setNotice("系统模板已复制为可编辑模板，并安装到创建任务页。");
  }

  function resetEditor() {
    setDraftName(selected.name);
    setDraftConfig(structuredClone(selected.config));
    setNotice("已恢复到上次保存的配置。");
  }

  function deleteTemplate() {
    if (!isCustom || !window.confirm(`删除本地模板“${selected.name}”？`)) return;
    const next = customTemplates.filter((template) => template.id !== selected.id);
    persist(next);
    selectTemplate(draftTemplates[0]);
    setNotice("本地模板已删除。");
  }

  async function importTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const wrapped = parsed && typeof parsed === "object" && "template" in parsed
        ? (parsed as { template?: unknown }).template
        : parsed;
      if (!isDraftTemplateDefinition(wrapped)) throw new Error("模板结构不完整");
      const source = wrapped;
      const imported = cloneDefinition(source, source.name);
      persist([...customTemplates, imported]);
      selectTemplate(imported);
      setNotice(`已导入 ${file.name}。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "模板导入失败。");
    }
  }

  return (
    <main className="draft-templates-page">
      <header>
        <div><span>STORYBOUND v1.16.1</span><h1>草稿模板</h1><p>编辑画布、文字轨、画面、边框、免责声明与音量；保存后可在图文任务中直接选用。</p></div>
        <div><button type="button" onClick={() => importRef.current?.click()}>导入 JSON</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importTemplate(event)} /></div>
      </header>
      {notice ? <div className="draft-template-notice" role="status">{notice}</div> : null}
      <div className="draft-templates-layout">
        <aside>
          <strong>系统模板 {draftTemplates.length}</strong>
          {draftTemplates.map((template) => <button className={selected.id === template.id ? "is-selected" : ""} key={template.id} type="button" onClick={() => selectTemplate(template)}><span>{template.name}</span><small>{template.config.canvas.width}×{template.config.canvas.height}</small></button>)}
          <strong>我的模板 {customTemplates.length}</strong>
          {customTemplates.map((template) => <button className={selected.id === template.id ? "is-selected" : ""} key={template.id} type="button" onClick={() => selectTemplate(template)}><span>{template.name}</span><small>本地可编辑</small></button>)}
        </aside>
        <section className="draft-template-workbench">
          <div className="draft-template-toolbar">
            <label>模板名称<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
            <div><button type="button" onClick={resetEditor}>重置</button><button type="button" onClick={() => downloadTemplate({ ...selected, name: draftName, config: draftConfig })}>导出</button>{isCustom ? <button className="is-danger" type="button" onClick={deleteTemplate}>删除</button> : null}<button className="is-primary" type="button" onClick={saveTemplate}>{isCustom ? "保存模板" : "复制并保存"}</button></div>
          </div>
          <DraftTemplateEditor config={draftConfig} onChange={setDraftConfig} onReset={resetEditor} onUploadBackground={fileToDataUrl} />
        </section>
      </div>
    </main>
  );
}
