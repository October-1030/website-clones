import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import "./BookSelectionPage.css";

const BOOK_CATEGORIES = [
  "文学",
  "亲子",
  "健康",
  "成功",
  "理财",
  "经济",
  "哲学",
  "心理",
  "古籍",
  "文化",
  "历史",
  "传记",
  "科普",
  "医学",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export interface SelectionBook {
  id: string;
  listId: string;
  title: string;
  author: string;
  category: BookCategory;
  price: string;
  salesRank: number | null;
  rating: number | null;
  sellingPoints: string;
  cover: string;
  sourceUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectionBookList {
  id: string;
  name: string;
  preset: string;
  createdAt: string;
}

export interface CommerceTaskPayload {
  bookId: string;
  listName: string;
  title: string;
  author: string;
  price: string;
  category: BookCategory;
  sellingPoints: string;
  cover: string;
  sourceUrl: string;
  notes: string;
}

export interface BookSelectionPageProps {
  onCreateCommerceTask?: (payload: CommerceTaskPayload) => void;
  onSearchBenchmark?: (query: string, book: SelectionBook) => void;
}

interface SelectionStore {
  version: 1;
  lists: SelectionBookList[];
  books: SelectionBook[];
}

interface BookDraft {
  title: string;
  author: string;
  category: BookCategory;
  price: string;
  salesRank: string;
  rating: string;
  sellingPoints: string;
  cover: string;
  sourceUrl: string;
  notes: string;
}

interface TopicPreset {
  name: string;
  description: string;
  categories: readonly BookCategory[];
}

type ViewMode = "table" | "cards";

const STORAGE_KEY = "storybound-book-selection-workbench-v1";
const MAX_LOCAL_COVER_BYTES = 1_200_000;
const EMPTY_BOOK_DRAFT: BookDraft = {
  title: "",
  author: "",
  category: "文学",
  price: "",
  salesRank: "",
  rating: "",
  sellingPoints: "",
  cover: "",
  sourceUrl: "",
  notes: "",
};
const TOPIC_PRESETS: readonly TopicPreset[] = [
  { name: "健康中医", description: "中医常识、调理方法与大众健康", categories: ["健康", "医学", "古籍"] },
  { name: "抗衰养生", description: "生命周期、营养与科学养生", categories: ["健康", "医学", "科普"] },
  { name: "传统文化国学", description: "经典导读、传统智慧与文化故事", categories: ["文化", "古籍", "哲学"] },
  { name: "民国女性", description: "女性人物、时代命运与文学表达", categories: ["传记", "历史", "文学"] },
  { name: "帝王将相", description: "历史人物、权力选择与王朝兴衰", categories: ["历史", "传记", "古籍"] },
  { name: "商业人物", description: "企业家经历、商业决策与组织成长", categories: ["传记", "经济", "成功"] },
  { name: "认知成长", description: "思维方式、心理机制与个人成长", categories: ["心理", "哲学", "成功"] },
  { name: "育儿亲子", description: "家庭沟通、儿童发展与养育实践", categories: ["亲子", "心理", "科普"] },
  { name: "财商理财", description: "财富观念、个人理财与经济常识", categories: ["理财", "经济", "成功"] },
] as const;
const CSV_FIELDS = [
  "title",
  "author",
  "category",
  "price",
  "salesRank",
  "rating",
  "sellingPoints",
  "cover",
  "sourceUrl",
  "notes",
] as const;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalNumber(value: unknown, maximum?: number): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return maximum === undefined ? number : Math.min(number, maximum);
}

function readCategory(value: unknown): BookCategory {
  return BOOK_CATEGORIES.includes(value as BookCategory) ? value as BookCategory : "文学";
}

function normalizeList(value: unknown): SelectionBookList | null {
  if (!isRecord(value)) return null;
  const name = readString(value.name).trim();
  if (!name) return null;
  return {
    id: readString(value.id) || createId("list"),
    name,
    preset: readString(value.preset),
    createdAt: readString(value.createdAt) || new Date().toISOString(),
  };
}

function normalizeBook(value: unknown, listId: string): SelectionBook | null {
  if (!isRecord(value)) return null;
  const title = readString(value.title).trim();
  if (!title) return null;
  const timestamp = new Date().toISOString();
  return {
    id: readString(value.id) || createId("book"),
    listId,
    title,
    author: readString(value.author).trim(),
    category: readCategory(value.category),
    price: readString(value.price) || (typeof value.price === "number" ? String(value.price) : ""),
    salesRank: readOptionalNumber(value.salesRank),
    rating: readOptionalNumber(value.rating, 10),
    sellingPoints: readString(value.sellingPoints),
    cover: readString(value.cover),
    sourceUrl: readString(value.sourceUrl),
    notes: readString(value.notes),
    createdAt: readString(value.createdAt) || timestamp,
    updatedAt: readString(value.updatedAt) || timestamp,
  };
}

function readStore(): SelectionStore {
  const initialList: SelectionBookList = {
    id: createId("list"),
    name: "我的书单",
    preset: "",
    createdAt: new Date().toISOString(),
  };
  if (typeof window === "undefined") return { version: 1, lists: [initialList], books: [] };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(parsed) || !Array.isArray(parsed.lists)) {
      return { version: 1, lists: [initialList], books: [] };
    }
    const lists = parsed.lists.map(normalizeList).filter((item): item is SelectionBookList => item !== null);
    if (lists.length === 0) return { version: 1, lists: [initialList], books: [] };
    const listIds = new Set(lists.map((list) => list.id));
    const books = Array.isArray(parsed.books)
      ? parsed.books.flatMap((value) => {
          if (!isRecord(value)) return [];
          const listId = readString(value.listId);
          if (!listIds.has(listId)) return [];
          const book = normalizeBook(value, listId);
          return book ? [book] : [];
        })
      : [];
    return { version: 1, lists, books };
  } catch {
    return { version: 1, lists: [initialList], books: [] };
  }
}

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === "\"" && content[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim()));
}

