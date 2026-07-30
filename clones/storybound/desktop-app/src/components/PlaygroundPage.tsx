import { useEffect, useMemo, useRef, useState } from "react";

import { visualStyles } from "../data/app-data";
import { customStyleStoreEvent, readCustomVisualStyles } from "../lib/custom-style-store";
import { generateImages } from "../lib/image-api";
import {
  imageProviderStoreEvent,
  readImageProviderConfig,
  writeImageProviderConfig,
} from "../lib/image-provider-store";
import { marketStoreEvent, readInstalledMarketItems } from "../lib/market-store";
import { createTask, deleteTask, updateTask, uploadTaskAsset } from "../lib/task-api";
import type { ImageGenerationRequest } from "../types/image";
import "./PlaygroundPage.css";

type PlaygroundMode = "text" | "reference";
type PlaygroundAspectRatio = "9:16" | "16:9" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";
type PlaygroundResolution = "1K" | "2K" | "4K";
type PlaygroundStatus = "loading" | "ready" | "failed";
type NativeAspectRatio = ImageGenerationRequest["aspectRatio"];

interface PlaygroundReference {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

interface PlaygroundForm {
  mode: PlaygroundMode;
  prompt: string;
  styles: string[];
  aspectRatios: PlaygroundAspectRatio[];
  resolution: PlaygroundResolution;
  references: PlaygroundReference[];
}

interface PlaygroundResult {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: PlaygroundAspectRatio;
  resolution: PlaygroundResolution;
  mode: PlaygroundMode;
  referenceIds: string[];
  status: PlaygroundStatus;
  imageUrl: string;
  createdAt: string;
  elapsedMs: number | null;
  error: string;
  selected: boolean;
}

interface PersistedPlaygroundResult extends Omit<PlaygroundResult, "imageUrl"> {
  imageUrl?: string;
}

interface PlaygroundPageProps {
  apiKey?: string;
}

const NO_STYLE = "无风格";
const FORM_STORAGE_KEY = "storybound-playground-form-v1";
const GALLERY_STORAGE_KEY = "storybound-playground-gallery-v1";
const IMAGE_DB_NAME = "storybound-playground";
const IMAGE_STORE_NAME = "generated-images";
const aspectRatios: PlaygroundAspectRatio[] = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"];
const resolutions: PlaygroundResolution[] = ["1K", "2K", "4K"];
const defaultForm: PlaygroundForm = {
  mode: "text",
  prompt: "",
  styles: [NO_STYLE],
  aspectRatios: ["9:16"],
  resolution: "1K",
  references: [],
};

const nativeRatioMap: Record<PlaygroundAspectRatio, NativeAspectRatio> = {
  "9:16": "9:16",
  "16:9": "16:9",
  "1:1": "1:1",
  "4:3": "4:3",
  "3:4": "3:4",
  "3:2": "4:3",
  "2:3": "3:4",
  "21:9": "16:9",
};

const ratioValues: Record<PlaygroundAspectRatio, number> = {
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  "21:9": 21 / 9,
};

const resolutionLongEdges: Record<PlaygroundResolution, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096,
};

function readStoredForm(): PlaygroundForm {
  if (typeof window === "undefined") return defaultForm;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FORM_STORAGE_KEY) || "null") as Partial<PlaygroundForm> | null;
    if (!parsed) return defaultForm;
    const marketStyles = readInstalledMarketItems().flatMap((item) => item.apply.visualStyle ? [item.apply.visualStyle] : []);
    const customStyles = readCustomVisualStyles().map((style) => style.name);
    const styles = Array.isArray(parsed.styles)
      ? parsed.styles.filter((style): style is string => style === NO_STYLE || visualStyles.includes(style) || marketStyles.includes(style) || customStyles.includes(style))
      : [];
    const ratios = Array.isArray(parsed.aspectRatios)
      ? parsed.aspectRatios.filter((ratio): ratio is PlaygroundAspectRatio => aspectRatios.includes(ratio))
      : [];
    const references = Array.isArray(parsed.references)
      ? parsed.references.filter((reference): reference is PlaygroundReference => (
        Boolean(reference)
        && typeof reference.id === "string"
        && typeof reference.name === "string"
        && typeof reference.dataUrl === "string"
      )).slice(0, 10)
      : [];
    return {
      mode: parsed.mode === "reference" ? "reference" : "text",
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      styles: styles.length ? styles : [NO_STYLE],
      aspectRatios: ratios.length ? ratios : ["9:16"],
      resolution: resolutions.includes(parsed.resolution as PlaygroundResolution)
        ? parsed.resolution as PlaygroundResolution
        : "1K",
      references,
    };
  } catch {
    return defaultForm;
  }
}

