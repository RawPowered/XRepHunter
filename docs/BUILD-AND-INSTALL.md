# Build and install

## Requirements

- Node.js 20 or newer
- npm
- Chrome or Edge with support for Manifest V3 extensions

## Install dependencies

From the repository root:

```sh
npm install
```

The postinstall script creates extension icons and copies SQLite, ONNX Runtime, and Wllama runtime assets from the versions recorded by `package-lock.json` into ignored build directories under `public/`.

Ollama is not a dependency of this repository version. The source does not call an Ollama API or connect to a local Ollama server. `@huggingface/transformers` and ONNX Runtime Web are npm dependencies used for model-backed classifiers. `@wllama/wllama` supplies an in-browser WebAssembly runtime for a separate GGUF classifier. These runtimes are bundled into the extension during the build; they are not separate desktop applications to install.

## Build an unpacked extension

```sh
npm run build
```

The build writes a browser-loadable directory to `extension/`. In Chrome, open `chrome://extensions`; in Edge, open `edge://extensions`. Turn on Developer mode, choose **Load unpacked**, and select the repository's `extension/` directory.

To develop with the WXT watcher, run:

```sh
npm run dev
```

## Scoring and model downloads

The core account reputation score runs in the extension using TypeScript heuristics, observed account and post signals, and user-maintained examples. It does not require Ollama or downloaded model weights. Model-backed text, image, and toxicity signals can refine content analysis when their models are loaded. Model settings and status are available in the dashboard.

Model weights are not included in the repository. The extension downloads them from the model URLs configured in source when a model is loaded. The browser may retain downloaded weights in its cache. A first load needs network access to the configured model host and enough local storage and memory for the selected model. Check the model provider, model card, and license before enabling a model for a use that depends on it.

## Rebuild after removing local tooling

If Node packages or generated build files were removed, open a terminal in the repository and run:

```sh
npm install
npm run build
```

Then open the browser's extensions page, load the repository's generated `extension/` directory as an unpacked extension, and reload the X tab. If only model-backed signals are missing, open the dashboard and load the selected model. A healthy extension can still display heuristic reputation and content signals before optional models finish loading.

## Package an archive

After building, run:

```sh
npm run zip
```

WXT creates the archive from its configured output. Review the archive contents and target browser before distribution.

## Current publication scope

This repository documents and builds the source project. It is not an extension-store release, and browser behavior should be validated against the current X interface before operational use. Existing Vitest tests are available through `npm test`; this publication pass did not execute the suite.
