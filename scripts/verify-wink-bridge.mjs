#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CERTIFIED_BRIDGE,
  DEFAULT_CERTIFIED_TEMPLATE,
} from './sync-wink-bridge.mjs';

const CONFIG_KEYS = Object.freeze([
  'allowedParentOrigins',
  'bridgeVersion',
  'environment',
  'gameId',
  'protocolVersion',
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_PATTERN = /apiBase|token|secret|anonymous|refresh|primary/i;

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function exactOrigin(value) {
  if (typeof value !== 'string' || value === '*') return false;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.username === '' &&
      url.password === '' &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function assertRuntimeConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    JSON.stringify(Object.keys(config).sort()) !==
      JSON.stringify([...CONFIG_KEYS].sort()) ||
    !UUID_PATTERN.test(config.gameId) ||
    !['dev', 'prod'].includes(config.environment) ||
    config.protocolVersion !== CERTIFIED_BRIDGE.protocolVersion ||
    config.bridgeVersion !== CERTIFIED_BRIDGE.bridgeVersion ||
    !Array.isArray(config.allowedParentOrigins) ||
    config.allowedParentOrigins.length === 0 ||
    config.allowedParentOrigins.some((origin) => !exactOrigin(origin)) ||
    new Set(config.allowedParentOrigins).size !==
      config.allowedParentOrigins.length ||
    SECRET_PATTERN.test(JSON.stringify(config))
  ) {
    throw new Error('Wink runtime config does not match the public R4 contract');
  }
}

export async function verifyWinkBridge({
  rootDir = process.cwd(),
  certifiedTemplateDir = null,
} = {}) {
  const publicDir = path.join(rootDir, 'public');
  const [artifact, lockText, configText, indexHtml] = await Promise.all([
    fs.readFile(path.join(publicDir, 'wink-bridge.js')),
    fs.readFile(path.join(publicDir, 'wink-bridge.lock.json'), 'utf8'),
    fs.readFile(path.join(publicDir, 'wink-runtime-config.json'), 'utf8'),
    fs.readFile(path.join(rootDir, 'index.html'), 'utf8'),
  ]);
  const lock = JSON.parse(lockText);
  const config = JSON.parse(configText);
  const sha256 = digest(artifact);
  const bridgeIndex = indexHtml.indexOf(
    '<script src="/wink-bridge.js"></script>',
  );
  const moduleIndex = indexHtml.indexOf(
    '<script type="module" src="/src/main.tsx"></script>',
  );

  if (
    lock.name !== 'wink-bridge' ||
    lock.bridgeVersion !== CERTIFIED_BRIDGE.bridgeVersion ||
    lock.protocolVersion !== CERTIFIED_BRIDGE.protocolVersion ||
    lock.sha256 !== CERTIFIED_BRIDGE.sha256 ||
    lock.source?.commit !== CERTIFIED_BRIDGE.sourceCommit ||
    lock.bytes !== artifact.byteLength ||
    sha256 !== CERTIFIED_BRIDGE.sha256 ||
    bridgeIndex < 0 ||
    moduleIndex <= bridgeIndex
  ) {
    throw new Error('Vendored Wink bridge does not match the certified R4 lock');
  }
  assertRuntimeConfig(config);

  if (certifiedTemplateDir) {
    const [certifiedArtifact, manifestText] = await Promise.all([
      fs.readFile(path.join(certifiedTemplateDir, 'wink-bridge.js')),
      fs.readFile(
        path.join(certifiedTemplateDir, 'wink-bridge.manifest.json'),
        'utf8',
      ),
    ]);
    const manifest = JSON.parse(manifestText);
    if (
      !artifact.equals(certifiedArtifact) ||
      manifest.bridgeVersion !== CERTIFIED_BRIDGE.bridgeVersion ||
      manifest.protocolVersion !== CERTIFIED_BRIDGE.protocolVersion
    ) {
      throw new Error('Vendored Wink bridge bytes differ from the certified artifact');
    }
  }

  return Object.freeze({
    bridgeVersion: lock.bridgeVersion,
    protocolVersion: lock.protocolVersion,
    sha256,
    bytes: artifact.byteLength,
    environment: config.environment,
    gameId: config.gameId,
  });
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const evidence = await verifyWinkBridge({
    certifiedTemplateDir:
      process.env.WINK_CERTIFIED_TEMPLATE_DIR || null,
  });
  console.log(
    `wink bridge verified version=${evidence.bridgeVersion} protocol=${evidence.protocolVersion} bytes=${evidence.bytes} sha256=${evidence.sha256} environment=${evidence.environment} gameId=${evidence.gameId}`,
  );
}
