#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CERTIFIED_BRIDGE = Object.freeze({
  bridgeVersion: '9.0.0',
  protocolVersion: 1,
  sha256: 'afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb',
  sourceCommit: 'efc50ed4a27cb55f351c257350e1993d385e4a3f',
});

export const DEFAULT_CERTIFIED_TEMPLATE =
  '/Users/ddwsc/Desktop/papagroup/web/wink/.worktrees/codex/minigame-runtime-pilot/game-template';

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sourceHead(templateDir) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: path.resolve(templateDir, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('Certified Wink template Git provenance is unavailable');
  }
}

export async function syncWinkBridge({
  rootDir = process.cwd(),
  certifiedTemplateDir = DEFAULT_CERTIFIED_TEMPLATE,
  requireSourceCommit = true,
} = {}) {
  const artifactPath = path.join(certifiedTemplateDir, 'wink-bridge.js');
  const manifestPath = path.join(
    certifiedTemplateDir,
    'wink-bridge.manifest.json',
  );
  const [artifact, manifestText] = await Promise.all([
    fs.readFile(artifactPath),
    fs.readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const sha256 = digest(artifact);

  if (
    manifest.bridgeVersion !== CERTIFIED_BRIDGE.bridgeVersion ||
    manifest.protocolVersion !== CERTIFIED_BRIDGE.protocolVersion ||
    sha256 !== CERTIFIED_BRIDGE.sha256
  ) {
    throw new Error('Certified Wink bridge source does not match the R4 pin');
  }
  if (
    requireSourceCommit &&
    sourceHead(certifiedTemplateDir) !== CERTIFIED_BRIDGE.sourceCommit
  ) {
    throw new Error('Certified Wink template commit does not match the R4 pin');
  }

  const publicDir = path.join(rootDir, 'public');
  const lock = {
    name: 'wink-bridge',
    bridgeVersion: CERTIFIED_BRIDGE.bridgeVersion,
    protocolVersion: CERTIFIED_BRIDGE.protocolVersion,
    sha256,
    bytes: artifact.byteLength,
    source: {
      repository: 'wink',
      commit: CERTIFIED_BRIDGE.sourceCommit,
      artifact: 'game-template/wink-bridge.js',
      manifest: 'game-template/wink-bridge.manifest.json',
    },
  };

  await fs.mkdir(publicDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(publicDir, 'wink-bridge.js'), artifact),
    fs.writeFile(
      path.join(publicDir, 'wink-bridge.lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
    ),
  ]);

  return Object.freeze({ ...lock });
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await syncWinkBridge({
    certifiedTemplateDir:
      process.env.WINK_CERTIFIED_TEMPLATE_DIR ||
      DEFAULT_CERTIFIED_TEMPLATE,
  });
  console.log(
    `wink bridge synced version=${result.bridgeVersion} protocol=${result.protocolVersion} bytes=${result.bytes} sha256=${result.sha256}`,
  );
}
