"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { DashboardAssistant } from "@/components/dashboard-assistant";
import { CompanyWorkspace } from "@/components/company-workspace";
import { DashboardDialog } from "@/components/dashboard-dialog";
import { DashIcon, type DashIconName } from "@/components/dashboard-icons";
import { FeatureWorkspace } from "@/components/feature-workspace";
import { GeoContentWorkspace } from "@/components/geo-content-workspace";
import { DashboardOverview } from "@/components/dashboard-overview";
import { DashboardTutorial } from "@/components/dashboard-tutorial";
import { DashboardFooter, DashboardWorkflow } from "@/components/dashboard-workflow";
import { MonthlyTrend } from "@/components/monthly-trend";
import { useLocalWorkspace } from "@/hooks/use-local-workspace";
import { useGeoWorkflow } from "@/hooks/use-geo-workflow";
import { downloadTools, navigationGroups, workflow } from "@/lib/dashboard-data";
import { navigateToHash } from "@/lib/hash-navigation";
import { featureRoutes, navigationRoutes, workflowRoutes } from "@/lib/workspace-data";

const geoContentRoutes = new Set(["#/knowledge", "#/question-task", "#/questions", "#/prompt", "#/article-task", "#/article", "#/publication-task", "#/collected-history", "#/diagnosis-report", "#/monitor-report"]);

const rootNavigation: { name: string; icon: DashIconName }[] = [
  { name: "仪表盘", icon: "dashboard" }, { name: "AI 助手", icon: "robot" },
  { name: "品牌管理", icon: "building" }, { name: "知识库", icon: "book" },
];

function EmptyAnnouncement() {
  return <div className="announcement-empty"><span><DashIcon name="announcement" /></span><strong>暂无公告</strong><p>系统维护、产品更新与政策变化会在这里通知你</p></div>;
}

