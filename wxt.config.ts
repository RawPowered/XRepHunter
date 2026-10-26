import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  /** Built extension lives in ./extension — use for “Load unpacked”. */
  outDir: 'extension',
  outDirTemplate: '.',
  vite: () => ({
    resolve: {
      dedupe: ['onnxruntime-web', 'onnxruntime-common'],
    },
    build: {
      /** Keep ORT wasm out of the offscreen chunk (load from /onnx/ via wasmPaths + wasmBinary). */
      assetsInlineLimit: 0,
    },
  }),
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      manifest.content_security_policy = {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      };
      manifest.content_scripts = [
        {
          matches: ['*://x.com/*', '*://twitter.com/*'],
          js: ['content.js'],
          run_at: 'document_idle',
        },
      ];
      manifest.web_accessible_resources = [
        {
          resources: ['graphql-hook.js'],
          matches: ['*://x.com/*', '*://twitter.com/*'],
        },
        {
          resources: ['wllama/**/*'],
          matches: ['<all_urls>'],
        },
        {
          resources: ['onnx/**/*', 'assets/ort-wasm*.wasm'],
          matches: ['<all_urls>'],
        },
        {
          resources: ['sql/**/*'],
          matches: ['<all_urls>'],
        },
      ];
    },
  },
  manifest: {
    name: 'XRepHunter',
    description:
      'Reputation monitor for X.com — detect bot/spam patterns, train on examples, and suggest blocks.',
    permissions: ['storage', 'tabs', 'offscreen', 'scripting'],
    host_permissions: [
      '*://x.com/*',
      '*://twitter.com/*',
      'https://huggingface.co/*',
      'https://cdn-lfs.huggingface.co/*',
      'https://cdn.jsdelivr.net/*',
      'https://pbs.twimg.com/*',
      'https://*.twimg.com/*',
    ],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      96: 'icon-96.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'XRepHunter',
      default_icon: { 48: 'icon-48.png' },
    },
    options_ui: {
      page: 'dashboard.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
});
