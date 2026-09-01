"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardDialog } from "@/components/dashboard-dialog";
import { DashIcon } from "@/components/dashboard-icons";
import { navigateToHash } from "@/lib/hash-navigation";
import type { Company, CompanyInput, GeoProject, ProjectInput } from "@/lib/workspace-data";

type CompanyDialogState = { mode: "add" } | { mode: "edit"; company: Company } | null;
type ProjectDialogState = { mode: "add" } | { mode: "edit"; project: GeoProject } | null;

function splitTags(value: string) {
  return [...new Set(value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "-" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function CompanyForm({ state, onClose, onSubmit, onAskAi }: { state: Exclude<CompanyDialogState, null>; onClose: () => void; onSubmit: (input: CompanyInput) => void; onAskAi: () => void }) {
  const company = state.mode === "edit" ? state.company : null;
  const [name, setName] = useState(company?.name || "");
  const [description, setDescription] = useState(company?.description || "");
  const [aliases, setAliases] = useState(company?.aliases.join("，") || "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (cleanName.length < 2 || cleanName.length > 50) { setError("公司名称长度应在 2 ~ 50 个字符。"); return; }
    if (!cleanDescription) { setError("请输入公司简介。"); return; }
    onSubmit({ name: cleanName, description: cleanDescription.slice(0, 200), aliases: splitTags(aliases) });
  }

  return <DashboardDialog label={state.mode === "add" ? "新增公司" : "编辑公司"} onClose={onClose} className="workspace-form-dialog" modal={false}>
    <form className="workspace-form" onSubmit={submit}>
      <header><div><h2>{state.mode === "add" ? "新增公司" : "编辑公司"}</h2><p>维护公司资料，让 AI 更准确地理解和描述公司。</p></div><div className="flex items-center gap-2"><button type="button" className="workspace-ai-button" onClick={onAskAi}><DashIcon name="robot" />AI 辅助填写</button><button type="button" aria-label="关闭" className="workspace-close" onClick={onClose}>×</button></div></header>
      <div className="workspace-form-body">
        <label><span>公司名称 <b>*</b></span><input autoFocus value={name} maxLength={50} onChange={(event) => setName(event.target.value)} placeholder="请输入公司名称" /></label>
        <label><span>公司简介 <b>*</b></span><textarea value={description} maxLength={200} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="请输入公司简介" /><small>{description.length} / 200</small></label>
        <label><span>公司别名</span><textarea value={aliases} rows={3} onChange={(event) => setAliases(event.target.value)} placeholder="输入简称、英文名或子品牌，使用逗号或换行分隔" /><small>用于补充公司的简称、英文名、子品牌、曾用名等关键词；当前仅作记录。</small></label>
        {error && <p className="workspace-form-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button className="modal-primary" type="submit">提交</button></footer>
    </form>
  </DashboardDialog>;
}

function ProjectForm({ state, companyName, onClose, onSubmit, onAskAi }: { state: Exclude<ProjectDialogState, null>; companyName: string; onClose: () => void; onSubmit: (input: ProjectInput) => void; onAskAi: () => void }) {
  const project = state.mode === "edit" ? state.project : null;
  const [name, setName] = useState(project?.name || "");
  const [type, setType] = useState<"product" | "ip">(project?.type || "product");
  const [keywords, setKeywords] = useState(project?.keywords.join("，") || "");
  const [targetWords, setTargetWords] = useState(project?.targetWords.join("，") || "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const keywordList = splitTags(keywords);
    const targetList = splitTags(targetWords);
    if (cleanName.length < 2 || cleanName.length > 50) { setError("GEO 项目名称长度应在 2 ~ 50 个字符。"); return; }
    if (!keywordList.length) { setError("请至少填写一个关键词。"); return; }
    if (!targetList.length) { setError("请至少填写一个品牌词。"); return; }
    onSubmit({ name: cleanName, type, keywords: keywordList, targetWords: targetList });
  }

  return <DashboardDialog label={state.mode === "add" ? "新增 GEO 项目" : "编辑 GEO 项目"} onClose={onClose} className="project-form-dialog" modal={false}>
    <form className="workspace-form project-form" onSubmit={submit}>
      <header><div><p className="workspace-eyebrow">当前公司 · {companyName}</p><h2>{state.mode === "add" ? "新增 GEO 项目" : "编辑 GEO 项目"}</h2><p>填写项目基础资料及 GEO 关键词。</p></div><div className="flex items-center gap-2"><button type="button" className="workspace-ai-button" onClick={onAskAi}><DashIcon name="robot" />AI 辅助填写</button><button type="button" aria-label="关闭" className="workspace-close" onClick={onClose}>×</button></div></header>
      <div className="workspace-form-body project-form-grid">
        <section><h3>基础信息</h3><p>定义项目名称与类型</p>
          <label><span>GEO 项目名称 <b>*</b></span><input autoFocus value={name} maxLength={50} onChange={(event) => setName(event.target.value)} placeholder="请输入 GEO 项目名称" /></label>
          <fieldset><legend>类型 <b>*</b></legend><div className="project-type-grid"><button type="button" className={type === "product" ? "is-selected" : ""} onClick={() => setType("product")}><strong>产品 / 工具</strong><span>适合产品、服务或工具</span></button><button type="button" className={type === "ip" ? "is-selected" : ""} onClick={() => setType("ip")}><strong>人物 / IP</strong><span>适合专家、创作者或品牌 IP</span></button></div></fieldset>
        </section>
        <section><h3>GEO 关键词</h3><p>用于内容创作和后续收录追踪</p>
          <label><span>关键词 <b>*</b></span><textarea value={keywords} rows={3} onChange={(event) => setKeywords(event.target.value)} placeholder="使用逗号或换行分隔多个关键词" /><small>用户搜索或向 AI 提问时可能使用的词。</small></label>
          <label><span>品牌词 <b>*</b></span><textarea value={targetWords} rows={3} onChange={(event) => setTargetWords(event.target.value)} placeholder="使用逗号或换行分隔多个品牌词" /><small>希望重点占据的搜索词或排名词。</small></label>
        </section>
        {error && <p className="workspace-form-error project-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button className="modal-primary" type="submit">提交</button></footer>
    </form>
  </DashboardDialog>;
}

export function CompanyWorkspace({ companies, selectedId, loaded, action, onSelect, onCreate, onUpdate, onDelete, onCreateProject, onUpdateProject, onDeleteProject, onAskAi }: {
  companies: Company[]; selectedId: string; loaded: boolean; action: string; onSelect: (id: string) => void;
  onCreate: (input: CompanyInput) => Company; onUpdate: (id: string, input: CompanyInput) => void; onDelete: (id: string) => void;
  onCreateProject: (companyId: string, input: ProjectInput) => GeoProject; onUpdateProject: (companyId: string, projectId: string, input: ProjectInput) => void; onDeleteProject: (companyId: string, projectId: string) => void; onAskAi: () => void;
}) {
  const [search, setSearch] = useState("");
  const [companyDialog, setCompanyDialog] = useState<CompanyDialogState>(null);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [continueWithProject, setContinueWithProject] = useState(false);
  const selected = companies.find((company) => company.id === selectedId) || companies[0] || null;
  const filtered = useMemo(() => companies.filter((company) => company.name.toLowerCase().includes(search.trim().toLowerCase())), [companies, search]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      if (action === "create") setCompanyDialog({ mode: "add" });
      if (action === "openProjectCreate") {
        if (selected) setProjectDialog({ mode: "add" });
        else { setContinueWithProject(true); setCompanyDialog({ mode: "add" }); }
      }
    });
    return () => window.clearTimeout(timer);
  }, [action, loaded, selected]);

  function clearAction() {
    if (window.location.hash.includes("?")) navigateToHash("#/company");
  }

  function saveCompany(input: CompanyInput) {
    if (companyDialog?.mode === "edit") onUpdate(companyDialog.company.id, input);
    else {
      const created = onCreate(input);
      if (continueWithProject) { setContinueWithProject(false); setCompanyDialog(null); onSelect(created.id); setProjectDialog({ mode: "add" }); return; }
    }
    setCompanyDialog(null);
    clearAction();
  }

  function saveProject(input: ProjectInput) {
    if (!selected) return;
    if (projectDialog?.mode === "edit") onUpdateProject(selected.id, projectDialog.project.id, input);
    else onCreateProject(selected.id, input);
    setProjectDialog(null);
    clearAction();
  }

  return <div className="company-workspace">
    <section className="company-list-panel">
      <header><div><h1>公司</h1><span>{companies.length}</span></div><button className="workspace-primary" onClick={() => setCompanyDialog({ mode: "add" })}><DashIcon name="plus" />新增</button></header>
      <label className="company-search"><DashIcon name="search" /><input aria-label="搜索公司" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索公司" /></label>
      <div className="company-list" aria-busy={!loaded}>{!loaded ? <p className="workspace-empty">加载中...</p> : filtered.length ? filtered.map((company) => <button key={company.id} className={selected?.id === company.id ? "is-active" : ""} onClick={() => onSelect(company.id)}><span><strong>{company.name}</strong><small>{company.projects.length} 个 GEO 项目</small></span><DashIcon name="chevronRight" /></button>) : <div className="workspace-empty"><DashIcon name="building" /><strong>{search ? "没有找到相关公司" : "暂无公司"}</strong><p>{search ? "换一个名称再试试" : "点击“新增”创建第一家公司"}</p></div>}</div>
      {!!companies.length && <p className="company-total">共 {companies.length} 家公司</p>}
    </section>
    <section className="company-detail-panel">{selected ? <>
      <header><div><p className="workspace-eyebrow">公司详情</p><h2>{selected.name}</h2></div><div><button onClick={() => setCompanyDialog({ mode: "edit", company: selected })}><DashIcon name="edit" />编辑公司</button><button className="workspace-danger" onClick={() => { if (window.confirm(`确定删除公司“${selected.name}”吗？`)) onDelete(selected.id); }}><DashIcon name="trash" />删除</button></div></header>
      <div className="company-description"><p>{selected.description}</p>{selected.aliases.length > 0 && <div>{selected.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div>}<small>创建 {formatDate(selected.createdAt)} · 更新 {formatDate(selected.updatedAt)}</small></div>
      <section className="project-panel"><header><div><h3>GEO 项目</h3><p>该公司下的项目会用于文章创作与收录追踪</p></div><button className="workspace-primary" onClick={() => setProjectDialog({ mode: "add" })}><DashIcon name="plus" />新增 GEO 项目</button></header>
        {selected.projects.length ? <div className="project-table">{selected.projects.map((project) => <article key={project.id}><div><strong>{project.name}</strong><span>{project.type === "product" ? "产品 / 工具" : "人物 / IP"}</span></div><p>关键词：{project.keywords.join("、")}</p><p>品牌词：{project.targetWords.join("、")}</p><footer><button onClick={() => setProjectDialog({ mode: "edit", project })}>编辑</button><button onClick={() => { if (window.confirm(`确定删除 GEO 项目“${project.name}”吗？`)) onDeleteProject(selected.id, project.id); }}>删除</button></footer></article>)}</div> : <div className="workspace-empty project-empty"><DashIcon name="project" /><strong>暂无 GEO 项目</strong><p>新增项目后，可以继续添加知识库和生成内容。</p><button className="workspace-primary" onClick={() => setProjectDialog({ mode: "add" })}>新增 GEO 项目</button></div>}
      </section>
    </> : <div className="workspace-empty company-detail-empty"><DashIcon name="building" /><strong>还没有公司</strong><p>先创建一家公司，再继续配置 GEO 项目和知识资料。</p><button className="workspace-primary" onClick={() => setCompanyDialog({ mode: "add" })}>新增公司</button></div>}</section>
    {companyDialog && <CompanyForm state={companyDialog} onClose={() => { setCompanyDialog(null); setContinueWithProject(false); clearAction(); }} onSubmit={saveCompany} onAskAi={onAskAi} />}
    {projectDialog && selected && <ProjectForm state={projectDialog} companyName={selected.name} onClose={() => { setProjectDialog(null); clearAction(); }} onSubmit={saveProject} onAskAi={onAskAi} />}
  </div>;
}
