"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { DashIcon } from "@/components/dashboard-icons";
import type { GeoWorkflowStore } from "@/hooks/use-geo-workflow";
import { parseGeneratedQuestions, requestWorkflowGeneration, type GeoWorkflowData } from "@/lib/geo-workflow";
import type { Company } from "@/lib/workspace-data";

const supportedTextFiles = [".txt", ".md", ".markdown", ".csv", ".json"];
const platforms = ["微信公众号", "知乎", "百家号", "小红书", "头条号", "官网", "其他"];
const aiPlatforms = ["DeepSeek", "豆包", "腾讯元宝", "通义千问", "文心一言", "Kimi", "智谱清言", "其他"];

function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function confirmRemove(label: string) { return window.confirm(`确定删除“${label}”吗？此操作只影响当前浏览器的数据。`); }

function WorkspaceHeader({ eyebrow, title, description, children, onBack }: { eyebrow: string; title: string; description: string; children?: ReactNode; onBack: () => void }) {
  return <header className="feature-workspace-header geo-workflow-header"><div><button onClick={onBack}><DashIcon name="arrowRight" className="rotate-180" />返回工作台</button><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{children}</header>;
}

function ContextSelectors({ companies, selectedCompanyId, selectedProjectId, onCompany, onProject }: { companies: Company[]; selectedCompanyId: string; selectedProjectId: string; onCompany: (id: string) => void; onProject: (id: string) => void }) {
  const company = companies.find((item) => item.id === selectedCompanyId);
  return <div className="geo-context-selectors"><label><span>公司</span><select aria-label="工作流公司" value={selectedCompanyId} onChange={(event) => { onCompany(event.target.value); onProject(""); }}><option value="">未选择公司</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>GEO 项目</span><select aria-label="工作流 GEO 项目" value={selectedProjectId} disabled={!company} onChange={(event) => onProject(event.target.value)}><option value="">{company ? "全部项目" : "请先选择公司"}</option>{company?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="workspace-empty geo-empty"><DashIcon name="folder" /><strong>{title}</strong><p>{description}</p></div>; }

function RecordActions({ label, onRemove }: { label: string; onRemove: () => void }) { return <button className="geo-delete" onClick={() => { if (confirmRemove(label)) onRemove(); }}>删除</button>; }

function WorkflowNotice() { return <section className="feature-notice"><DashIcon name="info" /><p>此页面已升级为可运行的本机工作流。资料保存在当前浏览器；调用 MiniMax-M3 时，只发送本次生成所需的可见文本。</p></section>; }

export function GeoContentWorkspace({ route, companies, selectedCompanyId: initialCompanyId, onSelectCompany, onBack, workflow }: { route: string; companies: Company[]; selectedCompanyId: string; onSelectCompany: (id: string) => void; onBack: () => void; workflow: GeoWorkflowStore }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;
  const selectedProject = selectedCompany?.projects.find((project) => project.id === selectedProjectId) || null;

  useEffect(() => { if (initialCompanyId) setSelectedCompanyId(initialCompanyId); }, [initialCompanyId]);
  useEffect(() => { if (selectedProjectId && !selectedCompany?.projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(""); }, [selectedCompany, selectedProjectId]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function selectCompany(id: string) { setSelectedCompanyId(id); if (id) onSelectCompany(id); }
  async function generate(label: string, prompt: string) {
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(label); setError("");
    try { return await requestWorkflowGeneration(prompt.slice(0, 4000), controller.signal); }
    catch (failure) { setError(controller.signal.aborted ? "已停止生成。" : failure instanceof Error ? failure.message : "生成失败，请稍后再试。"); return ""; }
    finally { requestRef.current = null; setBusy(""); }
  }

  const context = useMemo(() => {
    const documents = workflow.data.knowledge.filter((item) => (!selectedCompanyId || item.companyId === selectedCompanyId) && (!selectedProjectId || item.projectId === selectedProjectId));
    return [
      selectedCompany ? `公司：${selectedCompany.name}\n公司简介：${selectedCompany.description}\n公司别名：${selectedCompany.aliases.join("、") || "无"}` : "未指定公司",
      selectedProject ? `GEO 项目：${selectedProject.name}\n关键词：${selectedProject.keywords.join("、")}\n品牌词：${selectedProject.targetWords.join("、")}` : "未指定 GEO 项目",
      documents.length ? `知识资料：\n${documents.slice(0, 4).map((item) => `【${item.title}】${item.content.slice(0, 500)}`).join("\n")}` : "没有知识资料",
    ].join("\n");
  }, [selectedCompany, selectedCompanyId, selectedProject, selectedProjectId, workflow.data.knowledge]);

  const common = { companies, selectedCompanyId, selectedProjectId, onCompany: selectCompany, onProject: setSelectedProjectId };
  if (!workflow.loaded) return <div className="feature-workspace"><EmptyState title="正在加载工作流" description="正在读取当前浏览器中的业务资料。" /></div>;
  if (route === "#/knowledge") return <KnowledgeView workflow={workflow} common={common} error={error} setError={setError} onBack={onBack} />;
  if (route === "#/question-task" || route === "#/questions") return <QuestionView workflow={workflow} common={common} context={context} generator={generate} busy={busy} error={error} onStop={() => requestRef.current?.abort()} onBack={onBack} libraryOnly={route === "#/questions"} />;
  if (route === "#/prompt") return <PromptView workflow={workflow} error={error} setError={setError} onBack={onBack} />;
  if (route === "#/article-task" || route === "#/article") return <ArticleView workflow={workflow} common={common} context={context} generator={generate} busy={busy} error={error} onStop={() => requestRef.current?.abort()} onBack={onBack} />;
  if (route === "#/publication-task") return <PublicationView workflow={workflow} error={error} setError={setError} onBack={onBack} />;
  if (route === "#/collected-history") return <IndexingView workflow={workflow} error={error} setError={setError} onBack={onBack} />;
  if (route === "#/diagnosis-report" || route === "#/monitor-report") return <ReportView workflow={workflow} generator={generate} busy={busy} error={error} onStop={() => requestRef.current?.abort()} onBack={onBack} type={route === "#/diagnosis-report" ? "diagnosis" : "monitor"} />;
  return null;
}

type WorkflowHook = GeoWorkflowStore;
type CommonContext = { companies: Company[]; selectedCompanyId: string; selectedProjectId: string; onCompany: (id: string) => void; onProject: (id: string) => void };

function KnowledgeView({ workflow, common, error, setError, onBack }: { workflow: WorkflowHook; common: CommonContext; error: string; setError: (value: string) => void; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState("手动录入");

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!supportedTextFiles.includes(extension)) { setError("当前支持 TXT、Markdown、CSV 和 JSON 文本文件。PDF、Word 需要额外解析服务。"); return; }
    if (file.size > 250 * 1024) { setError("单个知识文件不能超过 250KB。"); return; }
    const text = await file.text();
    if (!text.trim()) { setError("文件没有可读取的文本内容。"); return; }
    setContent(text.slice(0, 60000)); setTitle((value) => value || file.name.replace(/\.[^.]+$/, "")); setSourceName(file.name); setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2 || content.trim().length < 10) { setError("请填写至少 2 个字符的标题和至少 10 个字符的知识正文。"); return; }
    workflow.addKnowledge({ title: title.trim(), content: content.trim(), sourceName, companyId: common.selectedCompanyId, projectId: common.selectedProjectId });
    setTitle(""); setContent(""); setSourceName("手动录入"); setError("");
  }

  return <div className="feature-workspace"><WorkspaceHeader eyebrow="知识准备" title="知识库" description="上传或粘贴真实文本资料，作为 M3 生成问题和文章的依据。" onBack={onBack} /><WorkflowNotice /><ContextSelectors {...common} /><section className="geo-workflow-grid"><form className="geo-builder" onSubmit={submit}><header><h2>添加知识资料</h2><span>支持 TXT / MD / CSV / JSON，最大 250KB</span></header><label><span>资料文件</span><input aria-label="知识文件" type="file" accept={supportedTextFiles.join(",")} onChange={(event) => void readFile(event)} /></label><label><span>标题</span><input aria-label="知识标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：产品手册" /></label><label><span>正文</span><textarea aria-label="知识正文" rows={12} value={content} onChange={(event) => setContent(event.target.value)} placeholder="粘贴品牌、产品、服务或案例资料" /></label>{error && <p role="alert" className="workspace-form-error">{error}</p>}<button className="workspace-primary" type="submit"><DashIcon name="plus" />保存知识资料</button></form><section className="geo-record-panel"><header><h2>已保存资料</h2><span>{workflow.data.knowledge.length} 份</span></header>{workflow.data.knowledge.length ? <div className="geo-record-list">{workflow.data.knowledge.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.sourceName} · {formatDate(item.createdAt)}</small></div><p>{item.content.slice(0, 180)}{item.content.length > 180 ? "…" : ""}</p><RecordActions label={item.title} onRemove={() => workflow.remove("knowledge", item.id)} /></article>)}</div> : <EmptyState title="暂无知识资料" description="上传文本文件或粘贴正文后即可用于生成。" />}</section></section></div>;
}