export function DashboardApp({ route }: { route: string }) {
  const [expandedGroup, setExpandedGroup] = useState("");
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [menu, setMenu] = useState("");
  const [modal, setModal] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("简体中文");
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");
  const main = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const workspace = useLocalWorkspace();
  const geoWorkflow = useGeoWorkflow();
  const routePath = route.split("?")[0];
  const routeAction = new URLSearchParams(route.split("?")[1] || "").get("action") || "";
  const selectedCompany = workspace.companies.find((company) => company.id === workspace.selectedCompanyId) || workspace.companies[0] || null;
  const pageTitle = routePath === "#/company" ? "公司管理" : featureRoutes[routePath]?.title || "仪表盘";

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!menu) return;
    function dismiss(event: PointerEvent) { if (event.target instanceof Node && !header.current?.contains(event.target)) setMenu(""); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setMenu(""); }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [menu]);

  function openAction(name: string) {
    setMobileNavigation(false);
    setMenu("");
    if (name === "仪表盘") { setModal(""); navigateToHash("#/dashboard"); main.current?.scrollTo({ top: 0, behavior: "smooth" }); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (name === "AI 助手") { setModal(""); setAssistant(true); return; }
    const target = workflowRoutes[name] || navigationRoutes[name];
    if (target) { setModal(""); navigateToHash(target); return; }
    setModal(name);
  }

  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setToast("当前浏览器不支持全屏，请使用浏览器的全屏功能。"); }
  }

  const actionDescription = workflow.flatMap((phase) => phase.steps).find((step) => step.name === modal)?.description;
  const isDownload = downloadTools.some((tool) => tool.title === modal);
  const searchItems = [...new Set([...rootNavigation.map((item) => item.name), ...navigationGroups.flatMap((group) => group.children), ...workflow.flatMap((phase) => phase.steps.map((step) => step.name))])].filter((item) => item.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className={`dashboard dashboard-layout ${assistant ? "with-assistant" : ""}`}>
      {mobileNavigation && <button aria-label="关闭菜单" className="navigation-backdrop" onClick={() => setMobileNavigation(false)} />}
      <aside className={`dashboard-sidebar ${mobileNavigation ? "is-open" : ""}`}>
        <nav aria-label="功能菜单导航">
          <div className="nav-brand"><Image src="/seo/favicon.ico" alt="logo" width={30} height={30} unoptimized /><p>必火GEO营销</p><button className="nav-mobile-close" aria-label="关闭菜单" onClick={() => setMobileNavigation(false)}>×</button></div>
          <div className="nav-scroll">
            {rootNavigation.map((item) => { const active = item.name === "仪表盘" ? routePath === "#/dashboard" : navigationRoutes[item.name] === routePath; return <button className={`nav-root ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} key={item.name} onClick={() => openAction(item.name)}><DashIcon name={item.icon} className="nav-icon" /><span>{item.name}</span></button>; })}
            {navigationGroups.map((group) => <div key={group.name}><button className="nav-group" aria-expanded={expandedGroup === group.name} onClick={() => setExpandedGroup(expandedGroup === group.name ? "" : group.name)}><DashIcon name={group.icon} className="nav-marker" /><span>{group.name}</span><DashIcon name="chevronDown" className={`nav-chevron ${expandedGroup === group.name ? "rotate-180" : ""}`} /></button>{expandedGroup === group.name && <div className="nav-children">{group.children.map((child) => <button key={child} onClick={() => openAction(child)}>{child}</button>)}</div>}</div>)}
          </div>
        </nav>
      </aside>
      <main className="dashboard-main" ref={main}>
        <header className="dashboard-header" ref={header}>
          <button className="mobile-menu-button" aria-label="打开菜单" onClick={() => setMobileNavigation(true)}><DashIcon name="help" /></button>
          <nav aria-label="breadcrumb" className="dashboard-breadcrumb">{pageTitle}</nav>
          <div className="relative mr-auto"><button className="company-switch" onClick={() => setMenu(menu === "company" ? "" : "company")}>{selectedCompany?.name || "请选择公司"}<DashIcon name="chevronDown" /></button>{menu === "company" && <div className="header-menu company-menu">{workspace.companies.length ? workspace.companies.map((company) => <button key={company.id} onClick={() => { workspace.setSelectedCompanyId(company.id); setMenu(""); }}>{company.name}<span>{company.id === selectedCompany?.id ? "✓" : ""}</span></button>) : <p className="p-4 text-center text-[13px] text-(--ink-400)">暂无公司</p>}<button onClick={() => openAction("添加公司")}>＋ 添加公司</button></div>}</div>
          <div className="header-actions">
            <button className="header-icon desktop-icon" title="刷新" aria-label="刷新" onClick={() => { setRefreshKey((key) => key + 1); setToast("数据已刷新"); }}><DashIcon name="refresh" /></button>
            <button className="header-icon" title="搜索" aria-label="搜索" onClick={() => { setSearch(""); setModal("搜索"); }}><DashIcon name="search" /></button>
            <button className="header-icon desktop-icon" title="全屏" aria-label="全屏" onClick={toggleFullscreen}><DashIcon name="fullscreen" /></button>
            <button className="header-icon" title="通知" aria-label="通知" onClick={() => setMenu(menu === "notifications" ? "" : "notifications")}><DashIcon name="bell" /></button>
            <button className="header-icon" title="公告" aria-label="公告" onClick={() => setMenu(menu === "announcement" ? "" : "announcement")}><DashIcon name="announcement" /></button>
            <button className="header-icon" title="语言" aria-label="语言" onClick={() => setMenu(menu === "language" ? "" : "language")}><DashIcon name="globe" /></button>
            <button className="header-icon" title="设置" aria-label="设置" onClick={() => setModal("界面设置")}><DashIcon name="gear" /></button>
            <button className="header-avatar" aria-label="账户菜单" onClick={() => setMenu(menu === "profile" ? "" : "profile")}><Image src="/images/avatar.png" alt="avatar" width={32} height={32} unoptimized /></button>
          </div>
          {menu === "announcement" && <div className="header-menu announcement-menu"><header><strong>公告</strong><button disabled>全部标为已读</button></header><EmptyAnnouncement /><footer><button onClick={() => { setMenu(""); setModal("全部公告"); }}>查看全部公告<DashIcon name="arrowRight" /></button></footer></div>}
          {menu === "notifications" && <div className="header-menu notification-menu"><strong className="block border-b border-(--line) p-4 text-[14px]">通知</strong><p className="p-10 text-center text-[13px] text-(--ink-400)">暂无通知</p></div>}
          {menu === "language" && <div className="header-menu language-menu">{["简体中文", "English", "繁體中文"].map((item) => <button key={item} onClick={() => { setLanguage(item); setMenu(""); setToast(`${item} · 仪表盘保留原站中文内容`); }}>{item}<span>{language === item ? "✓" : ""}</span></button>)}</div>}
          {menu === "profile" && <div className="header-menu profile-menu"><p className="border-b border-(--line) px-4 py-3 text-[12px] text-(--ink-400)">本地演示账户</p><button onClick={() => { setMenu(""); setModal("账户信息"); }}>账户信息</button><a href="#/auth/login">退出登录</a></div>}
        </header>
        {routePath === "#/dashboard" ? <div className="dashboard-content" key={refreshKey}>
          <DashboardOverview companies={workspace.companies.map((company) => company.name)} metrics={{ questions: geoWorkflow.data.questions.length, articles: geoWorkflow.data.articles.length, published: 0, indexChecks: geoWorkflow.data.indexing.length, citations: geoWorkflow.data.indexing.filter((item) => item.status === "included" && item.articleId).length }} />
          <DashboardWorkflow onTutorial={() => setTutorial(true)} onAction={openAction} />
          <DashboardAnalytics platformCounts={geoWorkflow.data.indexing.filter((item) => item.status === "included").reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.platform]: (counts[item.platform] || 0) + 1 }), {})} />
          <MonthlyTrend />
          <DashboardFooter onAction={openAction} onTutorial={() => setTutorial(true)} />
        </div> : routePath === "#/company" ? <CompanyWorkspace companies={workspace.companies} selectedId={workspace.selectedCompanyId} loaded={workspace.loaded} action={routeAction} onSelect={workspace.setSelectedCompanyId} onCreate={workspace.createCompany} onUpdate={workspace.updateCompany} onDelete={workspace.deleteCompany} onCreateProject={workspace.createProject} onUpdateProject={workspace.updateProject} onDeleteProject={workspace.deleteProject} onAskAi={() => setAssistant(true)} /> : geoContentRoutes.has(routePath) ? <GeoContentWorkspace key={routePath} route={routePath} companies={workspace.companies} selectedCompanyId={workspace.selectedCompanyId} onSelectCompany={workspace.setSelectedCompanyId} onBack={() => navigateToHash("#/dashboard")} workflow={geoWorkflow} /> : <FeatureWorkspace key={routePath} route={routePath} onBack={() => navigateToHash("#/dashboard")} />}
      </main>
      <button className="floating-help" aria-label="帮助与教程" title="帮助与教程" onClick={() => setTutorial(true)}><DashIcon name="help" /></button>
      {!assistant && <button className="floating-assistant" aria-label="GEO 助手" onClick={() => setAssistant(true)}><Image src="/images/geo-agent-CtRbLfrG.png" alt="GEO 助手" width={51} height={70} loading="eager" unoptimized /></button>}
      <DashboardAssistant
        isOpen={assistant}
        companies={workspace.companies.map((company) => ({ id: company.id, name: company.name, projects: company.projects.map((project) => ({ id: project.id, name: project.name })) }))}
        selectedCompanyId={selectedCompany?.id}
        onSelectCompany={workspace.setSelectedCompanyId}
        onClose={() => setAssistant(false)}
        onTutorial={() => setTutorial(true)}
      />
      {tutorial && <DashboardTutorial onClose={() => setTutorial(false)} />}
      {toast && <div role="status" className="dashboard-toast">{toast}</div>}
      {modal && <DashboardDialog onClose={() => setModal("")} label={modal}><div className="local-modal"><header><h2>{modal}</h2><button aria-label="关闭" onClick={() => setModal("")}>×</button></header>{modal === "搜索" ? <><input autoFocus aria-label="搜索功能" placeholder="搜索功能、页面..." value={search} onChange={(event) => setSearch(event.target.value)} className="dashboard-search" /><div className="search-results">{searchItems.length ? searchItems.map((item) => <button key={item} onClick={() => openAction(item)}><DashIcon name="search" />{item}<DashIcon name="chevronRight" /></button>) : <p>未找到相关功能</p>}</div></> : modal === "全部公告" ? <EmptyAnnouncement /> : <><div className="local-modal-content"><span className="local-demo-badge">本地前端演示</span><p>{isDownload ? "已复刻原站工具下载入口和版本信息。安装包未包含在此项目中，请到原站确认并下载官方版本。" : actionDescription || "此入口已保留在导航中。当前克隆范围为仪表盘、登录与注册页面。"}</p><p className="text-(--ink-400)">{isDownload ? "本地站点不会自动下载或运行任何软件。" : "尚未连接业务后台，不会提交公司资料、发布内容或产生费用。"}</p></div><footer><button onClick={() => { setModal(""); setTutorial(true); }}>查看使用教程</button><button className="modal-primary" onClick={() => setModal("")}>知道了</button></footer></>}</div></DashboardDialog>}
    </div>
  );
}
