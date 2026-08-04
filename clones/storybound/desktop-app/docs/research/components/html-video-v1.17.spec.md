# HTML animation video v1.17 contract

Source of truth: `HtmlVideoPage-1jcx2WCs.js`.

- Expose the original creation branches: AI topic creation and pasted-copy creation.
- Flow stages: title/topic -> rewrite/sentence planning -> scene planning -> foreground/background assets -> image upload/generation -> animation preview -> BGM/title/subtitle settings -> render/export/history.
- Preserve layout/animation/subtitle presets, 9:16-first preview, per-scene edit/regenerate/upload and observable processing/error states.
- Use the clone's real local media workbench APIs for persistence and render. Unsupported original private services must fail explicitly, never produce placeholder success.
- Completed render must provide a playable file and downloadable manifest; refreshing the page restores job history.
