# UcamV2

The React/Vite rebuild now lives at the repository root.

The original HTML/CSS/JS application has been moved to /legacy and is kept as a read-only reference.

The root React app is self-contained:

- runtime assets live under src, public, and dist
- raw camera build inputs live under data-source
- processed app data is generated into public/data
- service-worker cleanup for old legacy deployments is owned by the root app under public/sw.js and src/main.tsx

The root build and runtime should not depend on /legacy.

Preview notes:

- `npm run dev` and `npm run preview` are both pinned to port 4173.
- The Codespaces forwarded URL for port 4173 stays the same for this codespace.
- Dev and preview responses are served with `Cache-Control: no-store` headers to avoid loading an old browser-cached version while previewing.
- Open the app yourself from the Ports panel by clicking port 4173.
- `npm run mobile:check` runs a Playwright mobile smoke test against the current preview URL on iPhone 13 and Pixel 7 viewports.
- The mobile check expects the app preview to already be running on port 4173 and writes artifacts under `test-results/mobile-check`.