function readStoredGallery(): PlaygroundResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GALLERY_STORAGE_KEY) || "[]") as PersistedPlaygroundResult[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((result) => (
      Boolean(result)
      && typeof result.id === "string"
      && typeof result.prompt === "string"
      && typeof result.style === "string"
      && aspectRatios.includes(result.aspectRatio)
      && resolutions.includes(result.resolution)
    )).map((result) => ({
      ...result,
      mode: result.mode === "reference" ? "reference" : "text",
      referenceIds: Array.isArray(result.referenceIds) ? result.referenceIds.map(String) : [],
      status: result.status === "loading" ? "failed" : result.status,
      imageUrl: result.imageUrl || "",
      error: result.status === "loading" ? "页面刷新中断了这次生成，请原位重生。" : result.error || "",
      selected: Boolean(result.selected),
    }));
  } catch {
    return [];
  }
}

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IMAGE_DB_NAME, 1);
    request.onerror = () => reject(request.error ?? new Error("无法打开图片存储"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeImage(id: string, dataUrl: string): Promise<void> {
  const database = await openImageDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(IMAGE_STORE_NAME).put(dataUrl, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("图片持久化失败"));
  });
  database.close();
}

async function readImage(id: string): Promise<string> {
  const database = await openImageDatabase();
  const result = await new Promise<string>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(IMAGE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : "");
    request.onerror = () => reject(request.error ?? new Error("图片恢复失败"));
  });
  database.close();
  return result;
}

async function removeStoredImage(id: string): Promise<void> {
  const database = await openImageDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(IMAGE_STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("删除本地图片失败"));
  });
  database.close();
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("无法读取图片"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解码失败"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片编码失败"));
    }, "image/jpeg", quality);
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function normalizeReference(file: File): Promise<PlaygroundReference> {
  const originalUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalUrl);
  const maxEdge = 900;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片处理");
  context.drawImage(image, 0, 0, width, height);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    width,
    height,
  };
}

async function createReferenceBoard(references: PlaygroundReference[]): Promise<File> {
  const columns = references.length === 1 ? 1 : references.length <= 4 ? 2 : 3;
  const rows = Math.ceil(references.length / columns);
  const cellWidth = 640;
  const cellHeight = 640;
  const gutter = 16;
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellWidth + (columns - 1) * gutter;
  canvas.height = rows * cellHeight + (rows - 1) * gutter;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持参考图处理");
  context.fillStyle = "#11161a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const images = await Promise.all(references.map((reference) => loadImage(reference.dataUrl)));
  images.forEach((image, index) => {
    const x = (index % columns) * (cellWidth + gutter);
    const y = Math.floor(index / columns) * (cellHeight + gutter);
    drawCover(context, image, x, y, cellWidth, cellHeight);
  });
  const blob = await canvasToBlob(canvas, 0.9);
  return new File([blob], "playground-reference-board.jpg", { type: "image/jpeg" });
}

async function postProcessImage(
  source: string,
  aspectRatio: PlaygroundAspectRatio,
  resolution: PlaygroundResolution,
): Promise<string> {
  const image = await loadImage(source);
  const targetRatio = ratioValues[aspectRatio];
  const longEdge = resolutionLongEdges[resolution];
  const width = targetRatio >= 1 ? longEdge : Math.max(1, Math.round(longEdge * targetRatio));
  const height = targetRatio >= 1 ? Math.max(1, Math.round(longEdge / targetRatio)) : longEdge;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片尺寸处理");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawCover(context, image, 0, 0, width, height);
  const quality = resolution === "4K" ? 0.9 : 0.92;
  return readFileAsDataUrl(await canvasToBlob(canvas, quality));
}

