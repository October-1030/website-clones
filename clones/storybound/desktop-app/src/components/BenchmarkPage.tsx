import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  fetchBenchmarkProviderStatus,
  fetchBenchmarkWorks,
  parseBenchmarkVideo,
  resolveBenchmarkAccount,
  type BenchmarkProviderStatus,
  type ParsedBenchmarkVideo,
  type ResolvedBenchmarkAccount,
  type SyncedBenchmarkResult,
} from "../lib/benchmark-api";
import { fetchAsrStatus, type AsrStatus } from "../lib/asr-api";
import "./BenchmarkPage.css";

export interface BenchmarkAccount {
  id: string;
  name: string;
  sourceUrl: string;
  group: string;
  track: string;
  notes: string;
  favorite: boolean;
  avatar: string;
  remoteId: string;
  lastBuffer: string;
  continueFlag: number;
  pageDepth: number;
  lastRefreshAt: string;
  createdAt: string;
}

export interface BenchmarkWork {
  id: string;
  accountId: string;
  url: string;
  mediaUrl: string;
  title: string;
  publishTime: string;
  likes: number;
  favorites: number;
  comments: number;
  forwards: number;
  growth: number;
  notes: string;
  favorite: boolean;
  created: boolean;
  transcript: string;
  analysis: string;
  localMediaName: string;
  localMediaType: string;
  localMediaSize: number;
  remoteWorkId: string;
  description: string;
  coverUrl: string;
  quality: string;
  format: string;
  codec: string;
  plays: number;
  expiresAt: string;
  duration: number;
  decodeKey: string;
  createdAt: string;
}

export interface BenchmarkTaskPayload {
  workId: string;
  title: string;
  accountName: string;
  sourceUrl: string;
  transcript: string;
  notes: string;
}

export interface BenchmarkAiPayload {
  account: BenchmarkAccount | null;
  work: BenchmarkWork;
  transcript: string;
}

export interface BenchmarkPageProps {
  initialSearch?: string;
  onCreateTask?: (payload: BenchmarkTaskPayload) => void;
  onAiCorrect?: (payload: BenchmarkAiPayload) => Promise<string> | string;
  onAiAnalyze?: (payload: BenchmarkAiPayload) => Promise<string> | string;
  onTranscribeMedia?: (file: File, work: BenchmarkWork) => Promise<string>;
  onTranscribeSource?: (url: string, work: BenchmarkWork) => Promise<string>;
}

type WorkFilter = "all" | "favorite" | "created" | "uncreated";
type SortField = "publishTime" | "likes" | "favorites" | "comments" | "forwards" | "growth";

interface BenchmarkStore {
  version: 1;
  accounts: BenchmarkAccount[];
  works: BenchmarkWork[];
}

interface AccountDraft {
  name: string;
  sourceUrl: string;
  group: string;
  track: string;
  notes: string;
}

interface WorkDraft {
  accountId: string;
  url: string;
  mediaUrl: string;
  title: string;
  publishTime: string;
  likes: string;
  favorites: string;
  comments: string;
  forwards: string;
  growth: string;
  notes: string;
}

interface LocalMediaSession {
  file: File;
  url: string;
}

const STORAGE_KEY = "storybound-benchmark-workbench-v1";
const MAX_CONTINUOUS_SYNC_PAGES = 100;
const EMPTY_ACCOUNT_DRAFT: AccountDraft = {
  name: "",
  sourceUrl: "",
  group: "",
  track: "",
  notes: "",
};
const EMPTY_WORK_DRAFT: WorkDraft = {
  accountId: "",
  url: "",
  mediaUrl: "",
  title: "",
  publishTime: "",
  likes: "",
  favorites: "",
  comments: "",
  forwards: "",
  growth: "",
  notes: "",
};
const DIRECT_MEDIA_PATTERN = /\.(?:mp4|mov|m4v|webm|mp3|m4a|wav|aac|ogg)(?:[?#]|$)/i;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAccount(value: unknown): BenchmarkAccount | null {
  if (!isRecord(value)) return null;
  const name = readString(value.name).trim();
  if (!name) return null;
  return {
    id: readString(value.id) || createId("account"),
    name,
    sourceUrl: readString(value.sourceUrl),
    group: readString(value.group),
    track: readString(value.track),
    notes: readString(value.notes),
    favorite: value.favorite === true,
    avatar: readString(value.avatar),
    remoteId: readString(value.remoteId),
    lastBuffer: readString(value.lastBuffer),
    continueFlag: readNumber(value.continueFlag),
    pageDepth: readNumber(value.pageDepth),
    lastRefreshAt: readString(value.lastRefreshAt),
    createdAt: readString(value.createdAt) || new Date().toISOString(),
  };
}

function normalizeWork(value: unknown, accountIds: Set<string>): BenchmarkWork | null {
  if (!isRecord(value)) return null;
  const accountId = readString(value.accountId);
  const title = readString(value.title).trim();
  if (!title || !accountIds.has(accountId)) return null;
  return {
    id: readString(value.id) || createId("work"),
    accountId,
    url: readString(value.url),
    mediaUrl: readString(value.mediaUrl),
    title,
    publishTime: readString(value.publishTime),
    likes: readNumber(value.likes),
    favorites: readNumber(value.favorites),
    comments: readNumber(value.comments),
    forwards: readNumber(value.forwards),
    growth: readNumber(value.growth),
    notes: readString(value.notes),
    favorite: value.favorite === true,
    created: value.created === true,
    transcript: readString(value.transcript),
    analysis: readString(value.analysis),
    localMediaName: readString(value.localMediaName),
    localMediaType: readString(value.localMediaType),
    localMediaSize: readNumber(value.localMediaSize),
    remoteWorkId: readString(value.remoteWorkId),
    description: readString(value.description),
    coverUrl: readString(value.coverUrl),
    quality: readString(value.quality),
    format: readString(value.format),
    codec: readString(value.codec),
    plays: readNumber(value.plays),
    expiresAt: readString(value.expiresAt),
    duration: readNumber(value.duration),
    decodeKey: readString(value.decodeKey),
    createdAt: readString(value.createdAt) || new Date().toISOString(),
  };
}

function readStore(): BenchmarkStore {
  if (typeof window === "undefined") return { version: 1, accounts: [], works: [] };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(parsed)) return { version: 1, accounts: [], works: [] };
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.map(normalizeAccount).filter((item): item is BenchmarkAccount => item !== null)
      : [];
    const accountIds = new Set(accounts.map((account) => account.id));
    const works = Array.isArray(parsed.works)
      ? parsed.works.map((item) => normalizeWork(item, accountIds)).filter((item): item is BenchmarkWork => item !== null)
      : [];
    return { version: 1, accounts, works };
  } catch {
    return { version: 1, accounts: [], works: [] };
  }
}

function formatCounter(value: number): string {
  return new Intl.NumberFormat("zh-CN", { notation: value >= 10_000 ? "compact" : "standard" }).format(value);
}

