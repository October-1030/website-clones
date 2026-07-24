"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ExternalLink, Globe2, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type { PublicSearchResult } from "@/lib/web-search/service";

const STORAGE_KEY = "studypal.public-search.v1";

interface StoredSearch {
  query: string;
  language: "en" | "zh";
  results: PublicSearchResult[];
}

function loadStoredSearch(): StoredSearch | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSearch>;
    if (typeof value.query !== "string" || !Array.isArray(value.results)) return null;
    return { query: value.query, language: value.language === "zh" ? "zh" : "en", results: value.results.slice(0, 8) as PublicSearchResult[] };
  } catch {
    return null;
  }
}

export default function WebSearchWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = loadStoredSearch();
      if (stored) {
        setQuery(stored.query);
        setLanguage(stored.language);
        setResults(stored.results);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized }),
      });
      const payload = await response.json() as { error?: string; query?: string; language?: "en" | "zh"; results?: PublicSearchResult[] };
      if (!response.ok || !payload.results || !payload.query || !payload.language) throw new Error(payload.error || "Search is unavailable.");
      const stored = { query: payload.query, language: payload.language, results: payload.results };
      setQuery(payload.query);
      setLanguage(payload.language);
      setResults(payload.results);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      onToast(`${payload.results.length} public source${payload.results.length === 1 ? "" : "s"} found`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="public-search-workspace" aria-labelledby="public-search-title">
    <header><span className="everywhere-kicker">Public knowledge search</span><h2 id="public-search-title"><Globe2 size={20} />Find a reliable starting point</h2><p>Searches English or Chinese Wikipedia only. Results always link to the source; this tool does not invent an AI summary.</p></header>
    <form onSubmit={submit}><label><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} placeholder="Search a concept, person, event, or theory" aria-label="Public knowledge search query" /></label><button type="submit" disabled={loading || query.trim().length < 2}>{loading ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}Search</button></form>
    <div className="public-search-policy"><ShieldCheck size={15} /><span>Allowed hosts: en.wikipedia.org and zh.wikipedia.org. No arbitrary URL fetching, account login, tracking, or paid provider.</span></div>
    {error && <div className="public-search-error" role="alert">{error}</div>}
    {!error && !loading && results.length === 0 && <div className="public-search-empty">Search results will appear here with direct citations.</div>}
    {results.length > 0 && <div className="public-search-results"><div className="public-search-results-heading"><strong>{results.length} results</strong><span>{language === "zh" ? "Chinese Wikipedia" : "English Wikipedia"}</span></div>{results.map((result) => <article key={`${result.id}-${result.key}`}><div><span>{result.source}</span><h3>{result.title}</h3>{result.description && <p>{result.description}</p>}{result.excerpt && <small>{result.excerpt}</small>}</div><a href={result.url} target="_blank" rel="noreferrer noopener">Open source <ExternalLink size={13} /></a></article>)}</div>}
  </section>;
}
