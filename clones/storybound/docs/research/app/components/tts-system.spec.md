# TTS System Specification

## Overview
- Target files: `desktop-app/src/components/TtsSettingsPage.tsx`, `VoiceLabPage.tsx`, `desktop-app/server.mjs`.
- Screenshots: `docs/design-references/app/tts-settings-minimax.png`, `voice-lab-volcengine.png`, `voice-lab-minimax.png`.
- Interaction model: click-driven forms plus asynchronous network synthesis.

## Official providers

### Volcengine / 豆包
- Credentials: App ID + Access Token.
- Endpoint: `POST https://openspeech.bytedance.com/api/v3/tts/unidirectional`.
- Headers: `X-Api-App-Id`, `X-Api-Access-Key`, `X-Api-Resource-Id`, `Content-Type: application/json`.
- Resource ID: `seed-tts-2.0` for `_uranus_bigtts` and `saturn_` voices; otherwise `seed-tts-1.0`.
- Request: `{ user: { uid }, req_params: { text, speaker, audio_params: { format: "mp3", sample_rate: 24000, speech_rate } } }`.
- Speed conversion: UI multiplier 0.5–2.0; API `speech_rate = clamp(round((speed - 1) * 100), -50, 50)`.
- Response: newline-delimited JSON; successful chunks contain base64 MP3 in `data`; code `20000000` is an intermediate event.
- Long text: split at 500 characters, concurrency 3, concatenate MP3 chunks in original order.
- Default 2.0 voices: 东方浩然, 悬疑解说, 温柔小雅, 温柔妈妈.

### MiniMax
- Credential: API Key.
- Base URL: `https://api.minimaxi.com`.
- Synthesis: `POST /v1/t2a_v2`, bearer authentication.
- Models: `speech-2.8-hd` and `speech-2.8-turbo`.
- Request includes `language_boost: auto`, `stream: false`, voice speed, volume 1, pitch 0, MP3 32 kHz / 128 kbps / mono, and `output_format: hex`.
- Response: MP3 bytes encoded as hex in `data.audio`.
- Long text: split at 2000 characters, concurrency 3, concatenate in order.
- Default voices: 沉稳高管, 嘴硬竹马, 阅历姐姐, 温柔学姐.
- Existing cloned/system voices: `POST /v1/get_voice` with `voice_type: voice_cloning` or `system`.
- Clone flow: upload source audio to `/v1/files/upload` with purpose `voice_clone`, then call `/v1/voice_clone` using a generated `clone_*` voice ID.

## Voice lab UI
- Heading: 配音实验室.
- Subtitle: 输入文本 → 选音色和语速 → 一键生成 mp3。试音色、补配音都在这里，不走流水线、不写任务历史。
- Text limit: 10,000 Chinese characters.
- Provider tabs: 豆包 / MiniMax.
- Volcengine version tabs: 2.0 / 1.0.
- Speed presets: 0.85×, 1.0×, 1.15×, 1.3×.
- Generate button disabled without text, voice, or required credentials.
- Result cards: file name, voice, speed, timestamp, HTML audio player, download button.
- Credentials come from the settings page; the local clone keeps them in memory only and never sends them to Storybound's servers.

## Settings UI
- TTS settings replaces the placeholder settings module.
- Provider cards: 火山引擎 / MiniMax.
- Volcengine: App ID, Access Token, engine generation, default voice, connection test.
- MiniMax: API Key, hd/turbo model, default system voice, sync platform voices, upload clone, connection test.
- Sensitive values use password fields and are never written to localStorage.
- The local service checks `MINIMAX_SECRETS_FILE`, then `C:\tmp\minimax-secrets.txt`, then the legacy D-drive file.
- Local credentials remain server-side. `/api/tts/status` exposes availability and source filename only, never the key.
- A manually entered page credential temporarily overrides the local file for the current session.

## Task pipeline integration
- The image-story task form uses the same provider, model and voice configuration as Voice Lab.
- Step 6 (`TTS 配音`, internal index 5) calls the real provider instead of the 700ms simulation.
- Missing credentials or provider errors mark that step failed and pause the pipeline with settings/retry actions.
- Success creates an in-memory MP3 artifact with player, segment/size metadata and download action, then advances to draft packaging.
- Cancelling or rerunning aborts the active network request and revokes stale object URLs.

## Error handling
- Never log credentials or full request headers.
- Return provider HTTP/status errors as short Chinese messages.
- Enforce text and upload size limits locally.
- Abort on missing credentials before making a network request.
- Never return locally loaded secrets from status or synthesis endpoints.