function formatFileSize(value: number): string {
  if (value <= 0) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function isoFromEpoch(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function downloadText(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function transcriptFromImportedFile(fileName: string, content: string): string {
  if (!fileName.toLowerCase().endsWith(".json")) return content;
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "string") return parsed;
    if (!isRecord(parsed)) return content;
    return readString(parsed.transcript) || readString(parsed.text) || readString(parsed.content) || content;
  } catch {
    return content;
  }
}

function makeMarkdown(work: BenchmarkWork, account: BenchmarkAccount | null): string {
  const source = work.url ? `[打开原作品](${work.url})` : "未填写";
  return [
    `# ${work.title}`,
    "",
    `- 账号：${account?.name ?? "未知账号"}`,
    `- 发布时间：${work.publishTime || "未填写"}`,
    `- 来源：${source}`,
    `- 点赞：${work.likes}`,
    `- 收藏：${work.favorites}`,
    `- 评论：${work.comments}`,
    `- 转发：${work.forwards}`,
    `- 增长：${work.growth}`,
    "",
    "## 转写文案",
    "",
    work.transcript || "（暂无转写）",
    "",
    "## 本地备注",
    "",
    work.notes || "（暂无备注）",
    "",
    "## 结构拆解",
    "",
    work.analysis || "（尚未执行结构拆解）",
    "",
  ].join("\n");
}

function mergeSyncedPage(
  current: BenchmarkStore,
  accountId: string,
  resolved: ResolvedBenchmarkAccount,
  result: SyncedBenchmarkResult,
  refreshedAt: string,
  resetPageDepth: boolean,
): BenchmarkStore {
  const accountWorks = current.works.filter((work) => work.accountId === accountId);
  const existingByRemoteId = new Map(
    accountWorks.filter((work) => work.remoteWorkId).map((work) => [work.remoteWorkId, work]),
  );
  const existingByUrl = new Map(
    accountWorks.filter((work) => work.url).map((work) => [work.url, work]),
  );
  const syncedById = new Map<string, BenchmarkWork>();

  result.works.forEach((remoteWork) => {
    const existing = existingByRemoteId.get(remoteWork.remoteWorkId)
      || existingByUrl.get(remoteWork.sourceUrl);
    const work = {
      id: existing?.id || createId("work"),
      accountId,
      url: remoteWork.sourceUrl,
      mediaUrl: remoteWork.mediaUrl,
      title: remoteWork.title,
      publishTime: isoFromEpoch(remoteWork.publishTime),
      likes: remoteWork.likes,
      favorites: remoteWork.favorites,
      comments: remoteWork.comments,
      forwards: remoteWork.forwards,
      growth: existing?.growth || 0,
      notes: existing?.notes || "",
      favorite: existing?.favorite || false,
      created: existing?.created || false,
      transcript: existing?.transcript || "",
      analysis: existing?.analysis || "",
      localMediaName: existing?.localMediaName || "",
      localMediaType: existing?.localMediaType || "",
      localMediaSize: existing?.localMediaSize || 0,
      remoteWorkId: remoteWork.remoteWorkId,
      description: existing?.description || "",
      coverUrl: remoteWork.coverUrl,
      quality: existing?.quality || "",
      format: existing?.format || "mp4",
      codec: existing?.codec || "",
      plays: existing?.plays || 0,
      expiresAt: existing?.expiresAt || "",
      duration: remoteWork.duration,
      decodeKey: remoteWork.decodeKey,
      createdAt: existing?.createdAt || refreshedAt,
    } satisfies BenchmarkWork;
    syncedById.set(work.id, work);
  });

  const syncedWorks = [...syncedById.values()];
  const syncedIds = new Set(syncedWorks.map((work) => work.id));
  return {
    ...current,
    accounts: current.accounts.map((item) => item.id === accountId ? {
      ...item,
      name: result.accountName || resolved.name || item.name,
      avatar: result.avatar || item.avatar,
      remoteId: result.remoteId || resolved.remoteId,
      lastBuffer: result.lastBuffer,
      continueFlag: result.continueFlag,
      pageDepth: resetPageDepth ? 1 : item.pageDepth + 1,
      lastRefreshAt: refreshedAt,
    } : item),
    works: [...syncedWorks, ...current.works.filter((work) => !syncedIds.has(work.id))],
  };
}

export function BenchmarkPage({
  initialSearch = "",
  onCreateTask,
  onAiCorrect,
  onAiAnalyze,
  onTranscribeMedia,
  onTranscribeSource,
}: BenchmarkPageProps) {
  const [store, setStore] = useState<BenchmarkStore>(readStore);
  const [query, setQuery] = useState(initialSearch);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("all");
  const [sortField, setSortField] = useState<SortField>("publishTime");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState("");
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(EMPTY_ACCOUNT_DRAFT);
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [workDraft, setWorkDraft] = useState<WorkDraft>(EMPTY_WORK_DRAFT);
  const [localMedia, setLocalMedia] = useState<Record<string, LocalMediaSession>>({});
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [showParser, setShowParser] = useState(false);
  const [parserUrl, setParserUrl] = useState("");
  const [parsedVideo, setParsedVideo] = useState<ParsedBenchmarkVideo | null>(null);
  const [providerStatus, setProviderStatus] = useState<BenchmarkProviderStatus | null>(null);
  const [asrStatus, setAsrStatus] = useState<AsrStatus | null>(null);
  const localMediaRef = useRef(localMedia);
  const continuousSyncTokenRef = useRef("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    setQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    void fetchBenchmarkProviderStatus()
      .then(setProviderStatus)
      .catch(() => setProviderStatus(null));
    void fetchAsrStatus()
      .then(setAsrStatus)
      .catch(() => setAsrStatus(null));
  }, []);

  useEffect(() => {
    localMediaRef.current = localMedia;
  }, [localMedia]);

  useEffect(() => () => {
    Object.values(localMediaRef.current).forEach((session) => URL.revokeObjectURL(session.url));
  }, []);

  const groups = useMemo(
    () => [...new Set(store.accounts.map((account) => account.group.trim()).filter(Boolean))].sort(),
    [store.accounts],
  );
  const tracks = useMemo(
    () => [...new Set(store.accounts.map((account) => account.track.trim()).filter(Boolean))].sort(),
    [store.accounts],
  );
  const filteredAccounts = useMemo(() => {
    const accounts = deferredQuery
      ? store.accounts.filter((account) =>
          [account.name, account.group, account.track, account.notes]
            .join(" ")
            .toLocaleLowerCase("zh-CN")
            .includes(deferredQuery),
        )
      : store.accounts;
    return [...accounts].sort((left, right) =>
      Number(right.favorite) - Number(left.favorite) || left.name.localeCompare(right.name, "zh-CN"),
    );
  }, [deferredQuery, store.accounts]);
  const visibleWorks = useMemo(() => {
    const filtered = store.works.filter((work) => {
      if (selectedAccountId !== "all" && work.accountId !== selectedAccountId) return false;
      if (workFilter === "favorite") return work.favorite;
      if (workFilter === "created") return work.created;
      if (workFilter === "uncreated") return !work.created;
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (sortField === "publishTime") {
        const leftTime = Date.parse(left.publishTime || left.createdAt) || 0;
        const rightTime = Date.parse(right.publishTime || right.createdAt) || 0;
        return rightTime - leftTime;
      }
      return right[sortField] - left[sortField];
    });
  }, [selectedAccountId, sortField, store.works, workFilter]);
  const selectedWork = store.works.find((work) => work.id === selectedWorkId) ?? null;
  const selectedAccount = selectedAccountId === "all"
    ? null
    : store.accounts.find((account) => account.id === selectedAccountId) ?? null;
  const selectedAccountWorkCount = selectedAccount
    ? store.works.filter((work) => work.accountId === selectedAccount.id).length
    : 0;
  const selectedWorkAccount = selectedWork
    ? store.accounts.find((account) => account.id === selectedWork.accountId) ?? null
    : null;
  const selectedLocalMedia = selectedWork ? localMedia[selectedWork.id] : undefined;

  const updateWork = (workId: string, patch: Partial<BenchmarkWork>): void => {
    setStore((current) => ({
      ...current,
      works: current.works.map((work) => (work.id === workId ? { ...work, ...patch } : work)),
    }));
  };

  const openNewAccountForm = (): void => {
    setEditingAccountId("");
    setAccountDraft({ ...EMPTY_ACCOUNT_DRAFT, name: query.trim() });
    setShowAccountForm(true);
  };

  const openRenameAccountForm = (account: BenchmarkAccount): void => {
    setEditingAccountId(account.id);
    setAccountDraft({
      name: account.name,
      sourceUrl: account.sourceUrl,
      group: account.group,
      track: account.track,
      notes: account.notes,
    });
    setShowAccountForm(true);
  };

  const saveAccount = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const name = accountDraft.name.trim();
    if (!name) {
      setNotice("请填写账号名。");
      return;
    }
    if (editingAccountId) {
      setStore((current) => ({
        ...current,
        accounts: current.accounts.map((account) =>
          account.id === editingAccountId
            ? {
                ...account,
                name,
                sourceUrl: accountDraft.sourceUrl.trim(),
                group: accountDraft.group.trim(),
                track: accountDraft.track.trim(),
                notes: accountDraft.notes.trim(),
              }
            : account,
        ),
      }));
      setNotice(`已更新账号“${name}”。`);
    } else {
      const account: BenchmarkAccount = {
        id: createId("account"),
        name,
        sourceUrl: accountDraft.sourceUrl.trim(),
        group: accountDraft.group.trim(),
        track: accountDraft.track.trim(),
        notes: accountDraft.notes.trim(),
        favorite: false,
        avatar: "",
        remoteId: "",
        lastBuffer: "",
        continueFlag: 0,
        pageDepth: 0,
        lastRefreshAt: "",
        createdAt: new Date().toISOString(),
      };
      setStore((current) => ({ ...current, accounts: [account, ...current.accounts] }));
      setSelectedAccountId(account.id);
      setNotice(`已添加账号“${name}”，仅保存公开来源与手工资料。`);
    }
    setShowAccountForm(false);
    setEditingAccountId("");
    setAccountDraft(EMPTY_ACCOUNT_DRAFT);
  };

  const deleteAccount = (account: BenchmarkAccount): void => {
    if (!window.confirm(`删除账号“${account.name}”及其全部本地作品记录？`)) return;
    const workIds = new Set(store.works.filter((work) => work.accountId === account.id).map((work) => work.id));
    workIds.forEach((workId) => {
      const session = localMedia[workId];
      if (session) URL.revokeObjectURL(session.url);
    });
    setLocalMedia((current) =>
      Object.fromEntries(Object.entries(current).filter(([workId]) => !workIds.has(workId))),
    );
    setStore((current) => ({
      ...current,
      accounts: current.accounts.filter((item) => item.id !== account.id),
      works: current.works.filter((work) => work.accountId !== account.id),
    }));
    if (selectedAccountId === account.id) setSelectedAccountId("all");
    if (selectedWork && workIds.has(selectedWork.id)) setSelectedWorkId("");
    setNotice("账号和关联作品已从本地资料库删除。");
  };

  const openNewWorkForm = (): void => {
    const accountId = selectedAccountId !== "all" ? selectedAccountId : store.accounts[0]?.id ?? "";
    setWorkDraft({ ...EMPTY_WORK_DRAFT, accountId });
    setShowWorkForm(true);
  };

  const saveWork = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const title = workDraft.title.trim();
    if (!workDraft.accountId || !title) {
      setNotice("请先选择账号并填写作品标题。");
      return;
    }
    const work: BenchmarkWork = {
      id: createId("work"),
      accountId: workDraft.accountId,
      url: workDraft.url.trim(),
      mediaUrl: workDraft.mediaUrl.trim(),
      title,
      publishTime: workDraft.publishTime,
      likes: readNumber(workDraft.likes),
      favorites: readNumber(workDraft.favorites),
      comments: readNumber(workDraft.comments),
      forwards: readNumber(workDraft.forwards),
      growth: readNumber(workDraft.growth),
      notes: workDraft.notes.trim(),
      favorite: false,
      created: false,
      transcript: "",
      analysis: "",
      localMediaName: "",
      localMediaType: "",
      localMediaSize: 0,
      remoteWorkId: "",
      description: "",
      coverUrl: "",
      quality: "",
      format: "",
      codec: "",
      plays: 0,
      expiresAt: "",
      duration: 0,
      decodeKey: "",
      createdAt: new Date().toISOString(),
    };
    setStore((current) => ({ ...current, works: [work, ...current.works] }));
    setSelectedWorkId(work.id);
    setSelectedAccountId(work.accountId);
    setWorkDraft(EMPTY_WORK_DRAFT);
    setShowWorkForm(false);
    setNotice("作品已保存到本地；未调用平台私有接口。");
  };

  const runVideoParser = async (): Promise<void> => {
    const url = parserUrl.trim();
    if (!url) {
      setNotice("请先粘贴公开视频分享链接。");
      return;
    }
    setBusyAction("parse-video");
    setParsedVideo(null);
    setNotice("");
    try {
      const video = await parseBenchmarkVideo(url);
      setParsedVideo(video);
      setNotice(`解析完成：${video.title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "视频解析失败。");
    } finally {
      setBusyAction("");
    }
  };

  const saveParsedVideo = (): void => {
    if (!parsedVideo) return;
    const namedAccount = parsedVideo.authorName
      ? store.accounts.find((account) => account.name === parsedVideo.authorName)
      : undefined;
    const selectedAccount = selectedAccountId === "all"
      ? undefined
      : store.accounts.find((account) => account.id === selectedAccountId);
    const account = namedAccount || selectedAccount;
    const accountId = account?.id || createId("account");
    const workId = store.works.find((work) => work.url === parsedVideo.sourceUrl)?.id || createId("work");
    const now = new Date().toISOString();
    const nextAccount: BenchmarkAccount = account || {
      id: accountId,
      name: parsedVideo.authorName || "解析视频账号",
      sourceUrl: parsedVideo.sourceUrl,
      group: "",
      track: "",
      notes: "由单视频解析自动建立",
      favorite: false,
      avatar: parsedVideo.authorAvatar,
      remoteId: "",
      lastBuffer: "",
      continueFlag: 0,
      pageDepth: 0,
      lastRefreshAt: "",
      createdAt: now,
    };
    const nextWork: BenchmarkWork = {
      id: workId,
      accountId,
      url: parsedVideo.sourceUrl,
      mediaUrl: parsedVideo.mediaUrl,
      title: parsedVideo.title,
      publishTime: isoFromEpoch(parsedVideo.publishTime),
      likes: parsedVideo.likes,
      favorites: parsedVideo.favorites,
      comments: parsedVideo.comments,
      forwards: parsedVideo.forwards,
      growth: 0,
      notes: parsedVideo.description,
      favorite: false,
      created: false,
      transcript: "",
      analysis: "",
      localMediaName: "",
      localMediaType: "",
      localMediaSize: 0,
      remoteWorkId: "",
      description: parsedVideo.description,
      coverUrl: parsedVideo.coverUrl,
      quality: parsedVideo.quality,
      format: parsedVideo.format,
      codec: parsedVideo.codec,
      plays: parsedVideo.plays,
      expiresAt: parsedVideo.expiresAt,
      duration: 0,
      decodeKey: "",
      createdAt: now,
    };
    setStore((current) => {
      const hasAccount = current.accounts.some((item) => item.id === accountId);
      const hasWork = current.works.some((item) => item.id === workId);
      return {
        ...current,
        accounts: hasAccount
          ? current.accounts.map((item) =>
              item.id === accountId && parsedVideo.authorAvatar
                ? { ...item, avatar: parsedVideo.authorAvatar }
                : item,
            )
          : [nextAccount, ...current.accounts],
        works: hasWork
          ? current.works.map((item) => item.id === workId ? { ...item, ...nextWork } : item)
          : [nextWork, ...current.works],
      };
    });
    setSelectedAccountId(accountId);
    setSelectedWorkId(workId);
    setShowParser(false);
    setParsedVideo(null);
    setParserUrl("");
    setNotice(account ? "解析结果已更新到现有账号。" : `已建立账号“${nextAccount.name}”并保存作品。`);
  };

  const recognizeAccountFromLink = async (): Promise<void> => {
    const url = accountDraft.sourceUrl.trim();
    if (!url) {
      setNotice("请先粘贴该账号任意一条公开视频分享链接。");
      return;
    }
    setBusyAction("recognize-account");
    setNotice("");
    try {
      if (providerStatus?.accountSync.configured) {
        const remote = await resolveBenchmarkAccount(url);
        setAccountDraft((draft) => ({ ...draft, name: remote.name || draft.name }));
        setNotice(`已由账号数据源识别：${remote.name}`);
      } else {
        const video = await parseBenchmarkVideo(url);
        setAccountDraft((draft) => ({
          ...draft,
          name: video.authorName || draft.name,
        }));
        setNotice(video.authorName
          ? `已从公开视频识别作者：${video.authorName}`
          : "视频已解析，但服务未返回作者名，请手工填写账号名。");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "账号识别失败。");
    } finally {
      setBusyAction("");
    }
  };

  const refreshAccount = async (account: BenchmarkAccount): Promise<void> => {
    if (!providerStatus?.accountSync.configured) {
      setNotice("自动刷新尚未配置。原版账号列表接口需要绑定邮箱、设备指纹并可能扣除积分；单视频解析仍可直接使用。");
      return;
    }
    if (!account.remoteId && !account.sourceUrl) {
      setNotice("此账号没有远端 ID 或公开视频分享链接，无法识别并刷新。");
      return;
    }
    if (!window.confirm(`刷新“${account.name}”的最新 15 条作品将调用配置的账号数据源，并可能扣除原站积分。是否继续？`)) return;
    setBusyAction(`refresh-${account.id}`);
    setNotice("");
    try {
      const resolved = account.remoteId
        ? { remoteId: account.remoteId, name: account.name, sourceUrl: account.sourceUrl, objectId: "" }
        : await resolveBenchmarkAccount(account.sourceUrl);
      const result = await fetchBenchmarkWorks(resolved.remoteId);
      const refreshedAt = new Date().toISOString();
      setStore((current) => mergeSyncedPage(current, account.id, resolved, result, refreshedAt, true));
      setSelectedAccountId(account.id);
      setNotice(
        `已同步最新 ${result.works.length} 条作品${result.cost ? `，数据源报告消耗 ${result.cost} 积分` : ""}`
        + `${result.continueFlag === 1 ? "；还有历史作品，可继续加载。" : "；已到作品末页。"}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "账号刷新失败。");
    } finally {
      setBusyAction("");
    }
  };

  const loadMoreAccount = async (account: BenchmarkAccount): Promise<void> => {
    if (!providerStatus?.accountSync.configured) {
      setNotice("账号作品同步未配置，请先在原客户端绑定邮箱，并为本地服务配置当前设备凭据。");
      return;
    }
    if (!account.remoteId || !account.lastBuffer || account.continueFlag !== 1) {
      setNotice("当前账号没有可继续加载的历史页，请先刷新最新作品。");
      return;
    }
    if (!window.confirm(`加载“${account.name}”下一页历史作品（最多 15 条）可能扣除一次原站积分。是否继续？`)) return;
    setBusyAction(`load-more-${account.id}`);
    setNotice("");
    try {
      const result = await fetchBenchmarkWorks(account.remoteId, account.lastBuffer);
      const resolved = {
        remoteId: account.remoteId,
        name: account.name,
        sourceUrl: account.sourceUrl,
        objectId: "",
      };
      setStore((current) =>
        mergeSyncedPage(current, account.id, resolved, result, new Date().toISOString(), false));
      setNotice(
        `已加载 ${result.works.length} 条历史作品${result.cost ? `，数据源报告消耗 ${result.cost} 积分` : ""}`
        + `${result.continueFlag === 1 ? "；仍有更多历史页。" : "；已到作品末页。"}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "历史作品加载失败。");
    } finally {
      setBusyAction("");
    }
  };

  const stopContinuousSync = (account: BenchmarkAccount): void => {
    continuousSyncTokenRef.current = "";
    setNotice(`正在停止“${account.name}”的连续加载；当前请求返回后即停止。`);
  };

  const syncAllHistory = async (account: BenchmarkAccount): Promise<void> => {
    if (!providerStatus?.accountSync.configured) {
      setNotice("账号作品同步未配置，请先在原客户端绑定邮箱，并为本地服务配置当前设备凭据。");
      return;
    }
    if (!account.remoteId && !account.sourceUrl) {
      setNotice("此账号没有远端 ID 或公开视频分享链接，无法识别并同步。");
      return;
    }
    if (account.pageDepth > 0 && account.continueFlag !== 1) {
      setNotice("当前账号已经加载到作品末页。");
      return;
    }
    if (!window.confirm(
      `连续加载“${account.name}”的全部历史作品会逐页请求，每页最多 15 条、每页都可能扣除原站积分。可在运行时停止，是否继续？`,
    )) return;

    const token = createId("continuous-sync");
    continuousSyncTokenRef.current = token;
    setBusyAction(`sync-all-${account.id}`);
    setNotice("正在准备连续加载历史作品…");
    let pagesLoaded = 0;
    let worksLoaded = 0;
    let creditsReported = 0;
    let stopped = false;

    try {
      const resolved = account.remoteId
        ? { remoteId: account.remoteId, name: account.name, sourceUrl: account.sourceUrl, objectId: "" }
        : await resolveBenchmarkAccount(account.sourceUrl);
      let cursor = account.pageDepth > 0 ? account.lastBuffer : "";
      let resetPageDepth = account.pageDepth === 0;
      let continueFlag = account.pageDepth === 0 ? 1 : account.continueFlag;

      while (continueFlag === 1 && pagesLoaded < MAX_CONTINUOUS_SYNC_PAGES) {
        const result = await fetchBenchmarkWorks(resolved.remoteId, cursor);
        setStore((current) =>
          mergeSyncedPage(current, account.id, resolved, result, new Date().toISOString(), resetPageDepth));
        resetPageDepth = false;
        pagesLoaded += 1;
        worksLoaded += result.works.length;
        creditsReported += result.cost;

        if (continuousSyncTokenRef.current !== token) {
          stopped = true;
          break;
        }
        if (result.continueFlag !== 1 || !result.lastBuffer || result.lastBuffer === cursor) {
          continueFlag = 0;
          break;
        }
        cursor = result.lastBuffer;
        continueFlag = result.continueFlag;
        setNotice(`连续加载中：已完成 ${pagesLoaded} 页、返回 ${worksLoaded} 条作品…`);
      }

      const reachedSafetyLimit = pagesLoaded >= MAX_CONTINUOUS_SYNC_PAGES && continueFlag === 1;
      setNotice(
        stopped
          ? `已停止连续加载；本次完成 ${pagesLoaded} 页、返回 ${worksLoaded} 条作品。`
          : `连续加载完成：${pagesLoaded} 页、返回 ${worksLoaded} 条作品`
            + `${creditsReported ? `，数据源共报告消耗 ${creditsReported} 积分` : ""}`
            + `${reachedSafetyLimit ? `；已到 ${MAX_CONTINUOUS_SYNC_PAGES} 页安全上限，可再次继续。` : "。"}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "连续加载历史作品失败。");
    } finally {
      if (continuousSyncTokenRef.current === token) continuousSyncTokenRef.current = "";
      setBusyAction("");
    }
  };

  const deleteWork = (work: BenchmarkWork): void => {
    if (!window.confirm(`删除作品“${work.title}”的本地记录？`)) return;
    const session = localMedia[work.id];
    if (session) URL.revokeObjectURL(session.url);
    setLocalMedia((current) => {
      const next = { ...current };
      delete next[work.id];
      return next;
    });
    setStore((current) => ({ ...current, works: current.works.filter((item) => item.id !== work.id) }));
    if (selectedWorkId === work.id) setSelectedWorkId("");
    setNotice("作品记录已删除。");
  };

  const attachMedia = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file || !selectedWork) return;
    const previous = localMedia[selectedWork.id];
    if (previous) URL.revokeObjectURL(previous.url);
    const session = { file, url: URL.createObjectURL(file) };
    setLocalMedia((current) => ({ ...current, [selectedWork.id]: session }));
    updateWork(selectedWork.id, {
      localMediaName: file.name,
      localMediaType: file.type,
      localMediaSize: file.size,
    });
    setNotice("本地媒体已附加到当前会话。刷新后浏览器不会保留文件权限，需重新选择。");
    event.target.value = "";
  };

  const importTranscript = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !selectedWork) return;
    try {
      const content = await file.text();
      updateWork(selectedWork.id, { transcript: transcriptFromImportedFile(file.name, content) });
      setNotice(`已导入转写文件：${file.name}`);
    } catch {
      setNotice("转写文件读取失败，请改为手工粘贴。");
    }
    event.target.value = "";
  };

  const copyTranscript = async (): Promise<void> => {
    if (!selectedWork?.transcript.trim()) {
      setNotice("当前没有可复制的转写内容。");
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedWork.transcript);
      setNotice("转写文案已复制。");
    } catch {
      setNotice("浏览器未授予剪贴板权限，请在文本框中手工复制。");
    }
  };

  const transcribeMedia = async (): Promise<void> => {
    if (!selectedWork || !selectedLocalMedia) {
      setNotice("请先为当前作品选择本地音频或视频文件。");
      return;
    }
    if (!onTranscribeMedia) {
      setNotice("当前未配置本地转写服务；可导入 transcript 或手工粘贴。");
      return;
    }
    setBusyAction("transcribe");
    setNotice("");
    try {
      const transcript = await onTranscribeMedia(selectedLocalMedia.file, selectedWork);
      if (!transcript.trim()) throw new Error("转写服务未返回文本");
      updateWork(selectedWork.id, { transcript });
      setNotice("本地媒体转写完成。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "本地媒体转写失败。");
    } finally {
      setBusyAction("");
    }
  };

  const transcribeSource = async (): Promise<void> => {
    if (!selectedWork?.url) {
      setNotice("当前作品没有可重新解析的公开视频来源。");
      return;
    }
    if (!onTranscribeSource) {
      setNotice("当前未接入链接转写服务；可以下载媒体后选择本地文件转写。");
      return;
    }
    setBusyAction("transcribe-source");
    setNotice("正在下载无水印媒体并进行本地转写，首次加载模型可能需要一些时间……");
    try {
      const transcript = await onTranscribeSource(selectedWork.url, selectedWork);
      if (!transcript.trim()) throw new Error("转写服务未返回文本");
      updateWork(selectedWork.id, { transcript });
      setNotice("公开视频文案提取完成，已写入转写文案。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "公开视频文案提取失败。");
    } finally {
      setBusyAction("");
    }
  };

  const runAiAction = async (kind: "correct" | "analyze"): Promise<void> => {
    if (!selectedWork) return;
    const callback = kind === "correct" ? onAiCorrect : onAiAnalyze;
    if (!callback) {
      setNotice(`未配置 AI ${kind === "correct" ? "纠错" : "结构拆解"}服务；本地数据未被发送。`);
      return;
    }
    if (!selectedWork.transcript.trim()) {
      setNotice("请先填写或导入转写文案。");
      return;
    }
    setBusyAction(kind);
    setNotice("");
    try {
      const result = await callback({
        account: selectedWorkAccount,
        work: selectedWork,
        transcript: selectedWork.transcript,
      });
      if (!result.trim()) throw new Error("AI 服务未返回有效内容");
      updateWork(selectedWork.id, kind === "correct" ? { transcript: result } : { analysis: result });
      setNotice(kind === "correct" ? "AI 纠错结果已写入文案。" : "结构拆解已保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 操作失败。");
    } finally {
      setBusyAction("");
    }
  };

  const createTask = (): void => {
    if (!selectedWork) return;
    if (!onCreateTask) {
      setNotice("尚未接入任务创建回调；当前转写仍已安全保存在本地。");
      return;
    }
    onCreateTask({
      workId: selectedWork.id,
      title: selectedWork.title,
      accountName: selectedWorkAccount?.name ?? "",
      sourceUrl: selectedWork.url,
      transcript: selectedWork.transcript,
      notes: selectedWork.notes,
    });
    updateWork(selectedWork.id, { created: true });
    setNotice("已把当前文案交给任务创建流程。");
  };

  const mediaSource = selectedWork ? selectedWork.mediaUrl || selectedWork.url : "";
  const hasDirectMedia = Boolean(selectedWork?.mediaUrl) || DIRECT_MEDIA_PATTERN.test(mediaSource);

  return (
    <main className="benchmark-page">
      <header className="benchmark-page__header">
        <div>
          <span className="benchmark-page__eyebrow">VIDEO BENCHMARK WORKBENCH</span>
          <h1>对标监控</h1>
          <p>解析公开视频、同步账号作品、提取文案；账号列表按原版规则分页载入。</p>
          <div className="benchmark-provider-status" aria-label="对标数据源状态">
            <span className={providerStatus?.singleVideoParser.available ? "is-ready" : ""}>
              单视频解析：{providerStatus?.singleVideoParser.available ? "可用" : "检查中"}
            </span>
            <span className={providerStatus?.accountSync.configured ? "is-ready" : "is-limited"}>
              账号作品同步：{providerStatus?.accountSync.configured ? "已就绪" : "未配置"}
            </span>
            <span className={asrStatus?.available ? "is-ready" : "is-limited"}>
              本地转写：{asrStatus?.available
                ? `${asrStatus.model || asrStatus.provider}${asrStatus.device ? ` · ${asrStatus.device}` : ""}`
                : "未就绪"}
            </span>
          </div>
        </div>
        <div className="benchmark-page__summary" aria-label="本地资料统计">
          <strong>{store.accounts.length}</strong><span>账号</span>
          <strong>{store.works.length}</strong><span>作品</span>
        </div>
      </header>

      {notice ? (
        <div className="benchmark-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="关闭提示">×</button>
        </div>
      ) : null}

      {showParser ? (
        <section className="benchmark-parser-panel" aria-label="单视频解析">
          <header>
            <div>
              <strong>单视频解析 / 无水印链接</strong>
              <span>使用原版客户端同一路径的公开免费解析接口，不扣 Storybound 积分。</span>
            </div>
            <button type="button" onClick={() => setShowParser(false)} aria-label="关闭单视频解析">×</button>
          </header>
          <div className="benchmark-parser-input">
            <input
              type="url"
              value={parserUrl}
              onChange={(event) => setParserUrl(event.target.value)}
              placeholder="粘贴 https://weixin.qq.com/sph/... 或其他公开视频分享链接"
              aria-label="待解析视频链接"
            />
            <button
              className="benchmark-primary"
              type="button"
              disabled={busyAction === "parse-video"}
              onClick={() => void runVideoParser()}
            >
              {busyAction === "parse-video" ? "解析中…" : parsedVideo ? "重新解析" : "解析"}
            </button>
          </div>
          {parsedVideo ? (
            <div className="benchmark-parser-result">
              {parsedVideo.coverUrl ? <img src={parsedVideo.coverUrl} alt="" /> : <div className="benchmark-parser-cover">VIDEO</div>}
              <div>
                <span>{parsedVideo.authorName || "未识别作者"} · {[parsedVideo.quality, parsedVideo.codec.toUpperCase()].filter(Boolean).join(" · ")}</span>
                <strong>{parsedVideo.title}</strong>
                <small>
                  {parsedVideo.mediaUrl ? "已取得媒体直链" : "未取得媒体直链"}
                  {parsedVideo.expiresAt ? ` · 链接有效期至 ${parsedVideo.expiresAt}` : ""}
                </small>
              </div>
              <div className="benchmark-parser-actions">
                <a href={parsedVideo.sourceUrl} target="_blank" rel="noreferrer">原作品</a>
                {parsedVideo.mediaUrl ? <a href={parsedVideo.mediaUrl} target="_blank" rel="noreferrer" download>下载视频</a> : null}
                <button className="benchmark-primary" type="button" onClick={saveParsedVideo}>保存到资料库</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="benchmark-layout">
        <aside className="benchmark-account-rail">
          <div className="benchmark-account-rail__tools">
            <label className="benchmark-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜账号名"
                aria-label="搜索已有账号"
              />
            </label>
            <button className="benchmark-primary" type="button" onClick={openNewAccountForm}>＋ 添加账号</button>
          </div>

          {showAccountForm ? (
            <form className="benchmark-inline-form" onSubmit={saveAccount}>
              <div className="benchmark-inline-form__head">
                <strong>{editingAccountId ? "编辑账号" : "添加账号"}</strong>
                <button type="button" onClick={() => setShowAccountForm(false)} aria-label="关闭账号表单">×</button>
              </div>
              <label>账号名<input required value={accountDraft.name} onChange={(event) => setAccountDraft((draft) => ({ ...draft, name: event.target.value }))} /></label>
              <label>公开视频/分享 URL<input type="url" value={accountDraft.sourceUrl} onChange={(event) => setAccountDraft((draft) => ({ ...draft, sourceUrl: event.target.value }))} placeholder="粘贴该账号任意一条公开视频" /></label>
              {!editingAccountId ? (
                <button
                  className="benchmark-recognize-button"
                  type="button"
                  disabled={busyAction === "recognize-account"}
                  onClick={() => void recognizeAccountFromLink()}
                >
                  {busyAction === "recognize-account" ? "识别中…" : "从分享链接识别账号"}
                </button>
              ) : null}
              <div className="benchmark-form-grid benchmark-form-grid--two">
                <label>分组<input list="benchmark-groups" value={accountDraft.group} onChange={(event) => setAccountDraft((draft) => ({ ...draft, group: event.target.value }))} /></label>
                <label>赛道<input list="benchmark-tracks" value={accountDraft.track} onChange={(event) => setAccountDraft((draft) => ({ ...draft, track: event.target.value }))} /></label>
              </div>
              <label>备注<textarea value={accountDraft.notes} onChange={(event) => setAccountDraft((draft) => ({ ...draft, notes: event.target.value }))} /></label>
              <div className="benchmark-inline-form__actions">
                <button type="button" onClick={() => setShowAccountForm(false)}>取消</button>
                <button className="benchmark-primary" type="submit">保存</button>
              </div>
            </form>
          ) : null}

          <datalist id="benchmark-groups">{groups.map((group) => <option key={group} value={group} />)}</datalist>
          <datalist id="benchmark-tracks">{tracks.map((track) => <option key={track} value={track} />)}</datalist>

          <nav className="benchmark-account-list" aria-label="对标账号">
            <button
              className={selectedAccountId === "all" ? "is-selected" : ""}
              type="button"
              onClick={() => setSelectedAccountId("all")}
            >
              <span className="benchmark-account-avatar">全</span>
              <span><strong>全部账号</strong><small>{store.works.length} 个作品</small></span>
            </button>
            {filteredAccounts.map((account) => {
              const workCount = store.works.filter((work) => work.accountId === account.id).length;
              return (
                <article className={selectedAccountId === account.id ? "is-selected" : ""} key={account.id}>
                  <button className="benchmark-account-main" type="button" onClick={() => setSelectedAccountId(account.id)}>
                    <span className="benchmark-account-avatar">{account.name.slice(0, 1)}</span>
                    <span>
                      <strong>{account.name}</strong>
                      <small>{[account.group, account.track].filter(Boolean).join(" · ") || "未分组"} · {workCount}</small>
                    </span>
                    {account.favorite ? <em title="已收藏">★</em> : null}
                  </button>
                  <div className="benchmark-account-actions">
                    <button
                      type="button"
                      disabled={!providerStatus?.accountSync.configured || Boolean(busyAction)}
                      onClick={() => void refreshAccount(account)}
                      title={providerStatus?.accountSync.configured ? "同步最新一页（最多 15 条）" : "原客户端尚未绑定账号数据源"}
                    >
                      {busyAction === `refresh-${account.id}` ? "刷新中" : "刷新最新"}
                    </button>
                    <button type="button" onClick={() => setStore((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === account.id ? { ...item, favorite: !item.favorite } : item) }))}>{account.favorite ? "取消收藏" : "收藏"}</button>
                    <button type="button" onClick={() => openRenameAccountForm(account)}>重命名</button>
                    <button className="is-danger" type="button" onClick={() => deleteAccount(account)}>删除</button>
                  </div>
                </article>
              );
            })}
          </nav>
          {deferredQuery && filteredAccounts.length === 0 ? (
            <div className="benchmark-rail-empty">
              <strong>没有匹配的已有账号</strong>
              <span>确认搜索结果后，可用当前名称添加新账号。</span>
            </div>
          ) : null}
        </aside>

        <section className="benchmark-workspace">
          <div className="benchmark-work-toolbar">
            <div className="benchmark-filter-tabs" role="group" aria-label="作品筛选">
              {([
                ["all", "全部"],
                ["favorite", "收藏"],
                ["created", "已创作"],
                ["uncreated", "未创作"],
              ] as const).map(([value, label]) => (
                <button className={workFilter === value ? "is-selected" : ""} type="button" key={value} onClick={() => setWorkFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="benchmark-sort">
              <span>排序</span>
              <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
                <option value="publishTime">发布时间</option>
                <option value="likes">点赞</option>
                <option value="favorites">收藏</option>
                <option value="comments">评论</option>
                <option value="forwards">转发</option>
                <option value="growth">增长</option>
              </select>
            </label>
            <div className="benchmark-toolbar-actions">
              <button type="button" onClick={() => { setShowParser(true); setParsedVideo(null); }}>单视频解析</button>
              <button className="benchmark-primary" type="button" onClick={openNewWorkForm} disabled={store.accounts.length === 0}>＋ 手工导入</button>
            </div>
          </div>

          {selectedAccount ? (
            <section className="benchmark-sync-panel" aria-label={`${selectedAccount.name} 作品同步`}>
              <header>
                <div>
                  <strong>{selectedAccount.name} · 作品同步</strong>
                  <span>刷新最新一页（最多 15 条）；历史作品用“加载更多”或“连续加载”逐页补齐。</span>
                </div>
                <dl>
                  <div><dt>已保存</dt><dd>{selectedAccountWorkCount}</dd></div>
                  <div><dt>已载入</dt><dd>{selectedAccount.pageDepth} 页</dd></div>
                  <div><dt>历史</dt><dd>{selectedAccount.continueFlag === 1 ? "还有更多" : selectedAccount.pageDepth > 0 ? "已到底" : "未检查"}</dd></div>
                </dl>
              </header>
              <div className="benchmark-sync-panel__actions">
                <button
                  className="benchmark-primary"
                  type="button"
                  disabled={!providerStatus?.accountSync.configured || Boolean(busyAction)}
                  onClick={() => void refreshAccount(selectedAccount)}
                >
                  {busyAction === `refresh-${selectedAccount.id}` ? "刷新中…" : "刷新最新 15 条"}
                </button>
                <button
                  type="button"
                  disabled={
                    !providerStatus?.accountSync.configured
                    || selectedAccount.continueFlag !== 1
                    || !selectedAccount.lastBuffer
                    || Boolean(busyAction)
                  }
                  onClick={() => void loadMoreAccount(selectedAccount)}
                >
                  {busyAction === `load-more-${selectedAccount.id}` ? "加载中…" : "加载更多 15 条"}
                </button>
                <button
                  type="button"
                  disabled={
                    busyAction === `sync-all-${selectedAccount.id}`
                      ? false
                      : !providerStatus?.accountSync.configured
                        || Boolean(busyAction)
                        || (selectedAccount.pageDepth > 0 && selectedAccount.continueFlag !== 1)
                  }
                  onClick={() => {
                    if (busyAction === `sync-all-${selectedAccount.id}`) {
                      stopContinuousSync(selectedAccount);
                    } else {
                      void syncAllHistory(selectedAccount);
                    }
                  }}
                >
                  {busyAction === `sync-all-${selectedAccount.id}` ? "停止连续加载" : "连续加载全部历史"}
                </button>
              </div>
              {!providerStatus?.accountSync.configured ? (
                <p>当前未配置原版账号凭据，因此不能自动拉取作品。单视频解析仍可使用；MiniMax API 不负责账号作品同步。</p>
              ) : (
                <p>账号同步调用原版兼容数据源并可能按页扣积分；每次操作前都会再次确认。</p>
              )}
            </section>
          ) : null}

          {showWorkForm ? (
            <form className="benchmark-work-form" onSubmit={saveWork}>
              <div className="benchmark-work-form__head">
                <div><strong>导入单个视频</strong><span>仅保存你填写的公开信息，不自动抓取平台数据。</span></div>
                <button type="button" onClick={() => setShowWorkForm(false)} aria-label="关闭作品表单">×</button>
              </div>
              <div className="benchmark-form-grid benchmark-form-grid--three">
                <label>账号<select required value={workDraft.accountId} onChange={(event) => setWorkDraft((draft) => ({ ...draft, accountId: event.target.value }))}><option value="">请选择</option>{store.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label className="benchmark-span-two">作品标题<input required value={workDraft.title} onChange={(event) => setWorkDraft((draft) => ({ ...draft, title: event.target.value }))} /></label>
                <label className="benchmark-span-two">公开视频/分享 URL<input type="url" value={workDraft.url} onChange={(event) => setWorkDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder="保留原作品来源" /></label>
                <label>发布时间<input type="datetime-local" value={workDraft.publishTime} onChange={(event) => setWorkDraft((draft) => ({ ...draft, publishTime: event.target.value }))} /></label>
                <label className="benchmark-span-three">可下载媒体 URL（可选）<input type="url" value={workDraft.mediaUrl} onChange={(event) => setWorkDraft((draft) => ({ ...draft, mediaUrl: event.target.value }))} placeholder="仅扩展名明确的 mp4/mp3 等直链会显示下载" /></label>
              </div>
              <div className="benchmark-form-grid benchmark-form-grid--five">
                <label>点赞<input min="0" type="number" value={workDraft.likes} onChange={(event) => setWorkDraft((draft) => ({ ...draft, likes: event.target.value }))} /></label>
                <label>收藏<input min="0" type="number" value={workDraft.favorites} onChange={(event) => setWorkDraft((draft) => ({ ...draft, favorites: event.target.value }))} /></label>
                <label>评论<input min="0" type="number" value={workDraft.comments} onChange={(event) => setWorkDraft((draft) => ({ ...draft, comments: event.target.value }))} /></label>
                <label>转发<input min="0" type="number" value={workDraft.forwards} onChange={(event) => setWorkDraft((draft) => ({ ...draft, forwards: event.target.value }))} /></label>
                <label>增长<input min="0" type="number" value={workDraft.growth} onChange={(event) => setWorkDraft((draft) => ({ ...draft, growth: event.target.value }))} /></label>
              </div>
              <label className="benchmark-block-label">本地备注<textarea value={workDraft.notes} onChange={(event) => setWorkDraft((draft) => ({ ...draft, notes: event.target.value }))} /></label>
              <div className="benchmark-work-form__actions">
                <button type="button" onClick={() => setShowWorkForm(false)}>取消</button>
                <button className="benchmark-primary" type="submit">保存作品</button>
              </div>
            </form>
          ) : null}

          {store.accounts.length === 0 ? (
            <div className="benchmark-empty">
              <span aria-hidden="true">◎</span>
              <strong>先建立一个对标账号</strong>
              <p>可以先解析一条公开视频自动建立作者账号，也可以手工添加。</p>
              <div className="benchmark-empty-actions">
                <button type="button" onClick={() => setShowParser(true)}>单视频解析</button>
                <button className="benchmark-primary" type="button" onClick={openNewAccountForm}>手工添加账号</button>
              </div>
            </div>
          ) : visibleWorks.length === 0 ? (
            <div className="benchmark-empty">
              <span aria-hidden="true">▤</span>
              <strong>当前筛选下没有作品</strong>
              <p>导入单个视频的标题、来源和计数，再附加本地媒体或 transcript。</p>
              <button className="benchmark-primary" type="button" onClick={openNewWorkForm}>导入作品</button>
            </div>
          ) : (
            <div className="benchmark-work-list">
              {visibleWorks.map((work) => {
                const account = store.accounts.find((item) => item.id === work.accountId);
                return (
                  <article className={selectedWorkId === work.id ? "is-selected" : ""} key={work.id}>
                    <button className={`benchmark-work-main${work.coverUrl ? " has-cover" : ""}`} type="button" onClick={() => setSelectedWorkId(work.id)}>
                      {work.coverUrl ? <img className="benchmark-work-cover" src={work.coverUrl} alt="" /> : null}
                      <div className="benchmark-work-title">
                        <span>{work.created ? "已创作" : "待创作"}</span>
                        <strong>{work.title}</strong>
                        {work.favorite ? <em title="已收藏">★</em> : null}
                      </div>
                      <p>{account?.name ?? "未知账号"} · {work.publishTime ? new Date(work.publishTime).toLocaleString("zh-CN") : "未填写发布时间"}</p>
                      <dl>
                        <div><dt>赞</dt><dd>{formatCounter(work.likes)}</dd></div>
                        <div><dt>藏</dt><dd>{formatCounter(work.favorites)}</dd></div>
                        <div><dt>评</dt><dd>{formatCounter(work.comments)}</dd></div>
                        <div><dt>转</dt><dd>{formatCounter(work.forwards)}</dd></div>
                        <div><dt>增长</dt><dd>{formatCounter(work.growth)}</dd></div>
                      </dl>
                    </button>
                    <div className="benchmark-work-actions">
                      {work.url ? <a href={work.url} target="_blank" rel="noreferrer">来源</a> : <span>无来源</span>}
                      <button type="button" onClick={() => updateWork(work.id, { favorite: !work.favorite })}>{work.favorite ? "取消收藏" : "收藏"}</button>
                      <button className="is-danger" type="button" onClick={() => deleteWork(work)}>删除</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {selectedWork ? (
            <section className="benchmark-transcript-panel">
              <header>
                <div>
                  <span>作品资料与转写</span>
                  <h2>{selectedWork.title}</h2>
                  <p>{selectedWorkAccount?.name ?? "未知账号"} · 数据保存在本机 localStorage</p>
                </div>
                <button type="button" onClick={() => setSelectedWorkId("")} aria-label="关闭作品详情">×</button>
              </header>

              <div className="benchmark-source-row">
                {selectedWork.url ? <a href={selectedWork.url} target="_blank" rel="noreferrer">打开原作品 ↗</a> : <span>未填写来源 URL</span>}
                {hasDirectMedia ? <a href={mediaSource} download target="_blank" rel="noreferrer">下载媒体</a> : <span>当前链接不是可确认的媒体直链，仅保留来源</span>}
              </div>

              <div className="benchmark-media-box">
                <div>
                  <strong>本地音视频</strong>
                  <span>{selectedWork.localMediaName ? `${selectedWork.localMediaName} · ${formatFileSize(selectedWork.localMediaSize)}` : "尚未选择文件"}</span>
                </div>
                {selectedWork.url ? (
                  <button
                    className="benchmark-primary"
                    type="button"
                    disabled={!asrStatus?.available || Boolean(busyAction)}
                    onClick={() => void transcribeSource()}
                  >
                    {busyAction === "transcribe-source" ? "提取中…" : "一键提取公开视频文案"}
                  </button>
                ) : null}
                <label className="benchmark-file-button">
                  选择文件
                  <input type="file" accept="audio/*,video/*" onChange={attachMedia} />
                </label>
                <button type="button" disabled={!asrStatus?.available || Boolean(busyAction)} onClick={() => void transcribeMedia()}>
                  {busyAction === "transcribe" ? "转写中…" : "转写本地文件"}
                </button>
              </div>

              {selectedLocalMedia ? (
                selectedLocalMedia.file.type.startsWith("video/")
                  ? <video className="benchmark-media-preview" controls src={selectedLocalMedia.url} />
                  : <audio className="benchmark-media-preview" controls src={selectedLocalMedia.url} />
              ) : selectedWork.localMediaName ? (
                <p className="benchmark-session-warning">浏览器刷新后已失去本地文件权限，请重新选择“{selectedWork.localMediaName}”。</p>
              ) : null}

              <label className="benchmark-transcript-field">
                <span><strong>转写文案</strong><small>{selectedWork.transcript.length} 字</small></span>
                <textarea
                  value={selectedWork.transcript}
                  onChange={(event) => updateWork(selectedWork.id, { transcript: event.target.value })}
                  placeholder="手工粘贴文案，或从 TXT / Markdown / SRT / VTT / JSON 文件导入…"
                />
              </label>

              <div className="benchmark-transcript-actions">
                <button type="button" onClick={() => void copyTranscript()}>复制</button>
                <label className="benchmark-file-button">导入 transcript<input type="file" accept=".txt,.md,.srt,.vtt,.json,text/plain,application/json" onChange={(event) => void importTranscript(event)} /></label>
                <button type="button" onClick={() => updateWork(selectedWork.id, { created: !selectedWork.created })}>{selectedWork.created ? "取消创作标记" : "标记已创作"}</button>
                <button type="button" onClick={() => downloadText(`${selectedWork.title || "对标作品"}.md`, makeMarkdown(selectedWork, selectedWorkAccount), "text/markdown;charset=utf-8")}>导出 Markdown</button>
                <button className="benchmark-primary" type="button" onClick={createTask}>用此文案创建任务</button>
              </div>

              <div className="benchmark-ai-actions">
                <div><strong>AI 辅助</strong><span>只有点击后才会把当前文案交给集成层。</span></div>
                <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAiAction("correct")}>{busyAction === "correct" ? "纠错中…" : "AI 纠错"}</button>
                <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAiAction("analyze")}>{busyAction === "analyze" ? "拆解中…" : "结构拆解"}</button>
              </div>

              {selectedWork.analysis ? (
                <label className="benchmark-analysis">
                  <span>结构拆解结果</span>
                  <textarea value={selectedWork.analysis} onChange={(event) => updateWork(selectedWork.id, { analysis: event.target.value })} />
                </label>
              ) : null}
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
