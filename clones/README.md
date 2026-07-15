# Website Clones

Each cloned website lives in its own self-contained folder:

```text
clones/
  <site-slug>/
    src/
    public/
    docs/
    scripts/
```

The root of this repository remains the reusable AI Website Cloner template. Do not put site-specific pages, assets, screenshots, or research files in the root.

To run a clone, enter its folder and use the normal Next.js commands:

```bash
cd clones/<site-slug>
npm install
npm run dev
```

Current clone:

- `asksia/` — AskSia landing page clone and its inspection artifacts.