function QuestionView({ workflow, common, context, generator, busy, error, onStop, onBack, libraryOnly }: { workflow: WorkflowHook; common: CommonContext; context: string; generator: (label: string, prompt: string) => Promise<string>; busy: string; error: string; onStop: () => void; onBack: () => void; libraryOnly: boolean }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [manual, setManual] = useState("");

  async function createQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim()) return;
    const reply = await generator("正在生成搜索问题", `请根据以下真实资料生成 ${count} 个中文用户搜索问题。每行只输出一个完整问题，不要编号，不要解释，不要编造资料中没有的事实。\n主题：${topic.trim()}\n${context}`);
    if (!reply) return;
    const questions = parseGeneratedQuestions(reply, count);
    if (questions.length) workflow.addQuestions(questions.map((text) => ({ text, source: "ai", companyId: common.selectedCompanyId, projectId: common.selectedProjectId })));
  }

  function addManual(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!manual.trim()) return; workflow.addQuestions([{ text: manual.trim(), source: "manual", companyId: common.selectedCompanyId, projectId: common.selectedProjectId }]); setManual(""); }

  return <div className="feature-workspace"><WorkspaceHeader eyebrow="选题研究" title={libraryOnly ? "搜索问题库" : "AI 拓展问题"} description={libraryOnly ? "集中管理 M3 生成或手动添加的搜索问题。" : "用公司、项目和知识资料生成真实可用的搜索问题。"} onBack={onBack} /><WorkflowNotice /><ContextSelectors {...common} />{!libraryOnly && <form className="geo-builder geo-builder-wide" onSubmit={(event) => void createQuestions(event)}><header><h2>MiniMax-M3 问题拓展</h2><span>本次上下文包含 {workflow.data.knowledge.length} 份本机知识资料</span></header><div className="geo-form-row"><label><span>拓展主题</span><input aria-label="拓展主题" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例如：中小企业如何做 GEO 营销" /></label><label><span>数量</span><select aria-label="问题数量" value={count} onChange={(event) => setCount(Number(event.target.value))}>{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} 个</option>)}</select></label></div>{error && <p role="alert" className="workspace-form-error">{error}</p>}<div className="geo-actions">{busy ? <button type="button" onClick={onStop}>停止生成</button> : <button className="workspace-primary" type="submit" disabled={!topic.trim()}><DashIcon name="robot" />用 M3 生成问题</button>}</div></form>}<section className="geo-record-panel geo-record-panel-wide"><header><div><h2>搜索问题</h2><span>{workflow.data.questions.length} 条</span></div><form className="geo-inline-add" onSubmit={addManual}><input aria-label="手动问题" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="手动添加一个问题" /><button type="submit">添加</button></form></header>{workflow.data.questions.length ? <div className="geo-question-list">{workflow.data.questions.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.text}</strong><small>{item.source === "ai" ? "MiniMax-M3" : "手动"} · {formatDate(item.createdAt)}</small></div><RecordActions label={item.text} onRemove={() => workflow.remove("questions", item.id)} /></article>)}</div> : <EmptyState title="暂无搜索问题" description="使用 M3 拓展或手动添加第一个问题。" />}</section></div>;
}

