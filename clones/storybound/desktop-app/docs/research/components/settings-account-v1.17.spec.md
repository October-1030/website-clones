# Settings + account v1.17 contract

Source of truth: `index-B_XgV9A-.js` -> `Settings-Dx2uvx67.js`, `Account-DV30AFUz.js`, plus the activation page embedded in the entry chunk.

## Settings

- Preserve the original top-level sections: AI writing, AI image, TTS, speech recognition, Jianying/data paths/BGM, activation/subscription, diagnostics/about.
- AI image must expose JiMeng, RunningHub international, ModelScope and custom image providers with provider-specific credentials, model, resolution, concurrency, proxy and test states. Never display a success state unless the local API actually confirms it.
- TTS must keep Fire/Volcengine and MiniMax engines, model/version, default voice, speed, normalization/noise controls, test, clone upload, platform voice sync and cloned-voice management.
- LLM must support saved configurations, provider/protocol/base URL/model/API key/proxy, selecting the current configuration and a real connection test.
- Data/Jianying must show task storage path, Jianying draft directory, BGM library, path validation, migration/rescan affordances and diagnostics. Browser-only operations must be clearly marked unavailable instead of simulated.
- SenseVoice/ASR must show local/cloud choices, model directory/readiness and unavailable/error states.

## Account + activation

- Reproduce the original information hierarchy for bound/unbound/loading/error states: email verification, credits, creation-count packs, device list, licenses, invitation/commission and activation FAQ.
- This independent clone must not call, emulate or claim success against Storybound's private licensing/payment services. Keep those controls visible with an explicit original-service dependency state; local API/account status belongs in a separate, clearly labeled block.
- Never expose API keys in the browser or exports.

## Verification

- Every top-level section and provider branch is keyboard reachable.
- Empty, loading, unavailable, error and configured states are visually distinct.
- Existing real MiniMax and LLM status/test paths continue to work.
