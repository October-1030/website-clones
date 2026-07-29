/* global chrome */

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const TOKEN_PATTERN = /^spx_[A-Za-z0-9_-]{43}$/;
const CAPTURE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_KEYS = { token: "studypalPairingToken", baseUrl: "studypalBaseUrl" };

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_BASE_URL));
  } catch {
    throw new Error("StudyPal server URL is invalid.");
  }
  const allowed = url.protocol === "http:"
    && url.port === "3000"
    && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (!allowed || url.username || url.password) {
    throw new Error("This local extension accepts only http://127.0.0.1:3000 or http://localhost:3000.");
  }
  return url.origin;
}

async function readSettings() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.token, STORAGE_KEYS.baseUrl]);
  return {
    token: typeof values[STORAGE_KEYS.token] === "string" ? values[STORAGE_KEYS.token] : "",
    baseUrl: normalizeBaseUrl(values[STORAGE_KEYS.baseUrl] || DEFAULT_BASE_URL),
  };
}

function extractStudyPalPage() {
  const normalizeText = (value) => String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const selection = normalizeText(window.getSelection()?.toString());
  let textContent = selection.length >= 50 ? selection : "";
  const scope = textContent ? "selection" : "page";

  if (!textContent) {
    const root = document.querySelector("main, article, [role='main']") || document.body;
    if (!root) throw new Error("This page has no readable content.");
    const blocked = "script,style,noscript,nav,footer,aside,form,input,textarea,select,button,[hidden],[aria-hidden='true'],[contenteditable='true'],[data-studypal-private]";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest(blocked)) continue;
      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const value = normalizeText(node.textContent);
      if (value) parts.push(value);
    }
    textContent = normalizeText(parts.join("\n"));
  }

  const truncated = textContent.length > 120000;
  textContent = textContent.slice(0, 120000).trim();
  if (textContent.length < 50) throw new Error("Select more text or open a page with at least 50 readable characters.");
  const description = document.querySelector("meta[name='description']")?.getAttribute("content") || "";
  return {
    sourceUrl: (() => {
      const source = new URL(window.location.href);
      return `${source.origin}${source.pathname}`;
    })(),
    title: normalizeText(document.title || window.location.hostname).slice(0, 500),
    textContent,
    capturedAt: new Date().toISOString(),
    metadata: {
      scope,
      truncated,
      language: String(document.documentElement.lang || "").slice(0, 35),
      description: normalizeText(description).slice(0, 500),
    },
  };
}

async function deterministicCaptureId(capture) {
  const payload = `${capture.sourceUrl}\n${capture.title}\n${capture.textContent}`;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error("Open a regular HTTP or HTTPS study page, then try again.");
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractStudyPalPage,
  });
  const capture = results?.[0]?.result;
  if (!capture || typeof capture.textContent !== "string") throw new Error("The current page could not be captured.");
  capture.clientCaptureId = await deterministicCaptureId(capture);
  return capture;
}

async function syncActiveTab() {
  const settings = await readSettings();
  if (!TOKEN_PATTERN.test(settings.token)) throw new Error("Paste a valid StudyPal pairing token first.");
  const capture = await captureActiveTab();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${settings.baseUrl}/api/extension/import`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(capture),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "StudyPal rejected this capture.");
    return {
      captureId: payload.captureId,
      deduplicated: payload.deduplicated === true,
      studyUrl: `${settings.baseUrl}${payload.studyUrl}`,
      title: capture.title,
      scope: capture.metadata.scope,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("StudyPal did not respond within 30 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleMessage(message) {
  if (!message || typeof message.type !== "string") throw new Error("Extension request is invalid.");
  if (message.type === "GET_STATE") {
    const settings = await readSettings();
    return { baseUrl: settings.baseUrl, configured: TOKEN_PATTERN.test(settings.token) };
  }
  if (message.type === "CONFIGURE") {
    const token = String(message.token || "").trim();
    if (!TOKEN_PATTERN.test(token)) throw new Error("Pairing token format is invalid.");
    const baseUrl = normalizeBaseUrl(message.baseUrl);
    await chrome.storage.local.set({ [STORAGE_KEYS.token]: token, [STORAGE_KEYS.baseUrl]: baseUrl });
    return { baseUrl, configured: true };
  }
  if (message.type === "CLEAR_TOKEN") {
    await chrome.storage.local.remove(STORAGE_KEYS.token);
    return { configured: false };
  }
  if (message.type === "SYNC_ACTIVE_TAB") return await syncActiveTab();
  if (message.type === "OPEN_STUDYPAL") {
    if (!CAPTURE_ID_PATTERN.test(String(message.captureId || ""))) throw new Error("Capture ID is invalid.");
    const settings = await readSettings();
    await chrome.tabs.create({ url: `${settings.baseUrl}/pro/session?extensionCapture=${encodeURIComponent(message.captureId)}` });
    return { opened: true };
  }
  throw new Error("Extension request is not supported.");
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((value) => sendResponse({ ok: true, ...value }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Extension operation failed." }));
  return true;
});