function PromptView({ workflow, error, setError, onBack }: { workflow: WorkflowHook; error: string; setError: (value: string) => void; onBack: () => void }) {
  const [name, setName] = useState(""); const [content, setContent] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (name.trim().length < 2 || content.trim().length < 10) { setError("请填写提示词名称和至少 10 个字符的写作要求。"); return; } workflow.addPrompt({ name: name.trim(), content: content.trim() }); setName(""); setContent(""); setError(""); }
  return <div className="feature-workspace"><WorkspaceHeader eyebrow="写作配置" title="提示词管理" description="保存可在文章生成时直接选用的写作风格和结构要求。" onBack={onBack} /><WorkflowNotice /><section className="geo-workflow-grid"><form className="geo-builder" onSubmit={submit}><header><h2>新建写作提示词</h2><span>例如品牌语气、文章结构、禁用表达</span></header><label><span>名称</span><input aria-label="提示词名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：专业测评文章" /></label><label><span>写作要求</span><textarea aria-label="提示词内容" rows={12} value={content} onChange={(event) => setContent(event.target.value)} placeholder="写明语气、结构、篇幅、目标读者和事实边界" /></label>{error && <p role="alert" className="workspace-form-error">{error}</p>}<button className="workspace-primary" type="submit">保存提示词</button></form><section className="geo-record-panel"><header><h2>提示词</h2><span>{workflow.data.prompts.length} 个</span></header>{workflow.data.prompts.length ? <div className="geo-record-list">{workflow.data.prompts.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{formatDate(item.createdAt)}</small></div><p>{item.content}</p><RecordActions label={item.name} onRemove={() => workflow.remove("prompts", item.id)} /></article>)}</div> : <EmptyState title="暂无提示词" description="保存一个提示词后即可在文章生成时选用。" />}</section></section></div>;
}

