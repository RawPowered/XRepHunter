# XRepHunter Changelog

## 2026-05-20

- **Browse interest detection** — classifies timeline posts (news, politics, sports, entertainment, anime, tech, finance, gaming, Pokémon, memes, lifestyle + custom keywords) with Grok-style heuristics and optional CLIP; Leaderboards **Browse interests** tab with session/today breakdown and trends.

## 2026-05-19

- **Explorable metrics on Leaderboards** — sub-nav for feed intake (slop/spam/ads/toxicity over 7–30 days), live participation (likes/reposts/replies you give), combined rates, and Analytics CSV sparklines for your own posts; richer browse_daily schema and GraphQL/click tracking.
- **Toxicity scoring** — T score follows demeaning/hateful labels (insult, threat, identity hate); casual swearing and obscene-only model hits no longer flag posts like “big ass plant”.

## 2026-05-18

- **Slop heuristics** — score AI speech patterns and clichés (phrases, low burstiness, promo, “No/Just” rhetoric); bullet lists alone no longer raise slop.
- **Extension errors** — lazy-load Transformers on first ML message (idle offscreen skips HF chunk); safe runtime messaging on reload; ship `sql-wasm-browser.wasm` for SQLite.
- **ONNX WASM path** — use ORT-compatible `wasmPaths` directory prefix (fixes offscreen “both async and sync fetching of the wasm failed”); fix `hocs` → `host` typo breaking tweet stats bars.
- **Speed + stability** — batch score prefetch (`BATCH_GET_SCORES`), timeline scan debounce, heuristic-first slop (ML only when offscreen models are already loaded), rAF-coalesced DOM scans, explicit ONNX WASM URLs + preload, reload banner on invalidated context.
- **Regression fix** — ship `ort-wasm-simd-threaded.jsep.wasm` in `extension/onnx/` (build fails if missing); coerce partial score breakdowns; harden messaging when the extension reloads (refresh X tab); drawer/insights no longer throw on legacy cache rows.
- **Refactor** — split content, background, and dashboard entrypoints into modules (no file over ~500 lines); fix `breakdown.spamRisk` crash when cached scores omit breakdown.
- **Leaderboard / browse hardening** — correct tweet author from User-Name/status links; upsert post signals when async scores improve; stats bar fallback without action row; ENSURE_ACCOUNT_SCANNED + GraphQL timeline authors; IntersectionObserver visibility; status id in fingerprints; 80-handle discovery cap.
- **Browse stats on Leaderboards** — session + today counters (posts seen, spam/slop flagged, avg slop) while scrolling X; stored in SQLite by calendar day.
- **Leaderboard population fixes** — cached scans now persist to SQLite; post rollups no longer reset reputation scores; profile scroll re-scans with debounce; timeline posts queue full account scans when needed.
- **Mark image as AI** — “Mark AI” control on tweet photos; your marks are stored locally and raise the author’s slop score (default 82), post-signal rollups, and reputation. Toggle and score in dashboard **AI slop** tab.
- **SQLite reputation corpus** — local sql.js database (IndexedDB-backed) in the offscreen document stores accounts, observed posts, and reputation snapshots; one-time migration from `chrome.storage` scores.
- **Post-signal reputation** — timeline and profile posts report Community Notes plus S/T/Sp scores into `posts_observed`; rollups feed `communityNotes` and `postSpamSignals` detectors; baseline risk floor and score cap (default 95) make a perfect 100 unlikely.
- **Leaderboards dashboard** — Riskiest, Safest, Most Community Notes, and Most analyzed tables over your scanned corpus; export/import `.db` with merge or replace.
- **Card / link preview AI detection** — CLIP slop and **AI** overlay on `card_img` and card thumbnails, not only `pbs.twimg.com/media` photos.
- **Promoted Ad posts** — posts with X **Ad** / **Promoted** label only (not videos or `placementTracking` alone): hide preview media and blacken text.
- **AI image badge on timeline** — orange **AI** overlay on tweet photos when CLIP image slop ≥ threshold (default 35); classifies photo-only posts; lazy-load when media URL appears; dashboard toggle and threshold slider.
- **Timeline content metrics chip** — single compact pill on each post: **S** slop · **T** toxicity · **Sp** spam (max of author spam risk + per-tweet heuristic). Numbers always visible; segments highlight above threshold; green **OK** when all low. `spamDisplayThreshold` in dashboard.
- **AI slop text + image** — enriched tweet/card/alt text extraction, promo heuristics, per-tweet `CLASSIFY_SLOP_MEDIA` (ONNX roberta + optional Wllama + CLIP image on `pbs.twimg.com` photos), merged slop score on timeline badges and profile reputation; fixes false **Organic** on promo graphics.
- **Slop ONNX text model** — `onnx-community/roberta-base-openai-detector-ONNX` (bundled `onnx/model_quantized.onnx`; `Xenova/*` 401, `openai-community/*` has no ONNX).
- **Toxicity ONNX runtime (MV3)** — bundle `ort-wasm-simd-threaded.jsep` under `/onnx/` so Transformers.js does not dynamic-import from jsdelivr (blocked by extension CSP).
- **Toxicity ML scoring** — Xenova/toxic-bert (Transformers.js / ONNX in offscreen) classifies profile and per-tweet text for hate, threat, insult, and related labels. **Toxic N** pill on timeline posts; **Organic** requires low slop and toxicity. Reputation no longer inflates to ~90 on empty scans (uncertainty prior); scores cap at 65 when combined toxicity ≥ 70. Dashboard content-safety controls and drawer toxicity breakdown; post sample cap 30.
- **Timeline stats bar badges** — trust score and Organic/Slop pills live in the post action row (before bookmark), not over the tweet. **Organic** when tweet text and author slop are both below threshold; **Slop N** when the post is flagged.
- **Analytics tab + CSV import** — dedicated dashboard tab to import X Account analytics CSV exports; snapshot history with period-over-period deltas, CSS trend sparklines, top posts table, and enhanced insights (concentration risk, import vs live merge). My account shows a one-line analytics teaser linking to the tab. Up to 24 snapshots per handle.
- **My account + Premium analytics insights** — save your primary @handle in the dashboard; view reputation, slop, and breakdown without relying on the active tab. Auto-capture Premium analytics from X Account analytics / Studio via GraphQL hook; audience snapshot, top posts table, and algorithm-aligned risks/opportunities.
- **Auto slop on timeline** — per-tweet heuristic chips (listicle `No/Just` lines, em/en dashes, `--`, AI phrases); cleaner `tweetText` sampling; `slopPerTweetEnabled` toggle; profile signals in drawer/badge tooltips.
- **AI slop CSP fix** — manifest allows `wasm-unsafe-eval` so the local Wllama model can load in offscreen/dashboard (Chrome MV3).
- **AI slop score (hybrid)** — 0–100 slop score on profiles and badges: instant heuristic signals (phrase density, sentence uniformity, corporate/listicle patterns) plus optional local Distil Gemma 270M classifier (~253MB from Hugging Face, runs in offscreen document via Wllama). Model inference adapted from [Distil Labs AI Slop Detector](https://github.com/distil-labs/distil-ai-slop-detector) (Apache 2.0). Dashboard **AI slop** tab for model toggle, test textarea, and display threshold. `aiSlop` detector replaces `aiVoice` in active scoring.
- **X-weighted spam scoring** — spam vs general risk buckets; X stage/rule multipliers; spam-library ×1.5; configurable spam bucket weight (default 65%). Drawer shows breakdown bars and per-hit effective weights.
- **Trustworthy whitelist** — rich trusted-user list; full score always visible with “Trusted” chip; suppresses block suggestions only. Dashboard Trusted tab; profile/drawer/mark-modal actions.
- Build output is written to **`extension/`** at the project root (flat folder — point “Load unpacked” there).
- **X For You algorithm alignment** — reputation rules mapped from [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm): pre-scoring filters, VFFilter, Grox spam/policy, author diversity, and negative engagement (block/mute/report) heuristics. Dashboard **X algorithm** tab lists official rules and local detectors.
- Initial release: MV3 extension for Chrome and Edge on x.com / twitter.com.
- WOT-style reputation score (0–100) with category breakdown.
- Detectors: handle pattern, account age, username history, crypto, repost bot, romance bait, thirst trap, ads, AI heuristics, user spam examples.
- GraphQL interception + DOM fallbacks for profile and About metadata.
- Scanning on profiles, timelines, lists, notifications, and link surfaces.
- Spam example library with import/export; seed examples for known bot patterns.
- Dashboard: rules, examples, action queue, profile health.
- Block suggestions with one-time agreement and per-account confirmation modal.
- Local-only storage (no remote backend).
