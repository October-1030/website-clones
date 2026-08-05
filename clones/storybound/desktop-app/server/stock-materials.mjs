const commonsApi = "https://commons.wikimedia.org/w/api.php";

function plainText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataValue(metadata, key) {
  return plainText(metadata?.[key]?.value);
}

function isReusableLicense(license) {
  const normalized = String(license || "").toLowerCase();
  if (!normalized) return false;
  if (/noncommercial|no derivatives|fair use|copyrighted|all rights reserved|\bnc\b|\bnd\b/.test(normalized)) return false;
  return /public domain|\bpd\b|cc0|cc[- ]?by|creative commons attribution/.test(normalized);
}

function safeCommonsUrl(value) {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "upload.wikimedia.org" || host.endsWith(".wikimedia.org"))) {
    throw new Error("素材地址不是 Wikimedia Commons 官方 HTTPS 资源");
  }
  return url.toString();
}

function extensionForMime(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

export function normalizeCommonsCandidate(page) {
  const imageInfo = page?.imageinfo?.[0];
  const metadata = imageInfo?.extmetadata || {};
  const mime = String(imageInfo?.mime || "").toLowerCase();
  if (!page?.pageid || !["image/jpeg", "image/png", "image/webp"].includes(mime)) return null;
  const license = metadataValue(metadata, "LicenseShortName") || metadataValue(metadata, "UsageTerms");
  if (!isReusableLicense(license)) return null;
  const assetUrl = imageInfo?.thumburl || imageInfo?.url;
  if (!assetUrl) return null;
  return {
    id: `commons-${page.pageid}`,
    title: plainText(page.title).replace(/^File:/i, ""),
    description: metadataValue(metadata, "ImageDescription") || metadataValue(metadata, "ObjectName"),
    creator: metadataValue(metadata, "Artist") || metadataValue(metadata, "Credit") || "Wikimedia Commons contributor",
    credit: metadataValue(metadata, "Credit"),
    license,
    licenseUrl: metadataValue(metadata, "LicenseUrl"),
    sourceUrl: String(page.canonicalurl || page.fullurl || ""),
    assetUrl: safeCommonsUrl(assetUrl),
    mime,
    width: Number(imageInfo?.thumbwidth || imageInfo?.width || 0),
    height: Number(imageInfo?.thumbheight || imageInfo?.height || 0),
  };
}

export async function searchCommonsMedia(query, options = {}) {
  const text = String(query || "").trim();
  if (!text) return [];
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 8));
  const url = new URL(commonsApi);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "search",
    gsrsearch: `${text} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrwhat: "text",
    gsrsort: "relevance",
    prop: "imageinfo|info",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1600",
    inprop: "url",
  }).toString();
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, {
    signal: options.signal,
    headers: { "User-Agent": "Storybound-Local/1.17.0 (Wikimedia Commons material search)" },
  });
  if (!response.ok) throw new Error(`Wikimedia Commons 检索失败（HTTP ${response.status}）`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`Wikimedia Commons 检索失败：${payload.error.info || payload.error.code}`);
  return (payload?.query?.pages || []).map(normalizeCommonsCandidate).filter(Boolean);
}

export async function saveStockSelections(taskStore, taskId, selections, signal) {
  const images = [];
  const licenses = [];
  for (const selection of selections) {
    const candidate = selection.candidate;
    if (!candidate) {
      images.push({
        id: `stock-missing-${selection.shotId}`,
        shotId: selection.shotId,
        prompt: selection.query,
        url: "",
        status: "failed",
        error: selection.error || "没有找到可确认授权且与分镜匹配的网络素材",
      });
      continue;
    }
    const extension = extensionForMime(candidate.mime);
    const saved = await taskStore.saveRemoteAsset(
      taskId,
      "images",
      `stock-${selection.shotId}${extension}`,
      safeCommonsUrl(candidate.assetUrl),
      signal,
    );
    const attribution = [candidate.creator, candidate.license].filter(Boolean).join(" · ");
    images.push({
      id: candidate.id,
      shotId: selection.shotId,
      prompt: selection.query,
      ...saved,
      status: "ready",
      source: "wikimedia-commons",
      sourceTitle: candidate.title,
      sourceUrl: candidate.sourceUrl,
      creator: candidate.creator,
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      attribution,
      matchReason: selection.reason || "",
      matchConfidence: Number(selection.confidence || 0),
    });
    licenses.push({
      shotId: selection.shotId,
      fileName: saved.fileName,
      title: candidate.title,
      creator: candidate.creator,
      sourceUrl: candidate.sourceUrl,
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      attribution,
      query: selection.query,
      matchReason: selection.reason || "",
      matchConfidence: Number(selection.confidence || 0),
    });
  }
  const manifest = {
    schemaVersion: 1,
    provider: "Wikimedia Commons",
    generatedAt: new Date().toISOString(),
    notice: "每项素材保留原始来源与许可信息；发布前仍应由制作者复核人物身份、画面语义和署名要求。",
    assets: licenses,
  };
  const savedManifest = await taskStore.saveBuffer(
    taskId,
    "uploads",
    "stock-license-manifest.json",
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  );
  return { images, manifest: { ...manifest, path: savedManifest.path, url: savedManifest.url } };
}

export const stockMaterialInternals = {
  isReusableLicense,
  safeCommonsUrl,
};