function ArticleView({ workflow, common, context, generator, busy, error, onStop, onBack }: { workflow: WorkflowHook; common: CommonContext; context: string; generator: (label: string, prompt: string) => Promise<string>; busy: string; error: string; onStop: () => void; onBack: () => void }) {
  const [questionId, setQuestionId] = useState(""); const [promptId, setPromptId] = useState(""); const [title, setTitle] = useState("");
  const question = workflow.data.questions.find((item) => item.id === questionId); const writingPrompt = workflow.data.prompts.find((item) => item.id === promptId);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!question) return; const article = await generator("正在生成文章", `请基于以下真实资料写一篇中文 GEO 营销文章。直接输出完整文章，使用清晰标题和小标题，不输出内部思考，不编造事实。\n文章主题：${title.trim() || question.text}\n目标搜索问题：${question.text}\n写作要求：${writingPrompt?.content || "专业、清晰、可核验，约 1000 字"}\n${context}`); if (!article) return; workflow.addArticle({ title: title.trim() || question.text, content: article, questionId: question.id, promptId: writingPrompt?.id || "", companyId: common.selectedCompanyId, projectId: common.selectedProjectId }); setTitle(""); }
  return <div className="feature-workspace"><WorkspaceHeader eyebrow="内容创作" title="AI 文章创作" description="组合搜索问题、知识资料和提示词，使用 MiniMax-M3 生成文章。" onBack={onBack} /><WorkflowNotice /><ContextSelectors {...common} /><form className="geo-builder geo-builder-wide" onSubmit={(event) => void submit(event)}><header><h2>生成文章</h2><span>已保存 {workflow.data.questions.length} 个问题、{workflow.data.prompts.length} 个提示词</span></header><div className="geo-form-row"><label><span>搜索问题</span><select aria-label="文章搜索问题" value={questionId} onChange={(event) => setQuestionId(event.target.value)}><option value="">请选择问题</option>{workflow.data.questions.map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label><label><span>写作提示词</span><select aria-label="文章提示词" value={promptId} onChange={(event) => setPromptId(event.target.value)}><option value="">默认专业风格</option>{workflow.data.prompts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label><span>文章标题（可选）</span><input aria-label="文章标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={question?.text || "选择搜索问题后可沿用问题作为标题"} /></label>{error && <p role="alert" className="workspace-form-error">{error}</p>}<div className="geo-actions">{busy ? <button type="button" onClick={onStop}>停止生成</button> : <button className="workspace-primary" type="submit" disabled={!question}><DashIcon name="robot" />用 M3 生成文章</button>}</div></form><section className="geo-record-panel geo-record-panel-wide"><header><h2>文章库</h2><span>{workflow.data.articles.length} 篇</span></header>{workflow.data.articles.length ? <div className="geo-article-list">{workflow.data.articles.map((item) => <article key={item.id}><header><div><strong>{item.title}</strong><small>{formatDate(item.createdAt)}</small></div><RecordActions label={item.title} onRemove={() => workflow.remove("articles", item.id)} /></header><div className="geo-long-text">{item.content}</div></article>)}</div> : <EmptyState title="暂无文章" description="先生成或添加搜索问题，再使用 M3 创建第一篇文章。" />}</section></div>;
}

function PublicationView({ workflow, error, setError, onBack }: { workflow: WorkflowHook; error: string; setError: (value: string) => void; onBack: () => void }) {
  const [articleId, setArticleId] = useState(""); const [platform, setPlatform] = useState(platforms[0]); const [scheduledAt, setScheduledAt] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!articleId) { setError("请选择要发布的文章。"); return; } workflow.addPublication({ articleId, platform, scheduledAt, status: scheduledAt ? "queued" : "draft" }); setArticleId(""); setScheduledAt(""); setError(""); }
  return <div className="feature-workspace"><WorkspaceHeader eyebrow="内容分发" title="发布任务" description="创建真实的本机发布队列；接入平台 OAuth 后可由适配器执行。" onBack={onBack} /><section className="feature-notice is-warning"><DashIcon name="info" /><p>当前不会向第三方平台发送内容。平台授权和自动发布需要对应平台的开放接口与账号凭证。</p></section><form className="geo-builder geo-builder-wide" onSubmit={submit}><div className="geo-form-row"><label><span>文章</span><select aria-label="发布文章" value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">请选择文章</option>{workflow.data.articles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span>平台</span><select aria-label="发布平台" value={platform} onChange={(event) => setPlatform(event.target.value)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>计划时间</span><input aria-label="计划时间" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label></div>{error && <p role="alert" className="workspace-form-error">{error}</p>}<button className="workspace-primary" type="submit">加入发布队列</button></form><section className="geo-record-panel geo-record-panel-wide"><header><h2>本机发布队列</h2><span>{workflow.data.publications.length} 条</span></header>{workflow.data.publications.length ? <div className="geo-question-list">{workflow.data.publications.map((item) => <article key={item.id}><span>{item.status === "queued" ? "排期" : "草稿"}</span><div><strong>{workflow.data.articles.find((article) => article.id === item.articleId)?.title || "文章已删除"}</strong><small>{item.platform} · {item.scheduledAt || formatDate(item.createdAt)}</small></div><RecordActions label={item.platform} onRemove={() => workflow.remove("publications", item.id)} /></article>)}</div> : <EmptyState title="暂无发布任务" description="生成文章后可加入本机发布队列。" />}</section></div>;
}

