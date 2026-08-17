#!/usr/bin/env node

/**
 * Emit dist/wink-warm.html — the page the Wink feed mounts for a slide two
 * along, so that game arrives with its files already on the device.
 *
 *   node scripts/build-wink-warm.mjs            # dist/ beside package.json
 *   node scripts/build-wink-warm.mjs --dist out # anywhere else
 *
 * Run it after `vite build`, from the directory whose dist/ is served.
 *
 * Why a page inside the game rather than a fetch from the feed: Chrome keys the
 * HTTP cache on (top-frame site, frame site, is-iframe-document). A request the
 * Wink page makes lands under (winkgames, winkgames), while the game's own frame
 * reads (winkgames, this-game). Different partition, guaranteed miss, every byte
 * paid for twice. A document served by this game, mounted in an iframe by the
 * feed, fetching this game's own files, is the one arrangement whose partition
 * matches the frame that will later read it — by construction, not by luck.
 *
 * What it must not do is boot anything. No engine, no WebGL context, no audio
 * context, no decoded textures: the feed's ceiling of three live engines is the
 * reason this tier can exist at all, and a warm page that started the game would
 * be a fourth engine wearing a different name.
 *
 * Which is why the page fetches through markup and not through a script. These
 * games are served by nginx with an SPA fallback, so a game that has not yet
 * deployed this file answers GET /wink-warm.html with 200 and its own index.html
 * — and a feed that mounted that with scripting enabled would boot the whole game
 * in a hidden 1x1 frame, the exact failure this tier is built to avoid. The feed
 * therefore mounts the frame with `sandbox="allow-same-origin"` and no
 * allow-scripts, which makes the fallback inert and leaves this page working,
 * because <link rel=preload> needs no script to fetch anything.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Everything the game fetches at runtime is worth warming; everything the
// browser will not reuse is not. Documents are excluded because the frame that
// matters loads its own; the bridge and the runtime config are excluded because
// they are fetched before any of this and are already tiny.
const SKIP_EXACT = new Set([
  'wink-warm.html',
  'wink-bridge.js',
  'wink-bridge.lock.json',
  'wink-runtime-config.json',
]);
const SKIP_EXTENSIONS = new Set(['.html', '.map', '.txt', '.md']);

// A ceiling on what one warm slide may pull. Phase A left these games at 6–10MB,
// so in practice nothing is dropped — but a game that regresses past this should
// cost the feed a truncated warm rather than an unbounded download on a phone.
const WARM_BUDGET_BYTES = 16 * 1024 * 1024;

// What `as` a given file has to be preloaded with. Getting this wrong does not
// merely warn — a preload with the wrong destination is fetched and then not
// reused, which is the one outcome this whole tier exists to prevent.
const PRELOAD_AS = new Map([
  ['.js', 'script'],
  ['.mjs', 'script'],
  ['.css', 'style'],
  ['.webp', 'image'],
  ['.avif', 'image'],
  ['.png', 'image'],
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.gif', 'image'],
  ['.svg', 'image'],
  ['.ico', 'image'],
  ['.m4a', 'audio'],
  ['.mp3', 'audio'],
  ['.aac', 'audio'],
  ['.ogg', 'audio'],
  ['.wav', 'audio'],
  ['.mp4', 'video'],
  ['.webm', 'video'],
  ['.woff', 'font'],
  ['.woff2', 'font'],
  ['.ttf', 'font'],
  ['.otf', 'font'],
]);

// Everything the map does not name — .json, .fbx, .atlas, .fnt and whatever a
// future game invents — is a plain fetch. Fonts and fetches are the two
// destinations the spec requires a crossorigin attribute for, even same-origin.
const CORS_DESTINATIONS = new Set(['font', 'fetch']);

function preloadDestination(url) {
  const dot = url.lastIndexOf('.');
  const extension = dot === -1 ? '' : url.slice(dot).toLowerCase();
  return PRELOAD_AS.get(extension) ?? 'fetch';
}

export async function collectWarmAssets(distDir) {
  const found = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      // A symlink can report one size and serve another, which would make the
      // budget below a number rather than a bound.
      if (!entry.isFile()) continue;
      if (SKIP_EXACT.has(entry.name)) continue;
      if (SKIP_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const stat = await fs.stat(full);
      found.push({
        url: `/${path.relative(distDir, full).split(path.sep).join('/')}`,
        bytes: stat.size,
      });
    }
  }

  await walk(distDir);

  // Largest first. A warm that gets interrupted — the user swipes faster than
  // the fetches finish — should have spent its time on the files that cost the
  // most to fetch later, not on whichever the directory listing happened to
  // return first.
  found.sort((a, b) => b.bytes - a.bytes || a.url.localeCompare(b.url));

  const kept = [];
  const dropped = [];
  let total = 0;
  for (const asset of found) {
    if (total + asset.bytes > WARM_BUDGET_BYTES) {
      dropped.push(asset);
      continue;
    }
    kept.push(asset);
    total += asset.bytes;
  }
  return { kept, dropped, bytes: total };
}

export function renderWarmPage(assets) {
  const links = assets
    .map((asset) => {
      const destination = preloadDestination(asset.url);
      // These paths come from a directory listing and are being written into an
      // attribute. Escaping the three characters that can end it early is the
      // difference between a URL and a new tag.
      const href = asset.url
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const crossorigin = CORS_DESTINATIONS.has(destination)
        ? ' crossorigin="anonymous"'
        : '';
      return `<link rel="preload" href="${href}" as="${destination}"${crossorigin}>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>warm</title>
<!--
  Generated by scripts/build-wink-warm.mjs. Do not edit.

  Mounted in a hidden iframe by the Wink feed two slides before this game is
  reached. Its only job is to make these requests from this origin, so that the
  responses land in the HTTP cache partition the real game frame will read from.

  There is deliberately no script here. The feed mounts this frame without
  allow-scripts, so that a game which has not deployed this file yet — nginx
  answers with index.html rather than a 404 — cannot boot itself in the frame.
  That means everything on this page has to fetch through markup alone.
-->
${links}
</head>
<body style="margin:0;background:#000"></body>
</html>
`;
}

export async function buildWinkWarm({ distDir }) {
  const resolved = path.resolve(distDir);
  const { kept, dropped, bytes } = await collectWarmAssets(resolved);
  await fs.writeFile(
    path.join(resolved, 'wink-warm.html'),
    renderWarmPage(kept),
  );
  return { kept, dropped, bytes };
}

function parseDistDir(argv) {
  const index = argv.indexOf('--dist');
  if (index === -1) return 'dist';
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('Usage: node scripts/build-wink-warm.mjs [--dist <dir>]');
  }
  return value;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildWinkWarm({ distDir: parseDistDir(process.argv.slice(2)) });
    console.log(
      `wink warm page written assets=${result.kept.length}` +
        ` bytes=${result.bytes}`,
    );
    // Never a silent cap: a truncated warm reads exactly like a complete one
    // from the feed's side, so the only place it can be noticed is here.
    if (result.dropped.length > 0) {
      console.warn(
        `wink warm dropped ${result.dropped.length} file(s) over the ${WARM_BUDGET_BYTES} byte budget: ` +
          result.dropped.map((asset) => `${asset.url} (${asset.bytes})`).join(', '),
      );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Wink warm page build failed',
    );
    process.exitCode = 1;
  }
}
