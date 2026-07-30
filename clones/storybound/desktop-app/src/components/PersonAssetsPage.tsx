import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  fileToPersonAsset,
  readPersonGroups,
  writePersonGroups,
  type PersonGroup,
} from "../lib/person-assets-store";
import "./PersonAssetsPage.css";

export function PersonAssetsPage() {
  const [groups, setGroups] = useState<PersonGroup[]>(readPersonGroups);
  const [selectedId, setSelectedId] = useState(() => readPersonGroups()[0]?.id || "");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const draggingIndex = useRef<number | null>(null);

  useEffect(() => {
    try {
      writePersonGroups(groups);
    } catch {
      setNotice("本地图片库空间已满，请删除旧素材或压缩图片后重试。");
    }
  }, [groups]);

  useEffect(() => {
    if (selectedId && groups.some((group) => group.id === selectedId)) return;
    setSelectedId(groups[0]?.id || "");
  }, [groups, selectedId]);

  const selectedGroup = groups.find((group) => group.id === selectedId) || null;
  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups.filter((group) => `${group.name} ${group.note} ${group.assets.map((asset) => asset.name).join(" ")}`.toLowerCase().includes(normalized));
  }, [groups, query]);
  const imageCount = groups.reduce((sum, group) => sum + group.assets.length, 0);

  function createGroup() {
    const name = window.prompt("素材组名称");
    if (!name?.trim()) return;
    const group: PersonGroup = { id: crypto.randomUUID(), name: name.trim(), note: "", assets: [] };
    setGroups((current) => [...current, group]);
    setSelectedId(group.id);
  }

  function renameGroup(group: PersonGroup) {
    const name = window.prompt("重命名素材组", group.name);
    if (!name?.trim()) return;
    setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name: name.trim() } : item));
  }

  function deleteGroup(group: PersonGroup) {
    if (!window.confirm(`删除“${group.name}”及其中 ${group.assets.length} 张本地图片？`)) return;
    setGroups((current) => current.filter((item) => item.id !== group.id));
  }

  async function importFiles(files: FileList | File[]) {
    if (!selectedGroup || !files.length) return;
    try {
      const assets = await Promise.all(Array.from(files).slice(0, 20).map(fileToPersonAsset));
      setGroups((current) => current.map((group) => group.id === selectedGroup.id ? { ...group, assets: [...group.assets, ...assets] } : group));
      setNotice(`已导入 ${assets.length} 张素材。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "图片导入失败。");
    }
  }

  function removeAsset(assetId: string) {
    if (!selectedGroup || !window.confirm("删除这张本地人物素材？")) return;
    setGroups((current) => current.map((group) => group.id === selectedGroup.id ? { ...group, assets: group.assets.filter((asset) => asset.id !== assetId) } : group));
  }

  function reorderAsset(targetIndex: number) {
    if (!selectedGroup || draggingIndex.current === null || draggingIndex.current === targetIndex) return;
    setGroups((current) => current.map((group) => {
      if (group.id !== selectedGroup.id) return group;
      const assets = [...group.assets];
      const [moved] = assets.splice(draggingIndex.current!, 1);
      assets.splice(targetIndex, 0, moved);
      return { ...group, assets };
    }));
    draggingIndex.current = targetIndex;
  }

  async function pasteImages(event: React.ClipboardEvent<HTMLElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    await importFiles(files);
  }

  return (
    <main className="person-assets-page" onPaste={(event) => void pasteImages(event)}>
      <header><div><span>本地素材目录</span><h1>人物素材库</h1><p>按人物整理真实参考图，创建任务时可直接复用。共 {groups.length} 组、{imageCount} 张。</p></div><button onClick={createGroup} type="button">＋ 新建素材组</button></header>
      {notice ? <div className="person-assets-notice"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")} type="button">×</button></div> : null}
      <div className="person-assets-layout">
        <aside><input aria-label="搜索素材" placeholder="搜人物或图片名" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="person-assets-groups">{visibleGroups.map((group) => <article className={selectedId === group.id ? "is-selected" : ""} key={group.id}><button className="person-assets-group-main" onClick={() => setSelectedId(group.id)} type="button"><strong>{group.name}</strong><span>{group.assets.length} 张</span></button><div><button onClick={() => renameGroup(group)} type="button">重命名</button><button className="is-danger" onClick={() => deleteGroup(group)} type="button">删除</button></div></article>)}</div>{groups.length === 0 ? <div className="person-assets-empty-small"><span>还没有素材组</span><button onClick={createGroup} type="button">新建第一组素材</button></div> : null}</aside>
        <section className="person-assets-content">
          {selectedGroup ? <><div className="person-assets-content__head"><div><h2>{selectedGroup.name}</h2><input aria-label="素材组备注" placeholder="人物身份、外观或使用说明" value={selectedGroup.note} onChange={(event) => setGroups((current) => current.map((group) => group.id === selectedGroup.id ? { ...group, note: event.target.value } : group))} /></div><label>导入图片<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && void importFiles(event.target.files)} /></label></div><div className="person-assets-drop" onDragOver={(event: DragEvent) => event.preventDefault()} onDrop={(event: DragEvent) => { event.preventDefault(); void importFiles(event.dataTransfer.files); }}><strong>拖入或粘贴 JPEG / PNG / WebP</strong><span>单图不超过 1.5 MB；素材保存在当前浏览器。</span></div>{selectedGroup.assets.length ? <div className="person-assets-grid">{selectedGroup.assets.map((asset, index) => <figure draggable key={asset.id} onDragStart={() => { draggingIndex.current = index; }} onDragOver={(event) => { event.preventDefault(); reorderAsset(index); }} onDragEnd={() => { draggingIndex.current = null; }}><img src={asset.dataUrl} alt={asset.name} /><figcaption><span>{index + 1}. {asset.name}</span><button onClick={() => removeAsset(asset.id)} type="button">删除</button></figcaption></figure>)}</div> : <div className="person-assets-empty"><strong>这一组还没有图片</strong><p>导入真实参考图后，可拖拽调整优先顺序。</p></div>}</> : <div className="person-assets-empty"><strong>新建第一组素材</strong><p>每组代表一个人物、商品或需要保持一致的主体。</p><button onClick={createGroup} type="button">开始创建</button></div>}
        </section>
      </div>
      <p className="person-assets-warning">请只使用你有权处理的图片，并自行确认版权、肖像权和平台规则。素材不会上传到原 Storybound 服务。</p>
    </main>
  );
}
