import { useMemo, useState } from "react";

import {
  marketItems,
  readInstalledMarketIds,
  writeInstalledMarketIds,
  type MarketKind,
} from "../lib/market-store";
import "./MarketPage.css";

type MarketTab = "discover" | "installed";
type MarketSort = "newest" | "popular";

const kindLabels: Record<MarketKind, string> = {
  prompt: "提示词模板",
  style: "画面风格",
  cover: "封面海报模板",
};

export function MarketPage() {
  const [tab, setTab] = useState<MarketTab>("discover");
  const [kind, setKind] = useState<MarketKind | "all">("all");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [query, setQuery] = useState("");
  const [installedIds, setInstalledIds] = useState<string[]>(readInstalledMarketIds);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return marketItems
      .filter((item) => tab === "discover" || installedIds.includes(item.id))
      .filter((item) => kind === "all" || item.kind === kind)
      .filter((item) => !normalizedQuery || `${item.name} ${item.description} ${item.track}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => sort === "popular" ? right.installs - left.installs : right.version.localeCompare(left.version));
  }, [installedIds, kind, query, sort, tab]);

  function toggleInstalled(itemId: string) {
    setInstalledIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
      writeInstalledMarketIds(next);
      return next;
    });
  }

  return (
    <main className="market-page">
      <header className="market-page__hero">
        <div><span className="market-page__eyebrow">本地创作资源</span><h1>创作市场</h1><p>浏览提示词模板、画面风格与封面海报模板；安装后保存在本机，不会调用原站积分或订单服务。</p></div>
        <div className="market-page__tabs" role="tablist"><button className={tab === "discover" ? "is-active" : ""} onClick={() => setTab("discover")} role="tab" type="button">创作市场</button><button className={tab === "installed" ? "is-active" : ""} onClick={() => setTab("installed")} role="tab" type="button">我的市场 <b>{installedIds.length}</b></button></div>
      </header>

      <section className="market-toolbar" aria-label="市场筛选">
        <div className="market-toolbar__types"><button className={kind === "all" ? "is-active" : ""} onClick={() => setKind("all")} type="button">全部</button>{(Object.keys(kindLabels) as MarketKind[]).map((value) => <button className={kind === value ? "is-active" : ""} key={value} onClick={() => setKind(value)} type="button">{kindLabels[value]}</button>)}</div>
        <div className="market-toolbar__search"><select aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value as MarketSort)}><option value="newest">最新上架</option><option value="popular">安装最多</option></select><input aria-label="搜索市场" placeholder="搜标题 / 简介" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </section>

      {visibleItems.length ? <section className="market-grid">{visibleItems.map((item) => {
        const installed = installedIds.includes(item.id);
        return <article className="market-card" key={item.id}><div className="market-card__cover" data-accent={item.id}><span>{kindLabels[item.kind]}</span><strong>{item.name.slice(0, 2)}</strong></div><div className="market-card__body"><div className="market-card__meta"><span>{item.track}</span><span>v{item.version}</span></div><h2>{item.name}</h2><p>{item.description}</p><footer><small>{item.author} · {item.installs.toLocaleString("zh-CN")} 次安装</small><button className={installed ? "is-installed" : ""} onClick={() => toggleInstalled(item.id)} type="button">{installed ? "已安装 · 移除" : "安装到本地"}</button></footer></div></article>;
      })}</section> : <div className="market-empty"><strong>{tab === "installed" ? "还没有安装内容" : "没有匹配的作品"}</strong><p>{tab === "installed" ? "回到创作市场，选择资源安装到本地。" : "换个关键词或类型试试。"}</p></div>}
    </main>
  );
}
