# Privacy and security

XRepHunter is designed to keep its settings and collected observations in the local browser profile. This document describes the behavior visible in the source and extension manifest. It is not a third-party security audit or a guarantee that every browser or model behaves identically.

## Permission map

| Permission or host | Why the extension requests it |
| --- | --- |
| `storage` | Store settings and records in browser extension storage. |
| `tabs` | Find open X/Twitter tabs, open the dashboard, and refresh extension content after a reload. |
| `offscreen` | Run the local SQLite database and WebAssembly model work outside the page UI. |
| `scripting` | Reconnect the content interface in an already-open X/Twitter tab after an extension update or reload. |
| `x.com`, `twitter.com` | Read visible pages and selected web-app responses on those sites. |
| `huggingface.co`, `cdn-lfs.huggingface.co` | Download model configuration and weights when a model is loaded. |
| `cdn.jsdelivr.net` | Provide an ONNX WebAssembly fallback when the local runtime file is unavailable. |
| `pbs.twimg.com`, `*.twimg.com` | Load public post images when the optional image classifier analyzes a media URL. |

The extension does not request access to every website for content scanning. Its web-accessible resources are exposed only as needed for extension loading and worker/model files; the `all_urls` match on a resource declaration does not add page host permission to scan every site.

## Data handling

- Settings, observed signals, browsing aggregates, and imported analytics stay in extension-local browser storage.
- There is no application API, telemetry collector, or XRepHunter-owned server endpoint in this project.
- Text classification executes locally after the model has been downloaded. Post text and the local database are not uploaded to XRepHunter infrastructure.
- When image analysis is enabled, the browser fetches the referenced X media URL so the local image model can analyze it. The media request goes to the image host.
- Model downloads go to the model host named in the source. Model files are cached by the browser. Model repositories and revisions are not all pinned to immutable commit hashes, so upstream changes can affect repeatability.
- The source has no Ollama endpoint or Ollama server integration. Model inference described here runs in the extension through Transformers.js/ONNX Runtime Web or Wllama WebAssembly.
- XRepHunter reads content available to the user’s signed-in browser session. The extension does not bypass access controls or use an X API key.

X itself continues to make its normal website requests in the browser. XRepHunter’s page hook observes selected response data available to the page and passes parsed fields to the extension for local analysis.

## Safeguards in the implementation

- The project uses Manifest V3 and an extension-page Content Security Policy. `wasm-unsafe-eval` is enabled for WebAssembly inference; remote scripts are not configured as extension code.
- Database and model work runs in an offscreen extension document and communicates with the background worker through extension messages.
- Block suggestions are disabled by default. Enabling them requires an agreement, and the user confirms each account action in a separate dialog.
- The scoring UI presents evidence and uncertainty. It does not claim that a score proves account identity or authorship.
- Build/runtime assets are generated from npm dependencies and the dependency lockfile. Model weights are fetched separately from the listed providers.

## User controls and data lifecycle

Users can disable detectors and optional models, adjust thresholds, use learning mode, manage trusted accounts, and import or export the local database. Database replacement is explicit. Browser extension storage can be cleared through the browser’s extension data controls; export a backup first if the records should be retained.

## Security limits

- X’s page structure and internal GraphQL responses can change without notice. Parsing and page interaction may stop working until updated.
- The content script operates on a page controlled by X. XRepHunter does not treat page-provided strings as trusted identity or verification data.
- A downloaded model is third-party data. This project does not independently establish its quality, authorship labels, or license suitability for every use.
- Npm dependency advisories remain under review. Major upgrades to Transformers.js and WXT require compatibility work and are outside this publication update.
- No penetration test, privacy certification, or independent model audit is claimed.

For interpretation of individual signal families, see [Scoring and limits](SCORING-AND-LIMITS.md).
