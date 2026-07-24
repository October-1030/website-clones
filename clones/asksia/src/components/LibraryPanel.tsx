"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  LoaderCircle,
  Mic,
  RefreshCw,
  Search,
  Sigma,
  Video,
} from "lucide-react";
import type { LibraryItem, LibraryItemKind } from "@/lib/library/types";

const filters: Array<{ value: "all" | LibraryItemKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "study", label: "Materials" },
  { value: "homework", label: "Homework" },
  { value: "video", label: "Videos" },
  { value: "transcribe", label: "Transcripts" },
];

const icons = {
  study: FileText,
  homework: Sigma,
  video: Video,
  transcribe: Mic,
};

function dateLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Saved locally";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

export default function LibraryPanel() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | LibraryItemKind>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    void fetch("/api/library")
      .then(async (response) => {
        const payload = await response.json() as { items?: LibraryItem[]; error?: string };
        if (!response.ok || !payload.items) throw new Error(payload.error || "Unable to read the local library.");
        setItems(payload.items);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to read the local library."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timeout = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => (kind === "all" || item.kind === kind)
      && (!normalized || `${item.title} ${item.subtitle} ${item.providerLabel}`.toLowerCase().includes(normalized)));
  }, [items, kind, query]);

  return <div className="library-panel real-library-panel" role="tabpanel">
    <div className="library-panel-heading">
      <div><span className="everywhere-kicker">Your local library</span><h2>Everything you have studied</h2><p>Only saved session metadata is indexed here. Source text stays inside its original local session.</p></div>
      <button type="button" className="library-refresh" onClick={refresh} disabled={loading}>{loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}Refresh</button>
    </div>
    <div className="library-search-row">
      <label><Search size={15} /><input type="search" aria-label="Search saved sessions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, subjects, or providers" /></label>
      <div role="group" aria-label="Library type filter">{filters.map((filter) => <button type="button" className={kind === filter.value ? "library-filter-active" : ""} key={filter.value} onClick={() => setKind(filter.value)}>{filter.label}</button>)}</div>
    </div>
    {error && <div className="library-error"><BookOpenCheck size={16} /><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}
    {!loading && !error && visible.length === 0 && <div className="library-empty"><GraduationCap size={24} /><strong>{items.length === 0 ? "Your library is ready for its first session" : "No sessions match this search"}</strong><span>{items.length === 0 ? "Summarize a file, solve homework, transcribe audio, or summarize a video. Saved results appear here automatically." : "Change the search or type filter."}</span></div>}
    {visible.length > 0 && <div className="library-session-list">{visible.map((item) => {
      const Icon = icons[item.kind];
      return <a href={item.href} key={`${item.kind}-${item.id}`}><span className={`library-kind-icon library-kind-${item.kind}`}><Icon size={17} /></span><div><strong>{item.title}</strong><span>{item.subtitle}</span><small>{item.providerLabel}</small></div><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time></a>;
    })}</div>}
    <div className="library-count">{visible.length} of {items.length} saved session{items.length === 1 ? "" : "s"}</div>
  </div>;
}
