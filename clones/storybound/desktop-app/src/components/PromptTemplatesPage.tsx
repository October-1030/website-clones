import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import {
  emptyPromptTemplate,
  readCustomPromptTemplates,
  templatesFromLibrary,
  writeCustomPromptTemplates,
  type PromptLibraryPayload,
  type PromptTemplate,
} from "../lib/prompt-template-store";
import "./PromptTemplatesPage.css";

function downloadTemplate(template: PromptTemplate) {
  const payload = {
    kind: "storybound-clone-prompt-template",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    template: { ...template, source: "custom" },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${template.name.replace(/[<>:"/\\|?*]/gu, "-") || "prompt-template"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function PromptTemplatesPage() {
  const [systemTemplates, setSystemTemplates] = useState<PromptTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>(readCustomPromptTemplates);
  const [editor, setEditor] = useState<PromptTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "system" | "custom">("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    writeCustomPromptTemplates(customTemplates);
  }, [customTemplates]);

  useEffect(() => {
    let active = true;
    void fetch("/api/llm/prompt-library", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`提示词库读取失败（HTTP ${response.status}）`);
        return response.json() as Promise<PromptLibraryPayload>;
      })
      .then((library) => {
        if (active) setSystemTemplates(templatesFromLibrary(library));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "提示词库读取失败。");
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...systemTemplates, ...customTemplates]
      .filter((template) => scope === "all" || template.source === scope)
      .filter((template) => !normalized || `${template.name} ${template.baseTrack}`.toLowerCase().includes(normalized));
  }, [customTemplates, query, scope, systemTemplates]);

  function cloneTemplate(template: PromptTemplate) {
    setEditor({ ...structuredClone(template), id: crypto.randomUUID(), name: `${template.name} · 副本`, version: "1.0.0", source: "custom" });
  }

  function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!editor?.name.trim() || !editor.baseTrack.trim()) return;
    const saved = { ...editor, name: editor.name.trim(), baseTrack: editor.baseTrack.trim(), source: "custom" as const };
    setCustomTemplates((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
    setEditor(null);
    setNotice("模板已保存到本机。");
  }

  function deleteTemplate(template: PromptTemplate) {
    if (!window.confirm(`删除本地模板“${template.name}”？`)) return;
    setCustomTemplates((current) => current.filter((item) => item.id !== template.id));
  }

  async function importTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { kind?: string; template?: Partial<PromptTemplate> };
      if (payload.kind !== "storybound-clone-prompt-template" || !payload.template?.name || !payload.template.baseTrack) {
        throw new Error("不是有效的 Storybound 模板文件。");
      }
      const imported: PromptTemplate = {
        ...emptyPromptTemplate(),
        ...payload.template,
        id: crypto.randomUUID(),
        source: "custom",
      };
      setEditor(imported);
      setNotice("导入成功，请检查内容后保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败。");
    }
  }

  return (
    <main className="prompt-templates-page">
      <header><div><span>原版提示词库 · 本地</span><h1>提示词模板</h1><p>系统模板来自已提取的原版提示词库；自定义模板仅保存在本机，不连接原站市场。</p></div><div><label>导入 JSON<input type="file" accept=".json,application/json" onChange={(event) => void importTemplate(event)} /></label><button onClick={() => setEditor(emptyPromptTemplate())} type="button">＋ 新建模板</button></div></header>
      {notice ? <div className="prompt-template-notice"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")} type="button">×</button></div> : null}
      <section className="prompt-template-toolbar"><div>{(["all", "system", "custom"] as const).map((value) => <button className={scope === value ? "is-selected" : ""} key={value} onClick={() => setScope(value)} type="button">{value === "all" ? "全部" : value === "system" ? `系统模板 ${systemTemplates.length}` : `我的模板 ${customTemplates.length}`}</button>)}</div><input aria-label="搜索提示词模板" placeholder="搜模板或赛道" value={query} onChange={(event) => setQuery(event.target.value)} /></section>
      <section className="prompt-template-grid">{visibleTemplates.map((template) => <article key={template.id}><div className="prompt-template-card__head"><span className={template.source === "system" ? "is-system" : ""}>{template.source === "system" ? "系统模板" : "本地模板"}</span><small>v{template.version}</small></div><h2>{template.name}</h2><p>{template.baseTrack}</p><dl><div><dt>改写规则</dt><dd>{template.rewritePrompt.length.toLocaleString("zh-CN")} 字</dd></div><div><dt>元数据</dt><dd>{template.metadataPrompt.length.toLocaleString("zh-CN")} 字</dd></div><div><dt>分镜规则</dt><dd>{template.segmentationPrompt.length.toLocaleString("zh-CN")} 字</dd></div><div><dt>绘图规则</dt><dd>{template.imagePrompt.length.toLocaleString("zh-CN")} 字</dd></div></dl><footer>{template.source === "system" ? <button onClick={() => cloneTemplate(template)} type="button">克隆后编辑</button> : <><button onClick={() => setEditor(structuredClone(template))} type="button">编辑</button><button onClick={() => cloneTemplate(template)} type="button">复制</button><button onClick={() => downloadTemplate(template)} type="button">导出</button><button className="is-danger" onClick={() => deleteTemplate(template)} type="button">删除</button></>}</footer></article>)}</section>
      {visibleTemplates.length === 0 ? <div className="prompt-template-empty"><strong>没有匹配的模板</strong><p>换个关键词，或创建一个本地模板。</p></div> : null}
      {editor ? <form className="prompt-template-editor" onSubmit={saveTemplate}><header><div><span>本地模板编辑器</span><h2>{customTemplates.some((item) => item.id === editor.id) ? "编辑模板" : "新建模板"}</h2></div><button aria-label="关闭编辑器" onClick={() => setEditor(null)} type="button">×</button></header><div className="prompt-template-editor__meta"><label>模板名称<input required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label><label>基础赛道<input required list="prompt-template-tracks" value={editor.baseTrack} onChange={(event) => setEditor({ ...editor, baseTrack: event.target.value })} /><datalist id="prompt-template-tracks">{systemTemplates.map((template) => <option key={template.id} value={template.baseTrack} />)}</datalist></label><label>版本<input value={editor.version} onChange={(event) => setEditor({ ...editor, version: event.target.value })} /></label></div><label>文案改写规则<textarea value={editor.rewritePrompt} onChange={(event) => setEditor({ ...editor, rewritePrompt: event.target.value })} /></label><label>封面标题 / 元数据规则<textarea value={editor.metadataPrompt} onChange={(event) => setEditor({ ...editor, metadataPrompt: event.target.value })} /></label><label>分镜拆分规则<textarea value={editor.segmentationPrompt} onChange={(event) => setEditor({ ...editor, segmentationPrompt: event.target.value })} /></label><label>分镜绘图提示词规则<textarea value={editor.imagePrompt} onChange={(event) => setEditor({ ...editor, imagePrompt: event.target.value })} /></label><footer><button onClick={() => setEditor(null)} type="button">取消</button><button className="is-primary" type="submit">保存到本机</button></footer></form> : null}
    </main>
  );
}
