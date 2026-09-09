"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { PromptPicker } from "./PromptPicker";
import type { Book } from "@/types/workspace";
import { composeCover } from "@/lib/cover-image";
import { readImageHistory, saveImageBatch, type ImageBatch } from "@/lib/image-history";

export function ImageDialog({ name, useImageLabel = "应用到角色卡", initialInput = "", initialTitles = "", initialAuthor = "", books = [], onCover, onUseImage, onClose }: { name: string; useImageLabel?: string; initialInput?: string; initialTitles?: string; initialAuthor?: string; books?: Book[]; onCover?: (bookId: string, image: string) => void; onUseImage?: (image: string) => void; onClose: () => void }) {
  const [prompt, setPrompt] = useState(initialInput.slice(0, 1500));
  const [ratio, setRatio] = useState("2:3");
  const [count, setCount] = useState(1);
  const [optimize, setOptimize] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ImageBatch[]>([]);
  const [bookId, setBookId] = useState("");
  const [titles, setTitles] = useState(initialTitles);
  const [author, setAuthor] = useState(initialAuthor);
  const [message, setMessage] = useState("");
  const [layouts, setLayouts] = useState<{title: string; image: string}[]>([]);
  const [composing, setComposing] = useState(false);
  useEffect(() => { let active = true; readImageHistory().then(items => { if (active) setHistory(items); }).catch(() => { if (active) setError("图片历史读取失败，新生成的图片请及时下载。"); }); return () => { active = false; }; }, []);
  async function apply(image: string, role: "cover" | "character") {
    setError(""); setMessage("");
    try { const resized = await composeCover(image, "", "", role === "character"); if (role === "cover") { onCover?.(bookId, resized); setMessage("封面已保存到作品。"); } else { onUseImage?.(resized); setMessage(`${useImageLabel}成功。`); } } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请下载图片后重试。"); }
  }
  async function compose(source: string) {
    setComposing(true); setError("");
    try {
      const unique = [...new Set(titles.split("\n").map(value => value.trim()).filter(Boolean))];
      if (!unique.length || unique.length > 9 || unique.some(title => title.length > 40)) throw new Error("请输入1至9个书名，每行一个，每个不超过40字符。");
      const results = [];
      for (const title of unique) results.push({ title, image: await composeCover(source, title, author) });
      setLayouts(results);
      const batch = { id: crypto.randomUUID(), images: results.map(item => item.image), prompt: `书名试装：${unique.join("、")}`, createdAt: new Date().toISOString() };
      try { await saveImageBatch(batch); setHistory(current => [batch, ...current]); }
      catch { setError("封面已排版，但历史保存失败，请下载封面。"); }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "排版失败"); } finally { setComposing(false); }
  }
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function generate(event: FormEvent) {
    event.preventDefault();
    if (controller.current) return;
    const active = new AbortController(); controller.current = active;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, aspect_ratio: ratio, n: count, prompt_optimizer: optimize }), signal: active.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成失败");
      const generated = data.images.map((value: string) => `data:image/jpeg;base64,${value}`);
      setImages(generated); setLayouts([]);
      const batch = { id: crypto.randomUUID(), images: generated, prompt, createdAt: new Date().toISOString() };
      try { await saveImageBatch(batch); setHistory(current => [batch, ...current]); } catch (cause) { setError(cause instanceof Error ? cause.message : "历史保存失败，请下载图片。"); }
      if (data.failedCount) setError(`部分图片未生成，已保留成功的图片。`);
    } catch (cause) { setError(active.signal.aborted ? "已停止等待；已提交的生成可能仍会计费。" : cause instanceof Error ? cause.message : "生成失败"); }
    finally { controller.current = null; setBusy(false); }
  }
  return <Modal title={name} onClose={onClose} wide><form onSubmit={generate} className="grid gap-4">
    <p>MiniMax image-01 · 图片生成</p>
    <fieldset disabled={busy}><PromptPicker toolName={["AI生成角色图片", "章节配图"].includes(name) ? name : "封面生成器"} onApply={content => { if (content.length > 1500) throw new Error("图片描述最多1500字符，请缩短该提示词后使用。"); setPrompt(content); }} /></fieldset>
    <label>上传已有底图<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async event => {
      const input = event.currentTarget;
      const file = input.files?.[0]; if (!file) return;
      setError(""); setMessage("");
      try { if (!file.type.match(/^image\/(png|jpeg|webp)$/) || file.size > 10 * 1024 * 1024) throw new Error("请选择10MB以内的PNG、JPEG或WebP图片。");
        const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("图片读取失败")); reader.readAsDataURL(file); });
        const picture = new Image(); picture.src = source; await picture.decode();
        const batch = { id: crypto.randomUUID(), images: [source], prompt: "上传底图", createdAt: new Date().toISOString() };
        setImages([source]); setLayouts([]); await saveImageBatch(batch); setHistory(current => [batch, ...current]);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "图片导入失败"); }
      input.value = "";
    }} /></label>
    {history.length > 0 && <label>图片历史<select className="form-input" defaultValue="" onChange={event => { const batch = history.find(item => item.id === event.target.value); if (batch) { setImages(batch.images); setPrompt(batch.prompt); setLayouts([]); } }}><option value="">选择历史生成结果</option>{history.map(batch => <option key={batch.id} value={batch.id}>{new Date(batch.createdAt).toLocaleString()} · {batch.prompt.slice(0,30)}</option>)}</select></label>}
    <label>画面描述<textarea required maxLength={1500} className="form-input min-h-32" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="描述人物、场景、构图、色调和画风；封面可预留书名空间。" /><small>{prompt.length}/1500</small></label>
    <div className="flex gap-3"><label>图片比例<select className="form-input" value={ratio} onChange={event => setRatio(event.target.value)}>{["2:3", "3:4", "1:1", "16:9", "9:16", "4:3", "3:2", "21:9"].map(value => <option key={value}>{value}</option>)}</select></label><label>生成数量<select className="form-input" value={count} onChange={event => setCount(Number(event.target.value))}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 张</option>)}</select></label></div>
    <label><input type="checkbox" checked={optimize} onChange={event => setOptimize(event.target.checked)} /> 自动优化描述</label>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {busy ? <button type="button" className="subtle-button" onClick={() => controller.current?.abort()}>正在生成，停止等待</button> : <button className="primary-button" type="submit">生成图片</button>}
    {images.length > 0 && <><p>可从图片历史重新打开，也可下载备份。</p>{onCover && <label>保存封面的作品<select className="form-input" value={bookId} onChange={event => setBookId(event.target.value)}><option value="">请选择作品</option>{books.filter(book => book.status === "active").map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>}
    <label>批量试装书名<textarea className="form-input" value={titles} onChange={event => setTitles(event.target.value)} placeholder="每行一个书名，最多9个" /></label><label>笔名<input className="form-input" maxLength={30} value={author} onChange={event => setAuthor(event.target.value)} /></label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{images.map((src, index) => <figure key={index}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="max-h-96 w-full object-contain" src={src} alt={`生成图片 ${index + 1}`} /><a className="subtle-button mt-2" href={src} download={`星月图片-${index + 1}.jpg`}>下载图片 {index + 1}</a>
      <div className="mt-2 flex flex-wrap gap-2">{onCover && <button type="button" className="subtle-button" disabled={!bookId} onClick={() => apply(src,"cover")}>设为作品封面</button>}{onUseImage && <button type="button" className="subtle-button" onClick={() => apply(src,"character")}>{useImageLabel}</button>}<button type="button" className="subtle-button" disabled={composing || !titles.trim()} onClick={() => compose(src)}>用此图批量试装书名</button></div>
    </figure>)}</div></>}
    {layouts.length > 0 && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{layouts.map(item => <figure key={item.title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt={`${item.title}试装封面`} className="w-full" /><figcaption>{item.title}</figcaption><a href={item.image} download={`${item.title}.jpg`} className="subtle-button">下载封面</a>{onCover && <button type="button" disabled={!bookId} className="subtle-button" onClick={() => apply(item.image,"cover")}>设为作品封面</button>}
    </figure>)}</div>}
  </form></Modal>;
}
