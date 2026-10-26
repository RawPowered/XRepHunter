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

## Build an unpacked extension

```sh
npm run build
```

The build writes a browser-loadable directory to `extension/`. In Chrome, open `chrome://extensions`; in Edge, open `edge://extensions`. Turn on Developer mode, choose **Load unpacked**, and select the repository's `extension/` directory.

To develop with the WXT watcher, run:

```sh
npm run dev
```

## Optional model downloads

Model weights are not included in the repository. The extension downloads them from the model URLs configured in source when a model is first enabled. The browser may retain downloaded weights in its cache. Check the model provider, model card, and license before enabling a model for a use that depends on them.

## Package an archive

After building, run:

```sh
npm run zip
```

WXT creates the archive from its configured output. Review the archive contents and target browser before distribution.

## Current publication scope

This repository documents and builds the source project. It is not an extension-store release, and browser behavior should be validated against the current X interface before operational use. Existing Vitest tests are available through `npm test`; this publication pass did not execute the suite.