function IndexingView({ workflow, error, setError, onBack }: { workflow: WorkflowHook; error: string; setError: (value: string) => void; onBack: () => void }) {
  const [articleId, setArticleId] = useState(""); const [platform, setPlatform] = useState(aiPlatforms[0]); const [query, setQuery] = useState(""); const [url, setUrl] = useState(""); const [status, setStatus] = useState<"included" | "not-found" | "pending">("pending");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!query.trim()) { setError("请填写用于核验的搜索问题或关键词。"); return; } workflow.addIndexRecord({ articleId, platform, query: query.trim(), url: url.trim(), status }); setQuery(""); setUrl(""); setError(""); }
  return <div className="feature-workspace"><WorkspaceHeader eyebrow="效果验证" title="收录记录" description="保存人工核验或外部采集器返回的收录证据。" onBack={onBack} /><section className="feature-notice is-warning"><DashIcon name="info" /><p>MiniMax-M3 不能替代联网收录查询。自动查询需要搜索平台 API、合规采集服务或配套浏览器插件。</p></section><form className="geo-builder geo-builder-wide" onSubmit={submit}><div className="geo-form-row"><label><span>文章</span><select aria-label="收录文章" value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">未关联文章</option>{workflow.data.articles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><span>AI 平台</span><select aria-label="收录平台" value={platform} onChange={(event) => setPlatform(event.target.value)}>{aiPlatforms.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>状态</span><select aria-label="收录状态" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="pending">待核验</option><option value="included">已收录/引用</option><option value="not-found">未发现</option></select></label></div><label><span>查询问题或关键词</span><input aria-label="收录查询词" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span>证据链接（可选）</span><input aria-label="收录证据链接" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>{error && <p role="alert" className="workspace-form-error">{error}</p>}<button className="workspace-primary" type="submit">保存核验记录</button></form><section className="geo-record-panel geo-record-panel-wide"><header><h2>核验记录</h2><span>{workflow.data.indexing.length} 条</span></header>{workflow.data.indexing.length ? <div className="geo-question-list">{workflow.data.indexing.map((item) => <article key={item.id}><span>{item.status === "included" ? "收录" : item.status === "not-found" ? "未发现" : "待查"}</span><div><strong>{item.query}</strong><small>{item.platform} · {formatDate(item.createdAt)}{item.url ? ` · ${item.url}` : ""}</small></div><RecordActions label={item.query} onRemove={() => workflow.remove("indexing", item.id)} /></article>)}</div> : <EmptyState title="暂无核验记录" description="人工查询后保存结果，后续可接入自动采集适配器。" />}</section></div>;
}

