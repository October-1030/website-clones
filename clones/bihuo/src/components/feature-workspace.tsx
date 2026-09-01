"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DashboardDialog } from "@/components/dashboard-dialog";
import { DashIcon } from "@/components/dashboard-icons";
import { featureRoutes, integrationRequirements } from "@/lib/workspace-data";

interface LocalRecord { id: string; name: string; description: string; createdAt: string }

export function FeatureWorkspace({ route, onBack }: { route: string; onBack: () => void }) {
  const config = featureRoutes[route] || { title: "功能页面", description: "该入口已按原站路由恢复。", action: "新增记录" };
  const listTitle = config.title.endsWith("记录") ? `${config.title}列表` : `${config.title}记录`;
  const storageKey = `bihuo-feature-${route.replace(/[^a-z-]/g, "")}`;
  const requirements = integrationRequirements[route] || [];
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(saved)) setRecords(saved.filter((item): item is LocalRecord => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).name === "string" && typeof (item as Record<string, unknown>).description === "string" && typeof (item as Record<string, unknown>).createdAt === "string"));
      } catch { /* Start empty if local data is invalid. */ }
      setLoaded(true);
    });
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify(records)); }, [loaded, records, storageKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("请填写名称。"); return; }
    setRecords((items) => [{ id: crypto.randomUUID(), name: name.trim(), description: description.trim(), createdAt: new Date().toISOString() }, ...items]);
    setDialog(false); setName(""); setDescription(""); setError("");
  }

  return <div className="feature-workspace">
    <header className="feature-workspace-header"><div><button onClick={onBack}><DashIcon name="arrowRight" className="rotate-180" />返回工作台</button><p>业务工作区</p><h1>{config.title}</h1><span>{config.description}</span></div><button className="workspace-primary" disabled={!loaded} onClick={() => setDialog(true)}><DashIcon name="plus" />{loaded ? config.action : "加载中..."}</button></header>
    <section className={`feature-notice ${requirements.length ? "is-warning" : ""}`}><DashIcon name="info" /><div><p>{requirements.length ? "该模块需要外部服务才能执行生产操作。当前可记录配置和任务说明，不会伪造执行结果。" : "页面路由与本机交互已恢复；这里保存的是本机数据。"}</p>{requirements.length > 0 && <ul className="integration-requirements">{requirements.map((item) => <li key={item}>{item}</li>)}</ul>}</div></section>
    <section className="feature-list-card" aria-busy={!loaded}><header><h2>{listTitle}</h2><span>{records.length} 条</span></header>{!loaded ? <div className="workspace-empty feature-empty"><DashIcon name="refresh" /><strong>加载中...</strong></div> : records.length ? <div className="feature-records">{records.map((record) => <article key={record.id}><div><strong>{record.name}</strong><small>{new Date(record.createdAt).toLocaleString("zh-CN")}</small></div><p>{record.description || "暂无说明"}</p><button onClick={() => { if (window.confirm(`确定删除“${record.name}”吗？`)) setRecords((items) => items.filter((item) => item.id !== record.id)); }}>删除</button></article>)}</div> : <div className="workspace-empty feature-empty"><DashIcon name="folder" /><strong>暂无记录</strong><p>点击右上角“{config.action}”开始。</p></div>}</section>
    {dialog && <DashboardDialog label={config.action} onClose={() => setDialog(false)} className="workspace-form-dialog"><form className="workspace-form" onSubmit={submit}><header><div><h2>{config.action}</h2><p>{config.description}</p></div><button type="button" aria-label="关闭" className="workspace-close" onClick={() => setDialog(false)}>×</button></header><div className="workspace-form-body"><label><span>名称 <b>*</b></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={`请输入${config.action}名称`} /></label><label><span>说明</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="补充相关内容或说明" /></label>{error && <p className="workspace-form-error" role="alert">{error}</p>}</div><footer><button type="button" onClick={() => setDialog(false)}>取消</button><button type="submit" className="modal-primary">保存</button></footer></form></DashboardDialog>}
  </div>;
}