function resultFileName(result: PlaygroundResult): string {
  const style = result.style === NO_STYLE ? "raw" : result.style.replace(/\s+/g, "-");
  return `storybound-${style}-${result.aspectRatio.replace(":", "x")}-${result.resolution}-${result.id.slice(0, 8)}.jpg`;
}

function downloadResult(result: PlaygroundResult): void {
  if (!result.imageUrl) return;
  const anchor = document.createElement("a");
  anchor.href = result.imageUrl;
  anchor.download = resultFileName(result);
  anchor.rel = "noopener";
  anchor.click();
}

function displayTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
}

function composePrompt(prompt: string, style: string): string {
  return style === NO_STYLE ? prompt : `${style}风格，${prompt}`;
}

function replaceResult(items: PlaygroundResult[], result: PlaygroundResult): PlaygroundResult[] {
  return items.map((item) => item.id === result.id ? result : item);
}

export function PlaygroundPage({ apiKey = "" }: PlaygroundPageProps) {
  const [form, setForm] = useState<PlaygroundForm>(readStoredForm);
  const [installedMarketStyles, setInstalledMarketStyles] = useState(
    () => readInstalledMarketItems().flatMap((item) => item.apply.visualStyle ? [item.apply.visualStyle] : []),
  );
  const [customStyles, setCustomStyles] = useState(readCustomVisualStyles);
  const [imageProviderConfig, setImageProviderConfig] = useState(readImageProviderConfig);
  const [results, setResults] = useState<PlaygroundResult[]>(readStoredGallery);
  const [busy, setBusy] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  useEffect(() => {
    const refreshMarket = () => setInstalledMarketStyles(
      readInstalledMarketItems().flatMap((item) => item.apply.visualStyle ? [item.apply.visualStyle] : []),
    );
    const refreshStyles = () => setCustomStyles(readCustomVisualStyles());
    const refreshProvider = () => setImageProviderConfig(readImageProviderConfig());
    window.addEventListener(marketStoreEvent, refreshMarket);
    window.addEventListener(customStyleStoreEvent, refreshStyles);
    window.addEventListener(imageProviderStoreEvent, refreshProvider);
    window.addEventListener("storage", refreshMarket);
    window.addEventListener("storage", refreshStyles);
    return () => {
      window.removeEventListener(marketStoreEvent, refreshMarket);
      window.removeEventListener(customStyleStoreEvent, refreshStyles);
      window.removeEventListener(imageProviderStoreEvent, refreshProvider);
      window.removeEventListener("storage", refreshMarket);
      window.removeEventListener("storage", refreshStyles);
    };
  }, []);
  const [storageWarning, setStorageWarning] = useState("");
  const [restoringIds, setRestoringIds] = useState<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  const matrixCount = form.styles.length * form.aspectRatios.length;
  const failedResults = results.filter((result) => result.status === "failed");
  const selectedResults = results.filter((result) => result.selected && result.status === "ready" && result.imageUrl);
  const statusSummary = useMemo(() => ({
    ready: results.filter((result) => result.status === "ready").length,
    failed: failedResults.length,
    loading: results.filter((result) => result.status === "loading").length,
  }), [failedResults.length, results]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
      setStorageWarning("");
    } catch {
      setStorageWarning("参考图较多，浏览器本地存储空间不足；当前页面仍可继续使用，但刷新后部分表单可能无法恢复。");
    }
  }, [form]);

  useEffect(() => {
    const persisted = results.map(({ imageUrl: _imageUrl, ...result }) => result);
    try {
      window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      setStorageWarning("画廊元数据无法写入本地存储，请先删除部分历史结果。");
    }
  }, [results]);

  useEffect(() => {
    const missing = results.filter((result) => result.status === "ready" && !result.imageUrl).map((result) => result.id);
    if (!missing.length) return;
    let cancelled = false;
    setRestoringIds((current) => [...new Set([...current, ...missing])]);
    void Promise.all(missing.map(async (id) => ({ id, imageUrl: await readImage(id).catch(() => "") }))).then((restored) => {
      if (cancelled) return;
      const restoredById = new Map(restored.map((item) => [item.id, item.imageUrl]));
      setResults((current) => current.map((result) => {
        const imageUrl = restoredById.get(result.id);
        if (imageUrl === undefined || imageUrl) return imageUrl ? { ...result, imageUrl } : result;
        return { ...result, status: "failed", error: "本地图片数据已丢失，请原位重生。" };
      }));
      setRestoringIds((current) => current.filter((id) => !missing.includes(id)));
    });
    return () => {
      cancelled = true;
    };
  }, [results]);

  function toggleStyle(style: string): void {
    setForm((current) => {
      const selected = current.styles.includes(style);
      if (selected && current.styles.length === 1) return current;
      return {
        ...current,
        styles: selected ? current.styles.filter((item) => item !== style) : [...current.styles, style],
      };
    });
  }

  function toggleRatio(aspectRatio: PlaygroundAspectRatio): void {
    setForm((current) => {
      const selected = current.aspectRatios.includes(aspectRatio);
      if (selected && current.aspectRatios.length === 1) return current;
      return {
        ...current,
        aspectRatios: selected
          ? current.aspectRatios.filter((item) => item !== aspectRatio)
          : [...current.aspectRatios, aspectRatio],
      };
    });
  }

  async function addReferenceFiles(files: FileList | File[]): Promise<void> {
    const candidates = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const availableSlots = Math.max(0, 10 - form.references.length);
    if (!candidates.length || !availableSlots) {
      setBatchMessage(availableSlots ? "请选择有效的图片文件。" : "最多只能保留 10 张参考图。");
      return;
    }
    setReferenceBusy(true);
    setBatchMessage("");
    try {
      const references = await Promise.all(candidates.slice(0, availableSlots).map(normalizeReference));
      setForm((current) => ({
        ...current,
        mode: "reference",
        references: [...current.references, ...references].slice(0, 10),
      }));
      if (candidates.length > availableSlots) {
        setBatchMessage(`已加入 ${availableSlots} 张，超出 10 张上限的文件没有导入。`);
      }
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "参考图读取失败");
    } finally {
      setReferenceBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function prepareReferenceTask(references: PlaygroundReference[]): Promise<string> {
    const task = await createTask({
      id: `playground-${crypto.randomUUID()}`,
      title: "画图实验室临时参考",
      inputText: form.prompt,
      sourceMode: "paste",
      mode: "direct",
      pausePreset: "none",
      customPauseSteps: [],
      videoForm: "narration",
      track: "通用故事",
      visualStyle: form.styles[0] === NO_STYLE ? "写实彩色" : form.styles[0],
      aspectRatio: "1:1",
      status: "draft",
      runState: "idle",
      currentStep: -1,
      options: {},
    });
    try {
      const board = await createReferenceBoard(references);
      const asset = await uploadTaskAsset(task.id, board, "uploads");
      await updateTask(task.id, { options: { referenceImage: asset } });
      return task.id;
    } catch (error) {
      await deleteTask(task.id).catch(() => undefined);
      throw error;
    }
  }

  async function runResult(result: PlaygroundResult, temporaryTaskId: string | null): Promise<PlaygroundResult> {
    const startedAt = performance.now();
    const active: PlaygroundResult = {
      ...result,
      status: "loading",
      imageUrl: "",
      error: "",
      elapsedMs: null,
      createdAt: new Date().toISOString(),
    };
    if (mountedRef.current) setResults((current) => replaceResult(current, active));
    try {
      await removeStoredImage(active.id).catch(() => undefined);
      const activeTaskId = active.mode === "reference" ? temporaryTaskId : null;
      const response = await generateImages({
        ...(activeTaskId ? { taskId: activeTaskId } : {}),
        prompts: [{
          shotId: Math.max(1, Math.floor(Date.now() % 1_000_000)),
          prompt: composePrompt(active.prompt, active.style),
          negativePrompt: "",
        }],
        apiKey,
        aspectRatio: nativeRatioMap[active.aspectRatio],
        maxImages: 1,
        track: "通用故事",
        visualStyle: active.style === NO_STYLE ? "" : active.style,
      });
      const image = response.images[0];
      if (!image || image.status === "failed" || !image.url) {
        throw new Error(image?.error || "MiniMax 未返回可用图片");
      }
      const imageUrl = await postProcessImage(image.url, active.aspectRatio, active.resolution);
      await storeImage(active.id, imageUrl);
      return {
        ...active,
        status: "ready",
        imageUrl,
        elapsedMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      return {
        ...active,
        status: "failed",
        error: error instanceof Error ? error.message : "MiniMax 生图失败",
        elapsedMs: Math.round(performance.now() - startedAt),
      };
    }
  }

  async function executeBatch(batch: PlaygroundResult[], references: PlaygroundReference[]): Promise<void> {
    if (!batch.length || busy) return;
    setBusy(true);
    setBatchMessage("");
    let temporaryTaskId: string | null = null;
    try {
      if (batch.some((result) => result.mode === "reference")) {
        if (!references.length) throw new Error("参考图已被移除，请重新上传后再试。");
        temporaryTaskId = await prepareReferenceTask(references);
      }
      await mapWithConcurrency(batch, 3, async (placeholder) => {
        const completed = await runResult(placeholder, temporaryTaskId);
        if (mountedRef.current) setResults((current) => replaceResult(current, completed));
      });
      const completed = await Promise.all(batch.map(async (item) => {
        const currentImage = await readImage(item.id).catch(() => "");
        return { id: item.id, ready: Boolean(currentImage) };
      }));
      const readyCount = completed.filter((item) => item.ready).length;
      if (readyCount === batch.length) {
        setBatchMessage(`本批 ${batch.length} 张已全部生成并保存。`);
      } else if (readyCount === 0) {
        setBatchMessage(`本批 ${batch.length} 张全部失败，请查看卡片错误后批量重试。`);
      } else {
        setBatchMessage(`本批完成 ${readyCount}/${batch.length}，失败项可单独或批量重试。`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量生成失败";
      setResults((current) => current.map((result) => (
        batch.some((item) => item.id === result.id)
          ? { ...result, status: "failed", error: message, elapsedMs: result.elapsedMs ?? 0 }
          : result
      )));
      setBatchMessage(`本批全部失败：${message}`);
    } finally {
      if (temporaryTaskId) {
        await deleteTask(temporaryTaskId).catch(() => {
          if (mountedRef.current) {
            setStorageWarning("临时参考任务清理失败；可在任务历史中删除“画图实验室临时参考”。");
          }
        });
      }
      if (mountedRef.current) setBusy(false);
    }
  }

  async function generate(): Promise<void> {
    const prompt = form.prompt.trim();
    if (!prompt || busy) return;
    if (form.mode === "reference" && !form.references.length) {
      setBatchMessage("图像参考模式需要先上传 1–10 张参考图。");
      return;
    }
    const referenceIds = form.references.map((reference) => reference.id);
    const batch = form.styles.flatMap((style) => form.aspectRatios.map((aspectRatio): PlaygroundResult => ({
      id: crypto.randomUUID(),
      prompt,
      style,
      aspectRatio,
      resolution: form.resolution,
      mode: form.mode,
      referenceIds: form.mode === "reference" ? referenceIds : [],
      status: "loading",
      imageUrl: "",
      createdAt: new Date().toISOString(),
      elapsedMs: null,
      error: "",
      selected: false,
    })));
    setResults((current) => [...batch, ...current]);
    await executeBatch(batch, form.references);
  }

  async function retryResults(targets: PlaygroundResult[]): Promise<void> {
    if (!targets.length || busy) return;
    const referenceIds = new Set(targets.flatMap((result) => result.referenceIds));
    const references = form.references.filter((reference) => referenceIds.has(reference.id));
    await executeBatch(targets.map((result) => ({
      ...result,
      status: "loading",
      imageUrl: "",
      error: "",
      selected: false,
    })), references);
  }

  function reusePrompt(result: PlaygroundResult): void {
    setForm((current) => ({
      ...current,
      prompt: result.prompt,
      styles: [result.style],
      aspectRatios: [result.aspectRatio],
      resolution: result.resolution,
    }));
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleUseAsReference(result: PlaygroundResult): Promise<void> {
    if (!result.imageUrl) return;
    if (form.references.length >= 10) {
      setBatchMessage("参考图已达到 10 张上限，请先删除一张。");
      return;
    }
    try {
      const reference = await normalizeReference(new File(
        [await (await fetch(result.imageUrl)).blob()],
        resultFileName(result),
        { type: "image/jpeg" },
      ));
      setForm((current) => ({
        ...current,
        mode: "reference",
        references: [...current.references, reference].slice(0, 10),
      }));
      setBatchMessage("已将生成结果加入参考图。");
    } catch (error) {
      setBatchMessage(error instanceof Error ? error.message : "无法将结果设为参考图");
    }
  }

  async function removeResult(result: PlaygroundResult): Promise<void> {
    setResults((current) => current.filter((item) => item.id !== result.id));
    await removeStoredImage(result.id).catch(() => undefined);
  }

  function downloadSelected(): void {
    selectedResults.forEach(downloadResult);
  }

  return (
    <main className="playground-page">
      <header className="playground-header">
        <div className="playground-header__icon" aria-hidden="true">◇</div>
        <div>
          <h1>画图实验室</h1>
          <p>输入提示词 + 选风格 → 直接出图，专用于测试不同 prompt / 风格效果。不写入任务历史，不走流水线。</p>
        </div>
      </header>

      <section className="playground-card playground-form-card">
        <div className="playground-section-heading">
          <div>
            <h2>生成设置</h2>
            <p>每个画风 × 每个比例生成一张真实 MiniMax 图片。</p>
          </div>
          <span className="playground-stability-badge">image-01 · 真实接口</span>
        </div>

        <div className="playground-mode-switch" aria-label="生成模式">
          <button
            className={form.mode === "text" ? "is-selected" : ""}
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "text" }))}
          >
            <strong>文生图</strong>
            <span>只使用 prompt</span>
          </button>
          <button
            className={form.mode === "reference" ? "is-selected" : ""}
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "reference" }))}
          >
            <strong>图像参考</strong>
            <span>1–10 张本地参考图</span>
          </button>
        </div>
        <div className="playground-mode-switch" aria-label="图片引擎">
          <button className={imageProviderConfig.provider === "minimax" ? "is-selected" : ""} type="button" onClick={() => {
            const next = { ...imageProviderConfig, provider: "minimax" as const };
            setImageProviderConfig(next);
            writeImageProviderConfig(next);
          }}><strong>MiniMax image-01</strong><span>使用现有 MiniMax 凭据</span></button>
          <button className={imageProviderConfig.provider === "openai-compatible" ? "is-selected" : ""} type="button" onClick={() => {
            const next = { ...imageProviderConfig, provider: "openai-compatible" as const };
            setImageProviderConfig(next);
            writeImageProviderConfig(next);
          }}><strong>兼容图片引擎</strong><span>{imageProviderConfig.custom.apiKey ? imageProviderConfig.custom.model : "请先到系统设置配置"}</span></button>
        </div>

        <label className="playground-field">
          <span>
            <strong>Prompt</strong>
            <small>{form.prompt.length} / 1500</small>
          </span>
          <textarea
            ref={promptRef}
            rows={6}
            maxLength={1500}
            value={form.prompt}
            placeholder="描述主体、环境、构图、光线和情绪。选择“无风格”时会原样发送这段 prompt。"
            onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
          />
        </label>

        {form.mode === "reference" ? (
          <div className="playground-reference-section">
            <div className="playground-field-title">
              <strong>本地参考图</strong>
              <small>{form.references.length} / 10</small>
            </div>
            <label className={`playground-upload${referenceBusy ? " is-busy" : ""}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={referenceBusy || form.references.length >= 10}
                onChange={(event) => event.target.files && void addReferenceFiles(event.target.files)}
              />
              <span aria-hidden="true">＋</span>
              <strong>{referenceBusy ? "正在读取图片…" : "添加参考图"}</strong>
              <small>多图会合成一张参考板传给 MiniMax，不会写入任务历史。</small>
            </label>
            {form.references.length ? (
              <div className="playground-reference-grid">
                {form.references.map((reference, index) => (
                  <figure key={reference.id}>
                    <img src={reference.dataUrl} alt={reference.name} />
                    <figcaption>
                      <span>{index + 1}. {reference.name}</span>
                      <button
                        type="button"
                        aria-label={`删除参考图 ${reference.name}`}
                        onClick={() => setForm((current) => ({
                          ...current,
                          references: current.references.filter((item) => item.id !== reference.id),
                        }))}
                      >
                        ×
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="playground-reference-empty">尚未添加参考图；该模式下不会静默降级为纯文生图。</p>
            )}
          </div>
        ) : null}

        <div className="playground-option-group">
          <div className="playground-field-title">
            <strong>视觉风格</strong>
            <small>可多选 · {form.styles.length} 项</small>
          </div>
          <div className="playground-chips">
            {[NO_STYLE, ...new Set([...visualStyles, ...installedMarketStyles, ...customStyles.map((style) => style.name)])].map((style) => (
              <button
                className={form.styles.includes(style) ? "is-selected" : ""}
                key={style}
                type="button"
                onClick={() => toggleStyle(style)}
              >
                {style === NO_STYLE ? "无风格 · 原 prompt" : style}
              </button>
            ))}
          </div>
        </div>

        <div className="playground-options-grid">
          <div className="playground-option-group">
            <div className="playground-field-title">
              <strong>画面比例</strong>
              <small>可多选 · {form.aspectRatios.length} 项</small>
            </div>
            <div className="playground-chips playground-chips--ratios">
              {aspectRatios.map((aspectRatio) => (
                <button
                  className={form.aspectRatios.includes(aspectRatio) ? "is-selected" : ""}
                  key={aspectRatio}
                  type="button"
                  onClick={() => toggleRatio(aspectRatio)}
                >
                  {aspectRatio}
                </button>
              ))}
            </div>
          </div>
          <div className="playground-option-group">
            <div className="playground-field-title">
              <strong>输出分辨率</strong>
              <small>1K 最稳定</small>
            </div>
            <div className="playground-resolution-list">
              {resolutions.map((resolution) => (
                <button
                  className={form.resolution === resolution ? "is-selected" : ""}
                  key={resolution}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, resolution }))}
                >
                  <strong>{resolution}</strong>
                  <span>{resolution === "1K" ? "最稳定" : resolution === "2K" ? "高清" : "超高清"}</span>
                </button>
              ))}
            </div>
            <p className="playground-adapter-note">image-01 原生生成后在本机精确裁切所选比例，并输出对应 1K / 2K / 4K 像素尺寸。</p>
          </div>
        </div>

        <div className="playground-generation-bar">
          <div>
            <strong>本次将生成 {matrixCount} 张</strong>
            <span>{form.styles.length} 个画风 × {form.aspectRatios.length} 个比例 · {form.resolution}</span>
          </div>
          <button
            className="playground-primary"
            type="button"
            disabled={busy || !form.prompt.trim() || (form.mode === "reference" && !form.references.length)}
            onClick={() => void generate()}
          >
            {busy ? `生成中 · 剩余 ${statusSummary.loading}` : `开始生成 ${matrixCount} 张`}
          </button>
        </div>
        {storageWarning ? <p className="playground-alert playground-alert--warning">{storageWarning}</p> : null}
        {batchMessage ? <p className="playground-alert">{batchMessage}</p> : null}
      </section>

      <section className="playground-gallery">
        <header className="playground-gallery__header">
          <div>
            <h2>实验画廊 <span>· {results.length}</span></h2>
            <p>
              成功 {statusSummary.ready}
              {statusSummary.loading ? ` · 生成中 ${statusSummary.loading}` : ""}
              {statusSummary.failed ? ` · 失败 ${statusSummary.failed}` : ""}
            </p>
          </div>
          <div className="playground-gallery__actions">
            <button type="button" disabled={busy || !failedResults.length} onClick={() => void retryResults(failedResults)}>
              批量重试失败{failedResults.length ? ` (${failedResults.length})` : ""}
            </button>
            <button type="button" disabled={!selectedResults.length} onClick={downloadSelected}>
              下载选中{selectedResults.length ? ` (${selectedResults.length})` : ""}
            </button>
            <button
              type="button"
              disabled={!results.some((result) => result.selected)}
              onClick={() => setResults((current) => current.map((result) => ({ ...result, selected: false })))}
            >
              清除选择
            </button>
          </div>
        </header>

        {!results.length ? (
          <div className="playground-empty">
            <span aria-hidden="true">◇</span>
            <strong>还没有实验图片</strong>
            <p>输入 prompt，选择画风与比例后开始生成；结果只保存在本机画廊。</p>
          </div>
        ) : (
          <div className="playground-result-grid">
            {results.map((result) => {
              const restoring = restoringIds.includes(result.id);
              return (
                <article className={`playground-result playground-result--${result.status}`} key={result.id}>
                  <div className="playground-result__media" data-ratio={result.aspectRatio}>
                    {result.status === "ready" && result.imageUrl ? (
                      <img src={result.imageUrl} alt={`${result.style}，${result.prompt}`} />
                    ) : result.status === "loading" || restoring ? (
                      <div className="playground-result__loading">
                        <span />
                        <strong>{restoring ? "正在恢复本地图片" : "MiniMax 正在出图"}</strong>
                        <small>{result.style} · {result.aspectRatio} · {result.resolution}</small>
                      </div>
                    ) : (
                      <div className="playground-result__failure">
                        <span aria-hidden="true">!</span>
                        <strong>生成失败</strong>
                        <small>{result.error || "未知错误"}</small>
                      </div>
                    )}
                    <label className="playground-result__select">
                      <input
                        type="checkbox"
                        checked={result.selected}
                        disabled={result.status !== "ready" || !result.imageUrl}
                        onChange={(event) => setResults((current) => current.map((item) => (
                          item.id === result.id ? { ...item, selected: event.target.checked } : item
                        )))}
                      />
                      <span>选择</span>
                    </label>
                    <span className={`playground-result__status playground-result__status--${result.status}`}>
                      {result.status === "ready" ? "已完成" : result.status === "loading" ? "生成中" : "失败"}
                    </span>
                  </div>
                  <div className="playground-result__body">
                    <p title={result.prompt}>{result.prompt}</p>
                    <dl>
                      <div><dt>风格</dt><dd>{result.style === NO_STYLE ? "无风格" : result.style}</dd></div>
                      <div><dt>比例</dt><dd>{result.aspectRatio}</dd></div>
                      <div><dt>分辨率</dt><dd>{result.resolution}</dd></div>
                      <div><dt>时间</dt><dd>{displayTime(result.createdAt)}{result.elapsedMs ? ` · ${(result.elapsedMs / 1000).toFixed(1)}s` : ""}</dd></div>
                    </dl>
                    {result.error ? <p className="playground-result__error" title={result.error}>{result.error}</p> : null}
                    <div className="playground-result__actions">
                      <button type="button" disabled={!result.imageUrl} onClick={() => downloadResult(result)}>下载</button>
                      <button type="button" onClick={() => reusePrompt(result)}>复用 prompt</button>
                      <button type="button" disabled={!result.imageUrl || form.references.length >= 10} onClick={() => void handleUseAsReference(result)}>作为参考图</button>
                      <button type="button" disabled={busy} onClick={() => void retryResults([result])}>原位重生</button>
                      <button className="is-danger" type="button" disabled={busy && result.status === "loading"} onClick={() => void removeResult(result)}>删除</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