function booksFromCsv(content: string, listId: string): SelectionBook[] {
  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const header = rows[0].map((field) => field.trim());
  return rows.slice(1).flatMap((row) => {
    const record: Record<string, unknown> = {};
    header.forEach((field, index) => {
      record[field] = row[index] ?? "";
    });
    const book = normalizeBook(record, listId);
    return book ? [book] : [];
  });
}

function booksFromJson(content: string, listId: string): SelectionBook[] {
  const parsed: unknown = JSON.parse(content);
  const values = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.books)
      ? parsed.books
      : [];
  return values.flatMap((value) => {
    const book = normalizeBook(value, listId);
    return book ? [book] : [];
  });
}

function downloadText(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "书单";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("封面读取失败"));
    reader.readAsDataURL(file);
  });
}

function rankClass(rank: number | null): string {
  if (rank !== null && rank <= 3) return "is-top-three";
  return "";
}

export function BookSelectionPage({
  onCreateCommerceTask,
  onSearchBenchmark,
}: BookSelectionPageProps) {
  const [store, setStore] = useState<SelectionStore>(readStore);
  const [selectedListId, setSelectedListId] = useState(() => readStore().lists[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
  const [categoryFilter, setCategoryFilter] = useState<"all" | BookCategory>("all");
  const [maxRank, setMaxRank] = useState("");
  const [minRating, setMinRating] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [newListName, setNewListName] = useState("");
  const [showListForm, setShowListForm] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState("");
  const [bookDraft, setBookDraft] = useState<BookDraft>(EMPTY_BOOK_DRAFT);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      setNotice("本地存储空间不足；请缩小封面图片或先导出书单备份。");
    }
  }, [store]);

  useEffect(() => {
    if (store.lists.some((list) => list.id === selectedListId)) return;
    setSelectedListId(store.lists[0]?.id ?? "");
  }, [selectedListId, store.lists]);

  const selectedList = store.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedBooks = useMemo(
    () => store.books.filter((book) => book.listId === selectedListId),
    [selectedListId, store.books],
  );
  const visibleBooks = useMemo(() => {
    const maximumRank = readOptionalNumber(maxRank);
    const minimumRating = readOptionalNumber(minRating, 10);
    return selectedBooks
      .filter((book) => {
        if (
          deferredQuery
          && ![book.title, book.author, book.sellingPoints, book.notes]
            .join(" ")
            .toLocaleLowerCase("zh-CN")
            .includes(deferredQuery)
        ) return false;
        if (categoryFilter !== "all" && book.category !== categoryFilter) return false;
        if (maximumRank !== null && (book.salesRank === null || book.salesRank > maximumRank)) return false;
        if (minimumRating !== null && (book.rating === null || book.rating < minimumRating)) return false;
        return true;
      })
      .toSorted((left, right) => {
        if (left.salesRank === null && right.salesRank !== null) return 1;
        if (left.salesRank !== null && right.salesRank === null) return -1;
        if (left.salesRank !== null && right.salesRank !== null && left.salesRank !== right.salesRank) {
          return left.salesRank - right.salesRank;
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }, [categoryFilter, deferredQuery, maxRank, minRating, selectedBooks]);

  const createList = (name: string, preset = ""): SelectionBookList | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice("请填写书单名称。");
      return null;
    }
    const existing = store.lists.find((list) => list.name === trimmedName);
    if (existing) {
      setSelectedListId(existing.id);
      setNotice(`已切换到现有书单“${trimmedName}”。`);
      return existing;
    }
    const list: SelectionBookList = {
      id: createId("list"),
      name: trimmedName,
      preset,
      createdAt: new Date().toISOString(),
    };
    setStore((current) => ({ ...current, lists: [...current.lists, list] }));
    setSelectedListId(list.id);
    setNotice(`已创建书单“${trimmedName}”，未填入任何虚构商品数据。`);
    return list;
  };

  const submitList = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!createList(newListName)) return;
    setNewListName("");
    setShowListForm(false);
  };

  const createPresetList = (preset: TopicPreset): void => {
    createList(preset.name, preset.name);
  };

  const renameList = (list: SelectionBookList): void => {
    const name = window.prompt("输入新的书单名称", list.name)?.trim();
    if (!name || name === list.name) return;
    setStore((current) => ({
      ...current,
      lists: current.lists.map((item) => item.id === list.id ? { ...item, name } : item),
    }));
    setNotice(`书单已重命名为“${name}”。`);
  };

  const deleteList = (list: SelectionBookList): void => {
    const bookCount = store.books.filter((book) => book.listId === list.id).length;
    if (!window.confirm(`删除书单“${list.name}”及其中 ${bookCount} 本书？`)) return;
    setStore((current) => ({
      ...current,
      lists: current.lists.filter((item) => item.id !== list.id),
      books: current.books.filter((book) => book.listId !== list.id),
    }));
    setNotice("书单及其本地书籍记录已删除。");
  };

  const openNewBookForm = (): void => {
    if (!selectedList) {
      setNotice("请先创建或选择一个书单。");
      return;
    }
    const preset = TOPIC_PRESETS.find((item) => item.name === selectedList.preset);
    setEditingBookId("");
    setBookDraft({
      ...EMPTY_BOOK_DRAFT,
      category: preset?.categories[0] ?? "文学",
    });
    setShowBookForm(true);
  };

  const openEditBookForm = (book: SelectionBook): void => {
    setEditingBookId(book.id);
    setBookDraft({
      title: book.title,
      author: book.author,
      category: book.category,
      price: book.price,
      salesRank: book.salesRank === null ? "" : String(book.salesRank),
      rating: book.rating === null ? "" : String(book.rating),
      sellingPoints: book.sellingPoints,
      cover: book.cover,
      sourceUrl: book.sourceUrl,
      notes: book.notes,
    });
    setShowBookForm(true);
  };

  const saveBook = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedList) {
      setNotice("请先选择书单。");
      return;
    }
    const title = bookDraft.title.trim();
    if (!title) {
      setNotice("请填写书名。");
      return;
    }
    const timestamp = new Date().toISOString();
    if (editingBookId) {
      setStore((current) => ({
        ...current,
        books: current.books.map((book) =>
          book.id === editingBookId
            ? {
                ...book,
                title,
                author: bookDraft.author.trim(),
                category: bookDraft.category,
                price: bookDraft.price.trim(),
                salesRank: readOptionalNumber(bookDraft.salesRank),
                rating: readOptionalNumber(bookDraft.rating, 10),
                sellingPoints: bookDraft.sellingPoints.trim(),
                cover: bookDraft.cover.trim(),
                sourceUrl: bookDraft.sourceUrl.trim(),
                notes: bookDraft.notes.trim(),
                updatedAt: timestamp,
              }
            : book,
        ),
      }));
      setNotice(`已更新《${title}》。`);
    } else {
      const book: SelectionBook = {
        id: createId("book"),
        listId: selectedList.id,
        title,
        author: bookDraft.author.trim(),
        category: bookDraft.category,
        price: bookDraft.price.trim(),
        salesRank: readOptionalNumber(bookDraft.salesRank),
        rating: readOptionalNumber(bookDraft.rating, 10),
        sellingPoints: bookDraft.sellingPoints.trim(),
        cover: bookDraft.cover.trim(),
        sourceUrl: bookDraft.sourceUrl.trim(),
        notes: bookDraft.notes.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setStore((current) => ({ ...current, books: [book, ...current.books] }));
      setNotice(`已将《${title}》加入“${selectedList.name}”。`);
    }
    setBookDraft(EMPTY_BOOK_DRAFT);
    setEditingBookId("");
    setShowBookForm(false);
  };

  const deleteBook = (book: SelectionBook): void => {
    if (!window.confirm(`从本地书单删除《${book.title}》？`)) return;
    setStore((current) => ({ ...current, books: current.books.filter((item) => item.id !== book.id) }));
    setNotice(`已删除《${book.title}》。`);
  };

  const importCover = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOCAL_COVER_BYTES) {
      setNotice("本地封面需小于 1.2 MB，避免占满 localStorage。");
      event.target.value = "";
      return;
    }
    try {
      const cover = await fileToDataUrl(file);
      setBookDraft((draft) => ({ ...draft, cover }));
      setNotice(`已读取本地封面：${file.name}`);
    } catch {
      setNotice("本地封面读取失败。");
    }
    event.target.value = "";
  };

  const importBooks = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !selectedList) return;
    try {
      const content = await file.text();
      const books = file.name.toLowerCase().endsWith(".csv")
        ? booksFromCsv(content, selectedList.id)
        : booksFromJson(content, selectedList.id);
      if (books.length === 0) throw new Error("文件中没有可导入的有效书籍");
      setStore((current) => ({ ...current, books: [...books, ...current.books] }));
      setNotice(`已导入 ${books.length} 本书；数据按文件原值保存，不代表实时销量。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败，请检查文件格式。");
    }
    event.target.value = "";
  };

  const exportJson = (): void => {
    if (!selectedList) {
      setNotice("当前没有可导出的书单。");
      return;
    }
    downloadText(
      `${safeFileName(selectedList.name)}.json`,
      JSON.stringify({ version: 1, list: selectedList, books: selectedBooks }, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const exportCsv = (): void => {
    if (!selectedList) {
      setNotice("当前没有可导出的书单。");
      return;
    }
    const rows = [
      CSV_FIELDS.join(","),
      ...selectedBooks.map((book) => CSV_FIELDS.map((field) => escapeCsv(book[field])).join(",")),
    ];
    downloadText(
      `${safeFileName(selectedList.name)}.csv`,
      `\uFEFF${rows.join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  };

  const createCommerceTask = (book: SelectionBook): void => {
    if (!onCreateCommerceTask) {
      setNotice("尚未接入带货任务创建回调；书籍资料仍保存在本地。");
      return;
    }
    onCreateCommerceTask({
      bookId: book.id,
      listName: selectedList?.name ?? "",
      title: book.title,
      author: book.author,
      price: book.price,
      category: book.category,
      sellingPoints: book.sellingPoints,
      cover: book.cover,
      sourceUrl: book.sourceUrl,
      notes: book.notes,
    });
    setNotice(`已把《${book.title}》的商品信息交给带货任务流程。`);
  };

  const searchBenchmark = (book: SelectionBook): void => {
    if (!onSearchBenchmark) {
      setNotice(`尚未接入页面跳转回调；可在对标监控中搜索“${book.title}”。`);
      return;
    }
    onSearchBenchmark(book.title, book);
  };

  return (
    <main className="book-selection-page">
      <header className="book-selection-header">
        <div>
          <span>LOCAL PRODUCT LIBRARY</span>
          <h1>选品助手</h1>
          <p>建立自己的选题与图书商品资料库。排名、评分和价格均为手工或导入数据，不代表实时销售。</p>
        </div>
        <div className="book-selection-stats">
          <span><strong>{store.lists.length}</strong> 书单</span>
          <span><strong>{store.books.length}</strong> 本书</span>
        </div>
      </header>

      {notice ? (
        <div className="book-selection-notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice("")}>×</button>
        </div>
      ) : null}

      <section className="book-topic-presets" aria-labelledby="book-topic-title">
        <div className="book-section-heading">
          <div><strong id="book-topic-title">九个主题预设</strong><span>点击只会创建空的专题书单，不会生成虚构书籍或销量。</span></div>
        </div>
        <div className="book-topic-grid">
          {TOPIC_PRESETS.map((preset) => (
            <button
              className={selectedList?.preset === preset.name ? "is-selected" : ""}
              type="button"
              key={preset.name}
              onClick={() => createPresetList(preset)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
              <small>{preset.categories.join(" · ")}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="book-workbench">
        <aside className="book-list-rail">
          <div className="book-list-rail__header">
            <div><strong>我的书单</strong><span>{store.lists.length} 个</span></div>
            <button type="button" onClick={() => setShowListForm((value) => !value)} aria-label="新建书单">＋</button>
          </div>
          {showListForm ? (
            <form className="book-list-form" onSubmit={submitList}>
              <input autoFocus value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="书单名称" />
              <button type="submit">创建</button>
            </form>
          ) : null}
          <nav className="book-list-nav" aria-label="本地书单">
            {store.lists.map((list) => {
              const bookCount = store.books.filter((book) => book.listId === list.id).length;
              return (
                <article className={selectedListId === list.id ? "is-selected" : ""} key={list.id}>
                  <button className="book-list-main" type="button" onClick={() => setSelectedListId(list.id)}>
                    <span aria-hidden="true">▤</span>
                    <span><strong>{list.name}</strong><small>{list.preset || "自定义书单"} · {bookCount} 本</small></span>
                  </button>
                  <div>
                    <button type="button" onClick={() => renameList(list)}>重命名</button>
                    <button className="is-danger" type="button" onClick={() => deleteList(list)}>删除</button>
                  </div>
                </article>
              );
            })}
          </nav>
          {store.lists.length === 0 ? (
            <div className="book-list-empty"><span>还没有书单</span><button type="button" onClick={() => setShowListForm(true)}>立即创建</button></div>
          ) : null}
        </aside>

        <section className="book-library">
          <div className="book-toolbar">
            <label className="book-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜书名、作者、卖点或备注" />
            </label>
            <label><span>类别</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | BookCategory)}><option value="all">全部类别</option>{BOOK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label><span>排名 ≤</span><input min="1" type="number" value={maxRank} onChange={(event) => setMaxRank(event.target.value)} placeholder="不限" /></label>
            <label><span>评分 ≥</span><input min="0" max="10" step=".1" type="number" value={minRating} onChange={(event) => setMinRating(event.target.value)} placeholder="不限" /></label>
          </div>

          <div className="book-actionbar">
            <div>
              <strong>{selectedList?.name ?? "未选择书单"}</strong>
              <span>{visibleBooks.length} / {selectedBooks.length} 本</span>
            </div>
            <div className="book-view-switch" role="group" aria-label="视图模式">
              <button className={viewMode === "table" ? "is-selected" : ""} type="button" onClick={() => setViewMode("table")}>密集表</button>
              <button className={viewMode === "cards" ? "is-selected" : ""} type="button" onClick={() => setViewMode("cards")}>卡片</button>
            </div>
            <label className="book-file-button">导入 JSON/CSV<input type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => void importBooks(event)} /></label>
            <button type="button" onClick={exportJson}>导出 JSON</button>
            <button type="button" onClick={exportCsv}>导出 CSV</button>
            <button className="book-primary" type="button" onClick={openNewBookForm} disabled={!selectedList}>＋ 新增书籍</button>
          </div>

          {showBookForm ? (
            <form className="book-editor" onSubmit={saveBook}>
              <div className="book-editor__header">
                <div><strong>{editingBookId ? "编辑书籍" : "新增书籍"}</strong><span>带 * 的字段建议完成后再用于带货任务。</span></div>
                <button type="button" onClick={() => setShowBookForm(false)} aria-label="关闭书籍表单">×</button>
              </div>
              <div className="book-editor-grid">
                <label className="book-editor-span-two">书名 *<input required value={bookDraft.title} onChange={(event) => setBookDraft((draft) => ({ ...draft, title: event.target.value }))} /></label>
                <label>作者<input value={bookDraft.author} onChange={(event) => setBookDraft((draft) => ({ ...draft, author: event.target.value }))} /></label>
                <label>类别<select value={bookDraft.category} onChange={(event) => setBookDraft((draft) => ({ ...draft, category: event.target.value as BookCategory }))}>{BOOK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label>价格<input min="0" step=".01" type="number" value={bookDraft.price} onChange={(event) => setBookDraft((draft) => ({ ...draft, price: event.target.value }))} placeholder="手工填写" /></label>
                <label>销售排名<input min="1" type="number" value={bookDraft.salesRank} onChange={(event) => setBookDraft((draft) => ({ ...draft, salesRank: event.target.value }))} placeholder="非实时" /></label>
                <label>评分<input min="0" max="10" step=".1" type="number" value={bookDraft.rating} onChange={(event) => setBookDraft((draft) => ({ ...draft, rating: event.target.value }))} /></label>
                <label className="book-editor-span-two">封面 URL<input value={bookDraft.cover} onChange={(event) => setBookDraft((draft) => ({ ...draft, cover: event.target.value }))} placeholder="https://... 或选择本地小图" /></label>
                <label className="book-local-cover">本地封面<input type="file" accept="image/*" onChange={(event) => void importCover(event)} /></label>
                <label className="book-editor-span-four">来源 URL<input type="url" value={bookDraft.sourceUrl} onChange={(event) => setBookDraft((draft) => ({ ...draft, sourceUrl: event.target.value }))} placeholder="商品页或资料来源" /></label>
                <label className="book-editor-span-four">核心卖点 *<textarea value={bookDraft.sellingPoints} onChange={(event) => setBookDraft((draft) => ({ ...draft, sellingPoints: event.target.value }))} placeholder="每行一个卖点，或粘贴一段商品信息…" /></label>
                <label className="book-editor-span-four">备注<textarea value={bookDraft.notes} onChange={(event) => setBookDraft((draft) => ({ ...draft, notes: event.target.value }))} /></label>
              </div>
              {bookDraft.cover ? <div className="book-cover-preview"><img src={bookDraft.cover} alt="待保存书籍封面预览" /><button type="button" onClick={() => setBookDraft((draft) => ({ ...draft, cover: "" }))}>移除封面</button></div> : null}
              <div className="book-editor__actions">
                <button type="button" onClick={() => setShowBookForm(false)}>取消</button>
                <button className="book-primary" type="submit">保存书籍</button>
              </div>
            </form>
          ) : null}

          {visibleBooks.length === 0 ? (
            <div className="book-empty">
              <span aria-hidden="true">◇</span>
              <strong>{selectedBooks.length === 0 ? "这个书单还是空的" : "没有符合筛选条件的书"}</strong>
              <p>{selectedBooks.length === 0 ? "手工添加书籍，或导入 JSON/CSV。主题预设不会替你虚构榜单数据。" : "调整搜索、类别、排名或评分条件后再试。"}</p>
              {selectedBooks.length === 0 && selectedList ? <button className="book-primary" type="button" onClick={openNewBookForm}>新增第一本书</button> : null}
            </div>
          ) : (
            <>
              <div className={`book-table-wrap ${viewMode === "table" ? "is-visible" : ""}`}>
                <table className="book-table">
                  <thead><tr><th>书籍</th><th>类别</th><th>价格</th><th>排名</th><th>评分</th><th>核心卖点</th><th>操作</th></tr></thead>
                  <tbody>
                    {visibleBooks.map((book) => {
                      const incomplete = !book.author || !book.sellingPoints || !book.price;
                      return (
                        <tr key={book.id}>
                          <td><div className="book-title-cell">{book.cover ? <img src={book.cover} alt="" /> : <span>书</span>}<div><strong>{book.title}</strong><small>{book.author || "作者未填"}{incomplete ? <em>资料待补</em> : null}</small></div></div></td>
                          <td><span className="book-category">{book.category}</span></td>
                          <td>{book.price ? `¥${book.price}` : <span className="book-warning">未填</span>}</td>
                          <td className={rankClass(book.salesRank)}>{book.salesRank === null ? "—" : `#${book.salesRank}`}</td>
                          <td>{book.rating === null ? "—" : book.rating.toFixed(1)}</td>
                          <td><p className="book-selling-points">{book.sellingPoints || "暂无卖点"}</p></td>
                          <td><div className="book-row-actions"><button type="button" onClick={() => openEditBookForm(book)}>编辑</button><button type="button" onClick={() => createCommerceTask(book)}>带货任务</button><button type="button" onClick={() => searchBenchmark(book)}>查对标</button><button className="is-danger" type="button" onClick={() => deleteBook(book)}>删除</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={`book-card-grid ${viewMode === "cards" ? "is-visible" : ""}`}>
                {visibleBooks.map((book) => {
                  const incomplete = !book.author || !book.sellingPoints || !book.price;
                  return (
                    <article key={book.id}>
                      <div className="book-card-cover">{book.cover ? <img src={book.cover} alt={`${book.title}封面`} /> : <span>暂无封面</span>}{book.salesRank !== null ? <em className={rankClass(book.salesRank)}>#{book.salesRank}</em> : null}</div>
                      <div className="book-card-body">
                        <div className="book-card-heading"><span>{book.category}</span>{incomplete ? <em>资料待补</em> : null}</div>
                        <h2>{book.title}</h2>
                        <p className="book-card-author">{book.author || "作者未填写"}</p>
                        <dl><div><dt>价格</dt><dd>{book.price ? `¥${book.price}` : "—"}</dd></div><div><dt>评分</dt><dd>{book.rating === null ? "—" : book.rating.toFixed(1)}</dd></div></dl>
                        <p className="book-card-points">{book.sellingPoints || "暂无核心卖点"}</p>
                        {book.sourceUrl ? <a href={book.sourceUrl} target="_blank" rel="noreferrer">打开资料来源 ↗</a> : null}
                      </div>
                      <footer><button type="button" onClick={() => openEditBookForm(book)}>编辑</button><button type="button" onClick={() => searchBenchmark(book)}>去对标监控搜索</button><button className="book-primary" type="button" onClick={() => createCommerceTask(book)}>用此书商品信息创建带货任务</button><button className="is-danger" type="button" onClick={() => deleteBook(book)}>删除</button></footer>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
