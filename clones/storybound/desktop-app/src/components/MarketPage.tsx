import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  importLocalMarketItems,
  marketStoreEvent,
  readInstalledMarketIds,
  readLocalMarketItems,
  readMarketInstalledAt,
  readMarketItems,
  removeLocalMarketItem,
  upsertLocalMarketItem,
  writeInstalledMarketIds,
  type MarketItem,
  type MarketKind,
} from "../lib/market-store";
import "./MarketPage.css";

type MarketTab = "discover" | "mine";
type MineTab = "installed" | "local" | "private";
type MarketSort = "newest" | "name";

interface MarketDraft {
  id: string;
  kind: MarketKind;
  name: string;
  description: string;
  track: string;
  author: string;
  version: string;
  tags: string;
  applyValue: string;
}

const kindLabels: Record<MarketKind, string> = {
  prompt: "提示词模板",
  style: "画面风格",
  cover: "封面海报模板",
};

const emptyDraft: MarketDraft = {
  id: "",
  kind: "prompt",
  name: "",
  description: "",
  track: "通用",
  author: "本地导入",
  version: "1.0.0",
  tags: "",
  applyValue: "",
};

function applyLabel(item: MarketItem): string {
  if (item.apply.track) return `任务赛道：${item.apply.track}`;
  if (item.apply.visualStyle) return `画面风格：${item.apply.visualStyle}`;
  if (item.apply.coverTemplateId) return `封面模板：${item.apply.coverTemplateId}`;
  return "未配置应用参数";
}

function sourceLabel(item: MarketItem): string {
  return item.origin === "bundled" ? "本地内置" : "本地导入";
}

function draftFromItem(item: MarketItem): MarketDraft {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    description: item.description,
    track: item.track,
    author: item.author,
    version: item.version,
    tags: item.tags.join("，"),
    applyValue: item.apply.track || item.apply.visualStyle || item.apply.coverTemplateId || "",
  };
}