function ReportView({ workflow, generator, busy, error, onStop, onBack, type }: { workflow: WorkflowHook; generator: (label: string, prompt: string) => Promise<string>; busy: string; error: string; onStop: () => void; onBack: () => void; type: "diagnosis" | "monitor" }) {
  const label = type === "diagnosis" ? "诊断报告" : "监测报告";
  async function createReport() { const summary = summarize(workflow.data); const content = await generator(`正在生成${label}`, `请根据以下本机业务统计生成一份中文${label}。必须区分事实与建议，不能编造未提供的数据。使用清晰的标题、结论、证据和下一步行动。\n${summary}`); if (content) workflow.addReport({ type, title: `${label} · ${new Date().toLocaleDateString("zh-CN")}`, content }); }
  const reports = workflow.data.reports.filter((item) => item.type === type);
  return <div className="feature-workspace"><WorkspaceHeader eyebrow="报告管理" title={label} description="使用本机问题、文章、发布队列和收录记录生成可追溯报告。" onBack={onBack}>{busy ? <button onClick={onStop}>停止生成</button> : <button className="workspace-primary" onClick={() => void createReport()}><DashIcon name="robot" />用 M3 生成报告</button>}</WorkspaceHeader><WorkflowNotice />{error && <p role="alert" className="workspace-form-error geo-page-error">{error}</p>}<section className="geo-summary-grid">{[["知识资料", workflow.data.knowledge.length], ["搜索问题", workflow.data.questions.length], ["文章", workflow.data.articles.length], ["发布任务", workflow.data.publications.length], ["收录记录", workflow.data.indexing.length]].map(([name, value]) => <article key={name}><span>{name}</span><strong>{value}</strong></article>)}</section><section className="geo-record-panel geo-record-panel-wide"><header><h2>已生成报告</h2><span>{reports.length} 份</span></header>{reports.length ? <div className="geo-article-list">{reports.map((item) => <article key={item.id}><header><div><strong>{item.title}</strong><small>{formatDate(item.createdAt)}</small></div><RecordActions label={item.title} onRemove={() => workflow.remove("reports", item.id)} /></header><div className="geo-long-text">{item.content}</div></article>)}</div> : <EmptyState title={`暂无${label}`} description="点击右上角按钮，由 M3 根据本机业务记录生成。" />}</section></div>;
}

function summarize(data: GeoWorkflowData) {
  const included = data.indexing.filter((item) => item.status === "included").length;
  const missing = data.indexing.filter((item) => item.status === "not-found").length;
  return [`知识资料：${data.knowledge.length} 份`, `搜索问题：${data.questions.length} 条`, `文章：${data.articles.length} 篇`, `发布任务：${data.publications.length} 条`, `收录记录：${data.indexing.length} 条，其中已收录 ${included}、未发现 ${missing}`, `最近文章：${data.articles.slice(0, 8).map((item) => item.title).join("；") || "无"}`, `最近查询：${data.indexing.slice(0, 8).map((item) => `${item.platform}/${item.query}/${item.status}`).join("；") || "无"}`].join("\n");
}
