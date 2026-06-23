# Chunk Release Notes

## Goal

Reduce the Vite production build warning for JavaScript chunks larger than 500 kB using safe build-time vendor splitting.

Phase 1 is intentionally config-only. It must not change gameplay behavior, rendering flow, scoring, spawning, physics, input handling, auth, leaderboard, Firebase behavior, assets, audio, or spritesheets.

## Constraints

- Do not edit `src/game/core.ts`.
- Do not edit `FruitGame`, Pixi hooks, HUD, leaderboard, auth, Firebase logic, or game/render/UI flow in phase 1.
- Do not change runtime behavior, scoring, spawn, physics, input, leaderboard, or login.
- Do not add new dependencies.
- Do not change assets, audio, spritesheets, Firebase config, or Firestore rules.
- Do not use `chunkSizeWarningLimit` to hide the warning unless it is explicitly approved as the final fallback.
- Keep phase 1 changes limited to `vite.config.ts` and `doc/chun-release.md`.
- Do not commit `dist/`; it is ignored by `.gitignore`.

## Baseline Before Splitting

Commands:

```sh
npm run typecheck
npm run build
```

Result:

- `npm run typecheck` passed.
- `npm run build` passed, but Vite emitted the chunk-size warning.
- The warning was caused by the JavaScript bundle, not CSS or static assets.

Build output:

```text
dist/index.html                               2.06 kB │ gzip:   1.03 kB
dist/assets/index-BA9VHhz3.css               24.93 kB │ gzip:   6.50 kB
dist/assets/CanvasPool-DLf3K83a.js            0.78 kB │ gzip:   0.43 kB
dist/assets/Filter-D4tODpGs.js                0.90 kB │ gzip:   0.48 kB
dist/assets/canvasUtils-DmjyYlTp.js           5.77 kB │ gzip:   1.80 kB
dist/assets/BufferResource-Dy3hIHKb.js       10.61 kB │ gzip:   2.80 kB
dist/assets/webworkerAll-CDswZKW6.js         15.97 kB │ gzip:   5.09 kB
dist/assets/CanvasRenderer-CUWZsv8g.js       18.07 kB │ gzip:   6.03 kB
dist/assets/BitmapFont-Dauv8sjX.js           34.52 kB │ gzip:  11.76 kB
dist/assets/WebGPURenderer-mk9tOR-O.js       39.14 kB │ gzip:  10.95 kB
dist/assets/browserAll-CMFC3zdm.js           43.30 kB │ gzip:  11.38 kB
dist/assets/RenderTargetSystem-BbgH7cOY.js   47.10 kB │ gzip:  12.97 kB
dist/assets/WebGLRenderer-CQKsNcsp.js        68.88 kB │ gzip:  18.91 kB
dist/assets/index-D3YVuGmm.js               953.58 kB │ gzip: 263.81 kB
```

Warning:

```text
(!) Some chunks are larger than 500 kB after minification.
```

## Phase 1 Change

`vite.config.ts` now uses `build.rollupOptions.output.manualChunks` to split dependencies into stable vendor chunks:

- `react-vendor`: `react`, `react-dom`, `scheduler`
- `pixi-filters`: Pixi filter modules
- `pixi-vendor`: remaining `pixi.js` modules
- `firebase-vendor`: `firebase`, `@firebase`
- `ui-vendor`: `lucide-react`, `tw-animate-css`
- `vendor`: remaining `node_modules` dependencies

No dynamic imports or app-screen lazy loading were added in phase 1.

## Verification After Splitting

Commands:

```sh
npm run typecheck
npm run build
```

Result:

- `npm run typecheck` passed.
- `npm run build` passed.
- The original Vite warning `Some chunks are larger than 500 kB after minification` no longer appears.
- The main app chunk shrank from `953.58 kB` to `65.78 kB`.
- The largest chunk is now `pixi-vendor` at `499.28 kB`, just below the 500 kB warning threshold.
- Rollup still emits one circular manual-chunk advisory: `pixi-filters -> pixi-vendor -> pixi-filters`. This is not the Vite chunk-size warning and the build exits successfully, but it should be considered before adding more Pixi splits.

Build output:

```text
dist/index.html                            2.56 kB │ gzip:   1.14 kB
dist/assets/index-BA9VHhz3.css            24.93 kB │ gzip:   6.50 kB
dist/assets/ui-vendor-BlGBe6KB.js          4.89 kB │ gzip:   1.53 kB
dist/assets/pixi-filters-Dn0QYxaF.js      21.72 kB │ gzip:   6.11 kB
dist/assets/vendor-Cr5S2oeN.js            26.19 kB │ gzip:   9.95 kB
dist/assets/index-C13Z-f04.js             65.78 kB │ gzip:  22.76 kB
dist/assets/react-vendor-DVL4t2gp.js     142.90 kB │ gzip:  45.76 kB
dist/assets/firebase-vendor-B4zxg9eU.js  473.29 kB │ gzip: 109.83 kB
dist/assets/pixi-vendor-BtoWkOOf.js      499.28 kB │ gzip: 144.29 kB
```

## Notes For Future Phases

- Do not add more Pixi internal manual chunks casually; several deeper splits removed the size warning but introduced broader circular chunk advisories.
- If the 500 kB warning returns after dependency or gameplay growth, prefer phase 2 lazy-loading of app screens over raising `chunkSizeWarningLimit`.