export function MarketPage() {
  const [tab, setTab] = useState<MarketTab>("discover");
  const [mineTab, setMineTab] = useState<MineTab>("installed");
  const [kind, setKind] = useState<MarketKind | "all">("all");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [track, setTrack] = useState("all");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<MarketItem[]>(readMarketItems);
  const [installedIds, setInstalledIds] = useState<string[]>(readInstalledMarketIds);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<MarketDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [showPrivateDetail, setShowPrivateDetail] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const refreshStore = () => {
    setCatalog(readMarketItems());
    setInstalledIds(readInstalledMarketIds());
  };

  useEffect(() => {
    window.addEventListener(marketStoreEvent, refreshStore);
    window.addEventListener("storage", refreshStore);
    return () => {
      window.removeEventListener(marketStoreEvent, refreshStore);
      window.removeEventListener("storage", refreshStore);
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (draft) setDraft(null);
      else if (showPrivateDetail) setShowPrivateDetail(false);
      else setSelectedId("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [draft, showPrivateDetail]);

  const trackOptions = useMemo(
    () => [...new Set(catalog.filter((item) => item.kind === "prompt").map((item) => item.track).filter(Boolean))],
    [catalog],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    let items = catalog;
    if (tab === "mine" && mineTab === "installed") {
      items = items.filter((item) => installedIds.includes(item.id));
    } else if (tab === "mine" && mineTab === "local") {
      items = items.filter((item) => item.origin === "local-import");
    }
    return items
      .filter((item) => kind === "all" || item.kind === kind)
      .filter((item) => track === "all" || item.track === track)
      .filter((item) => !normalizedQuery || [item.name, item.description, item.track, item.author, ...item.tags]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery))
      .toSorted((left, right) => sort === "name"
        ? left.name.localeCompare(right.name, "zh-CN")
        : right.updatedAt.localeCompare(left.updatedAt));
  }, [catalog, installedIds, kind, mineTab, query, sort, tab, track]);

  const selectedItem = catalog.find((item) => item.id === selectedId) ?? null;

  function toggleInstalled(item: MarketItem): void {
    const installed = installedIds.includes(item.id);
    const next = installed
      ? installedIds.filter((id) => id !== item.id)
      : [...installedIds, item.id];
    try {
      writeInstalledMarketIds(next);
      setInstalledIds(next);
      setNotice(installed
        ? `已从本地任务资源中移除“${item.name}”。`
        : `已安装“${item.name}”；创建任务页和对应实验室会立即读取这个本地资源。`);
    } catch {
      setNotice("本地安装状态写入失败，请检查浏览器存储空间。");
    }
  }

  function openNewItem(): void {
    setDraft(emptyDraft);
  }

  function openEditItem(item: MarketItem): void {
    if (item.origin !== "local-import") {
      setNotice("本地内置资源保持只读；可以导入一个同类型资源进行自定义。");
      return;
    }
    setDraft(draftFromItem(item));
  }

  function saveLocalItem(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!draft) return;
    const apply = draft.kind === "prompt"
      ? { track: draft.applyValue.trim() }
      : draft.kind === "style"
        ? { visualStyle: draft.applyValue.trim() }
        : { coverTemplateId: draft.applyValue.trim() };
    try {
      const saved = upsertLocalMarketItem({
        id: draft.id || undefined,
        kind: draft.kind,
        name: draft.name,
        description: draft.description,
        track: draft.track,
        author: draft.author,
        version: draft.version,
        tags: draft.tags,
        apply,
      });
      refreshStore();
      setDraft(null);
      setSelectedId(saved.id);
      setNotice(`“${saved.name}”已保存到本地资源库，没有发布或上传到原站。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "本地资源保存失败。");
    }
  }

  async function importItems(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const imported = importLocalMarketItems(parsed);
      refreshStore();
      setTab("mine");
      setMineTab("local");
      setNotice(`已从 ${file.name} 导入 ${imported.length} 个本地资源；未执行购买或发布。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败，请检查 JSON 格式。");
    }
    event.target.value = "";
  }

  function deleteLocalItem(item: MarketItem): void {
    if (item.origin !== "local-import") return;
    if (!window.confirm(`删除本地资源“${item.name}”？已安装状态也会一并移除。`)) return;
    removeLocalMarketItem(item.id);
    refreshStore();
    setSelectedId("");
    setNotice(`已删除本地资源“${item.name}”。`);
  }

  const showingPrivatePanel = tab === "mine" && mineTab === "private";

  return (
    <main className="market-page">
      <header className="market-page__hero">
        <div>
          <span className="market-page__eyebrow">LOCAL CREATION MARKET</span>
          <h1>创作市场</h1>
          <p>保留 v1.17 的市场大厅、我的市场、类型筛选和资源详情；本版本只安装本地资源，不伪造原站积分、兑换或发布。</p>
        </div>
        <div className="market-page__hero-actions">
          <button type="button" className="market-secondary" onClick={() => importInputRef.current?.click()}>导入本地资源</button>
          <input ref={importInputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importItems(event)} />
          <button type="button" className="market-primary" onClick={openNewItem}>＋ 新建本地资源</button>
        </div>
      </header>

      <section className="market-dependency" aria-label="原站服务状态">
        <div><strong>原版市场服务未连接</strong><span>积分余额、免费试用、兑换订单、作者上架与审核都依赖原站私有后端。</span></div>
        <button type="button" onClick={() => setShowPrivateDetail(true)}>查看不可用边界</button>
      </section>

      {notice ? <div className="market-notice" role="status"><span>{notice}</span><button type="button" aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div> : null}

      <section className="market-page__nav">
        <div className="market-page__tabs" role="tablist">
          <button className={tab === "discover" ? "is-active" : ""} onClick={() => setTab("discover")} role="tab" type="button">市场大厅</button>
          <button className={tab === "mine" ? "is-active" : ""} onClick={() => setTab("mine")} role="tab" type="button">我的市场 <b>{installedIds.length}</b></button>
        </div>
        {tab === "mine" ? (
          <div className="market-page__subtabs" role="tablist">
            <button className={mineTab === "installed" ? "is-active" : ""} onClick={() => setMineTab("installed")} type="button">已安装 {installedIds.length}</button>
            <button className={mineTab === "local" ? "is-active" : ""} onClick={() => setMineTab("local")} type="button">本地资源 {readLocalMarketItems().length}</button>
            <button className={mineTab === "private" ? "is-active" : ""} onClick={() => setMineTab("private")} type="button">原站交易/发布</button>
          </div>
        ) : null}
      </section>

      {!showingPrivatePanel ? (
        <section className="market-toolbar" aria-label="市场筛选">
          <div className="market-toolbar__types">
            <button className={kind === "all" ? "is-active" : ""} onClick={() => { setKind("all"); setTrack("all"); }} type="button">全部 <small>{catalog.length}</small></button>
            {(Object.keys(kindLabels) as MarketKind[]).map((value) => (
              <button className={kind === value ? "is-active" : ""} key={value} onClick={() => { setKind(value); if (value !== "prompt") setTrack("all"); }} type="button">{kindLabels[value]} <small>{catalog.filter((item) => item.kind === value).length}</small></button>
            ))}
          </div>
          <div className="market-toolbar__search">
            {(kind === "all" || kind === "prompt") ? <select aria-label="适用赛道" value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">全部赛道</option>{trackOptions.map((value) => <option value={value} key={value}>{value}</option>)}</select> : null}
            <select aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value as MarketSort)}><option value="newest">最近更新</option><option value="name">名称排序</option></select>
            <input aria-label="搜索市场" placeholder="搜标题 / 简介 / 作者" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </section>
      ) : null}

      {showingPrivatePanel ? (
        <section className="market-private-panel">
          <span aria-hidden="true">◇</span>
          <h2>原站交易与发布当前不可用</h2>
          <p>这里不显示虚构余额、订单、销量或收益，也不会把“本地保存”伪装成“上架成功”。如将来接入合法的原站授权服务，可恢复我的上架、我的兑换与激励明细。</p>
          <dl><div><dt>积分与兑换</dt><dd>缺少原站账户、授权和市场 API</dd></div><div><dt>试用</dt><dd>缺少原站试用授权与安装载荷</dd></div><div><dt>发布审核</dt><dd>缺少上传、审核、定价和结算服务</dd></div></dl>
          <button type="button" className="market-primary" onClick={openNewItem}>改为创建本地资源</button>
        </section>
      ) : visibleItems.length ? (
        <section className="market-grid">
          {visibleItems.map((item) => {
            const installed = installedIds.includes(item.id);
            return (
              <article className="market-card" key={item.id}>
                <button className="market-card__open" type="button" onClick={() => setSelectedId(item.id)} aria-label={`查看${item.name}详情`}>
                  <div className="market-card__cover" data-kind={item.kind}><span>{kindLabels[item.kind]}</span><strong>{item.name.slice(0, 2)}</strong><em>{sourceLabel(item)}</em></div>
                  <div className="market-card__body">
                    <div className="market-card__meta"><span>{item.track}</span><span>v{item.version}</span></div>
                    <h2>{item.name}</h2>
                    <p>{item.description}</p>
                    <div className="market-card__tags">{item.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <small>{item.author}</small>
                  </div>
                </button>
                <footer>
                  <span className={installed ? "is-installed" : ""}>{installed ? "已安装到本机" : "未安装"}</span>
                  {item.origin === "local-import" ? <button type="button" onClick={() => openEditItem(item)}>编辑</button> : null}
                  <button className={installed ? "market-remove" : "market-install"} onClick={() => toggleInstalled(item)} type="button">{installed ? "移除" : "安装到本地"}</button>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="market-empty">
          <strong>{tab === "mine" && mineTab === "installed" ? "还没有安装本地资源" : tab === "mine" ? "还没有导入本地资源" : "没有匹配的资源"}</strong>
          <p>{tab === "mine" ? "可从市场大厅安装内置资源，或导入自己的 JSON 资源文件。" : "换个关键词、类型或赛道再试。"}</p>
          {tab === "mine" ? <button type="button" className="market-primary" onClick={() => setTab("discover")}>去市场大厅</button> : null}
        </div>
      )}

      {selectedItem ? (
        <div className="market-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}>
          <aside className="market-detail" role="dialog" aria-modal="true" aria-labelledby="market-detail-title">
            <header><div><span>{kindLabels[selectedItem.kind]}</span><h2 id="market-detail-title">{selectedItem.name}</h2></div><button type="button" aria-label="关闭详情" onClick={() => setSelectedId("")}>×</button></header>
            <div className="market-detail__cover" data-kind={selectedItem.kind}><strong>{selectedItem.name.slice(0, 2)}</strong><span>{sourceLabel(selectedItem)}</span></div>
            <div className="market-detail__meta"><span>{selectedItem.author}</span><span>版本 {selectedItem.version}</span><span>{selectedItem.track}</span></div>
            <section><h3>简介</h3><p>{selectedItem.description}</p></section>
            <section><h3>安装后应用</h3><p>{applyLabel(selectedItem)}</p></section>
            <section><h3>本地状态</h3><p>{installedIds.includes(selectedItem.id) ? `已安装${readMarketInstalledAt(selectedItem.id) ? ` · ${new Date(readMarketInstalledAt(selectedItem.id)).toLocaleString("zh-CN")}` : ""}` : "尚未安装"}</p></section>
            <div className="market-detail__boundary"><strong>不包含原站交易</strong><p>当前资源来自本地内置或本地导入；没有扣积分、购买记录、试用授权、远程更新或收益。</p></div>
            <footer>
              {selectedItem.origin === "local-import" ? <button type="button" className="market-danger" onClick={() => deleteLocalItem(selectedItem)}>删除本地资源</button> : null}
              {selectedItem.origin === "local-import" ? <button type="button" className="market-secondary" onClick={() => openEditItem(selectedItem)}>编辑</button> : null}
              <button type="button" className={installedIds.includes(selectedItem.id) ? "market-secondary" : "market-primary"} onClick={() => toggleInstalled(selectedItem)}>{installedIds.includes(selectedItem.id) ? "从本机移除" : "安装并交接到任务流程"}</button>
            </footer>
          </aside>
        </div>
      ) : null}

      {draft ? (
        <div className="market-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
          <form className="market-editor" onSubmit={saveLocalItem} role="dialog" aria-modal="true" aria-labelledby="market-editor-title">
            <header><div><span>LOCAL RESOURCE</span><h2 id="market-editor-title">{draft.id ? "编辑本地资源" : "新建本地资源"}</h2><p>只写入本机浏览器存储，不会发布到原站。</p></div><button type="button" aria-label="关闭编辑器" onClick={() => setDraft(null)}>×</button></header>
            <div className="market-editor__grid">
              <label>资源类型<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MarketKind, applyValue: "" })}><option value="prompt">提示词模板</option><option value="style">画面风格</option><option value="cover">封面海报模板</option></select></label>
              <label>版本<input required value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} /></label>
              <label className="market-editor__wide">名称 *<input required maxLength={40} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>作者<input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} /></label>
              <label>适用赛道<input value={draft.track} onChange={(event) => setDraft({ ...draft, track: event.target.value })} /></label>
              <label className="market-editor__wide">{draft.kind === "prompt" ? "交接到任务赛道 *" : draft.kind === "style" ? "交接到画面风格 *" : "交接到封面模板 ID *"}<input required value={draft.applyValue} onChange={(event) => setDraft({ ...draft, applyValue: event.target.value })} placeholder={draft.kind === "prompt" ? "如：人物故事" : draft.kind === "style" ? "如：中国水墨" : "如：typographic-impact"} /></label>
              <label className="market-editor__wide">简介<textarea required rows={4} maxLength={300} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="market-editor__wide">标签<input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="用逗号分隔" /></label>
            </div>
            <div className="market-editor__notice">保存代表“添加到本地资源库”，不代表原站上架、过审、可售或获得积分。</div>
            <footer><button type="button" className="market-secondary" onClick={() => setDraft(null)}>取消</button><button type="submit" className="market-primary">保存到本地</button></footer>
          </form>
        </div>
      ) : null}

      {showPrivateDetail ? (
        <div className="market-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPrivateDetail(false); }}>
          <section className="market-boundary-modal" role="dialog" aria-modal="true" aria-labelledby="market-boundary-title">
            <header><h2 id="market-boundary-title">原版私有依赖边界</h2><button type="button" aria-label="关闭说明" onClick={() => setShowPrivateDetail(false)}>×</button></header>
            <p>v1.17 原版通过账户、设备指纹和市场 API 获取作品、余额、购买记录与发布状态。本克隆没有这些合法授权数据，因此以下能力保持不可用：</p>
            <ul><li>读取原站市场实时作品与真实销量</li><li>积分余额、兑换、免费试用与订单</li><li>上传作品、定价、审核、下架和创作激励</li><li>已购资源的远程版本更新</li></ul>
            <p>可用替代：导入或创建本地资源，安装后真实写入任务创建器和画图实验室使用的本地资源库。</p>
            <footer><button type="button" className="market-primary" onClick={() => setShowPrivateDetail(false)}>知道了</button></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
