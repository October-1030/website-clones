# P5 Live Transcribe

StudyPal AI records a microphone or a user-selected browser tab and creates a timestamped transcript with the local Faster-Whisper runtime.

## Honest capability boundary

- Microphone mode may show temporary browser Web Speech captions while recording.
- Those captions are explicitly temporary and are never saved as the authoritative transcript.
- The final transcript is generated after Stop by Faster-Whisper.
- Browser-tab mode does not claim real-time captions; its final transcript appears after Stop.
- Audio is written only to `.studypal-data/transcribe-temp` during processing and is deleted in a `finally` block after success or failure.
- Saved sessions contain text and timestamps only.

## Runtime defaults

- Model: `small`
- Device: `cpu`
- Compute type: `int8`
- Recording limit: 10 minutes
- Upload limit: 50 MB
- Accepted containers: WAV, WebM, OGG, MP3, MP4/M4A

The runtime is configurable with `STUDYPAL_TRANSCRIBE_*` environment variables. Model downloads are disabled at runtime, so a configured model must already exist in the local Hugging Face cache.

## Flow

1. Open **Live transcribe**.
2. Explicitly select **Microphone** or **Browser Tab**.
3. Grant the browser permission.
4. Stop manually, stop sharing, or wait for the 10-minute automatic stop.
5. The browser uploads one bounded recording to the local API.
6. Faster-Whisper produces the final timestamped transcript.
7. The API deletes temporary audio and persists the text session.
8. Browser `localStorage` and `?transcribeSession=` restore the latest session.

## Safety

- Permission is never requested before the user clicks an audio source.
- File type, size, signature, duration, source kind, and session ID are validated.
- The Python process receives fixed arguments without a shell.
- The runner has a timeout and bounded output.
- No API key is needed for transcription.
- No audio file is retained.
