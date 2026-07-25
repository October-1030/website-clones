/* global chrome */

const form = document.querySelector("#pair-form");
const baseUrl = document.querySelector("#base-url");
const token = document.querySelector("#token");
const connection = document.querySelector("#connection");
const syncButton = document.querySelector("#sync");
const result = document.querySelector("#result");
const openButton = document.querySelector("#open");
const clearButton = document.querySelector("#clear");
let latestCaptureId = "";

async function send(type, values = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...values });
  if (!response?.ok) throw new Error(response?.error || "StudyPal extension operation failed.");
  return response;
}

function showResult(message, error = false) {
  result.hidden = false;
  result.textContent = message;
  result.classList.toggle("error", error);
}

function setConfigured(configured) {
  syncButton.disabled = !configured;
  clearButton.hidden = !configured;
  connection.textContent = configured ? "Token saved in chrome.storage.local on this browser." : "Create a pairing token in StudyPal, then paste it here.";
  connection.classList.toggle("connected", configured);
}

async function initialize() {
  try {
    const state = await send("GET_STATE");
    baseUrl.value = state.baseUrl;
    setConfigured(state.configured);
  } catch (error) {
    showResult(error instanceof Error ? error.message : "Unable to initialize the extension.", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const state = await send("CONFIGURE", { baseUrl: baseUrl.value, token: token.value });
    token.value = "";
    setConfigured(state.configured);
    showResult("Pairing token saved locally. Press Sync this page to verify it.");
  } catch (error) {
    showResult(error instanceof Error ? error.message : "Unable to save the pairing token.", true);
  }
});

syncButton.addEventListener("click", async () => {
  syncButton.disabled = true;
  openButton.hidden = true;
  showResult("Reading the selected text or visible page…");
  try {
    const synced = await send("SYNC_ACTIVE_TAB");
    latestCaptureId = synced.captureId;
    openButton.hidden = false;
    showResult(`${synced.deduplicated ? "Already synced" : "Synced"}: ${synced.title} (${synced.scope}). Open StudyPal to generate a grounded summary.`);
  } catch (error) {
    showResult(error instanceof Error ? error.message : "Unable to sync this page.", true);
  } finally {
    syncButton.disabled = false;
  }
});

openButton.addEventListener("click", async () => {
  if (!latestCaptureId) return;
  try {
    await send("OPEN_STUDYPAL", { captureId: latestCaptureId });
  } catch (error) {
    showResult(error instanceof Error ? error.message : "Unable to open StudyPal.", true);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await send("CLEAR_TOKEN");
    latestCaptureId = "";
    openButton.hidden = true;
    result.hidden = true;
    setConfigured(false);
  } catch (error) {
    showResult(error instanceof Error ? error.message : "Unable to forget the pairing token.", true);
  }
});

void initialize();
