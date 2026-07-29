import { readResponseJson } from "../http/response-limit";

export interface PublicSearchResult {
  id: number;
  key: string;
  title: string;
  description: string;
  excerpt: string;
  url: string;
  source: "Wikipedia";
  language: "en" | "zh";
}

interface WikimediaSearchPage {
  id?: number;
  key?: string;
  title?: string;
  description?: string | null;
  excerpt?: string;
}

interface WikimediaSearchResponse {
  pages?: WikimediaSearchPage[];
}

export function detectSearchLanguage(query: string): "en" | "zh" {
  return /[\u3400-\u9fff]/u.test(query) ? "zh" : "en";
}

export function cleanSearchExcerpt(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

export async function searchPublicKnowledge(
  rawQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ query: string; language: "en" | "zh"; results: PublicSearchResult[] }> {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 200) {
    throw new Error("Search query must contain 2 to 200 characters.");
  }

  const language = detectSearchLanguage(query);
  const host = `${language}.wikipedia.org`;
  const endpoint = new URL(`https://${host}/w/rest.php/v1/search/page`);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "8");

  const response = await fetchImpl(endpoint, {
    headers: {
      Accept: "application/json",
      "Api-User-Agent": "StudyPalAI/0.6 local educational search",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Public search failed with status ${response.status}.`);

  const payload = await readResponseJson<WikimediaSearchResponse>(response, 1024 * 1024);
  const results = (Array.isArray(payload.pages) ? payload.pages : []).flatMap((page, index) => {
    const key = typeof page.key === "string" ? page.key.trim() : "";
    const title = typeof page.title === "string" ? page.title.trim() : "";
    if (!key || !title) return [];
    return [{
      id: Number.isSafeInteger(page.id) ? page.id as number : index,
      key,
      title: title.slice(0, 300),
      description: typeof page.description === "string" ? cleanSearchExcerpt(page.description) : "",
      excerpt: typeof page.excerpt === "string" ? cleanSearchExcerpt(page.excerpt) : "",
      url: `https://${host}/wiki/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
      source: "Wikipedia" as const,
      language,
    }];
  });

  return { query, language, results };
}
