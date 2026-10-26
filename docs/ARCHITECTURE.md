# Architecture

XRepHunter is a Chrome and Edge Manifest V3 extension. It reads pages the user opens on X or Twitter, produces local review signals, and stores its observations in browser extension storage.

![XRepHunter component flow](../assets/xrephunter-architecture.svg)

## Runtime components

| Component | Responsibility | Main source |
| --- | --- | --- |
| Content script | Scans timeline and profile surfaces, attaches badges, opens evidence drawers, tracks visible browsing activity, and requests user-confirmed actions. | `src/entrypoints/content.x.ts`, `src/entrypoints/content/` |
| Page hook | Observes selected X web-app GraphQL responses and posts parsed events across the page/extension boundary. | `src/entrypoints/graphql-hook.ts` |
| Background service worker | Routes messages, queues scans, manages offscreen work, refreshes open X tabs after extension reloads, and aggregates scan results. | `src/entrypoints/background.ts`, `src/entrypoints/background/` |
| Offscreen document | Hosts the SQLite engine and lazily loaded model pipelines that need a DOM-capable extension context. | `src/entrypoints/offscreen/` |
| Dashboard | Provides detector settings, trusted accounts, examples, action queue, personal analytics, browsing observatory, and model controls. | `src/entrypoints/dashboard/` |
| Popup | Opens the dashboard from the browser toolbar. | `src/entrypoints/popup/` |

## Scan and signal flow

1. The content script observes the X page and schedules scans as content appears or navigation changes.
2. The page hook emits selected GraphQL responses. The extension normalizes those payloads and combines them with DOM-derived details.
3. Detector modules produce structured evidence for account, post, provenance, content-quality, spam, toxicity, and browsing-topic signals.
4. The scoring layer combines available evidence into an explainable result. Optional model signals refine text, image, and toxicity analysis.
5. Results update feed badges and profile views. The dashboard reads the local account, post, activity, and analytics records.
6. An action suggestion remains separate from scoring. The user must enable suggestions, accept the agreement, and confirm each account action.

## Storage boundaries

- Browser local storage holds settings, detector examples, action state, primary-account settings, and selected snapshots.
- The offscreen SQLite database stores observed account and post records, daily browsing aggregates, and related signal data. Its database file is persisted through extension storage.
- Import/export supports local database backups. Analytics CSV imports are parsed in the extension and recorded locally.
- No XRepHunter application server is part of this repository.

## Model execution

The extension computes the base account reputation score with TypeScript heuristics, observed signals, and configured examples. It uses Transformers.js with ONNX Runtime Web for optional text, image, and toxicity classifiers. A separate Wllama WebAssembly runtime supports an optional GGUF text classifier. The background service worker sends bundled model work to the offscreen document; inference runs in that extension context. When explicitly enabled, the background service worker sends eligible post text to the user's selected Ollama model at the fixed loopback address `127.0.0.1:11434` and merges its score as a separate signal.

Model weights are fetched from their configured Hugging Face repositories when needed. ONNX runtime files and Wllama browser assets are prepared from locked npm packages during installation or build. The model weights are not committed to this repository. Ollama models are installed and managed outside the extension. XRepHunter lists installed model names and does not invoke Ollama's model-pull endpoint.

## Build layout

WXT compiles source from `src/` into `extension/`. Build and postinstall scripts copy the required WebAssembly and SQLite runtime assets into `public/` before WXT packages the extension. Generated files, model weights, and `node_modules/` are excluded from Git.

For installation details, see [Build and install](BUILD-AND-INSTALL.md). For permission and data-flow details, see [Privacy and security](PRIVACY-AND-SECURITY.md).
