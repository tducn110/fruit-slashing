import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyWinkBridge } from '../verify-wink-bridge.mjs';
import { assertWinkBuildEnvironment } from '../../vite.config.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CERTIFIED_SHA256 =
  '089b2d6c2261a7b285fa8acf5ff599e6d2aba9c1366f9def4ae1b1f9fefcfbda';
const CERTIFIED_COMMIT =
  'fa76cdb800377579bb3459164afb92f0bbace379';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath).toString('utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('R4 certified Wink bridge files', () => {
  it('pins the Node 22 npm-only toolchain', () => {
    const packageJson = readJson('package.json');

    expect(read('.nvmrc').toString('utf8').trim()).toBe('22');
    expect(Number(process.versions.node.split('.')[0])).toBe(22);
    expect(packageJson.engines).toEqual({
      node: '22.x',
      npm: '11.x',
    });
    expect(packageJson.packageManager).toBe('npm@11.3.0');
    expect(packageJson).not.toHaveProperty('pnpm');
    expect(fs.existsSync(path.join(ROOT, 'pnpm-workspace.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('vendors the certified bridge byte-for-byte with a deterministic lock', () => {
    const vendored = read('public/wink-bridge.js');
    const lock = readJson('public/wink-bridge.lock.json');

    expect(sha256(vendored)).toBe(CERTIFIED_SHA256);
    expect(lock).toEqual({
      name: 'wink-bridge',
      bridgeVersion: '9.0.1',
      protocolVersion: 1,
      sha256: CERTIFIED_SHA256,
      bytes: vendored.byteLength,
      source: {
        repository: 'wink',
        commit: CERTIFIED_COMMIT,
        artifact: 'game-template/wink-bridge.js',
        manifest: 'game-template/wink-bridge.manifest.json',
      },
    });
  });

  it('keeps runtime config public, exact, and secret-free', () => {
    const config = readJson('public/wink-runtime-config.json');

    expect(config).toEqual({
      gameId: '36348ccc-1f37-4eca-ad1c-a8a47292ace7',
      environment: 'prod',
      protocolVersion: 1,
      bridgeVersion: '9.0.1',
      allowedParentOrigins: [
        'https://winkgames.papastudio.net',
        'http://localhost:3000',
      ],
    });
    expect(JSON.stringify(config)).not.toMatch(
      /apiBase|token|secret|anonymous|refresh|primary/i,
    );
  });

  it('loads the bridge before the Vite module', () => {
    const html = read('index.html').toString('utf8');
    const bridgeIndex = html.indexOf('<script src="/wink-bridge.js"></script>');
    const moduleIndex = html.indexOf(
      '<script type="module" src="/src/main.tsx"></script>',
    );

    expect(bridgeIndex).toBeGreaterThan(-1);
    expect(moduleIndex).toBeGreaterThan(bridgeIndex);
  });

  it('rejects production credential, API, or offline build inputs', () => {
    expect(() =>
      assertWinkBuildEnvironment('production', {
        VITE_WINK_OFFLINE_MODE: 'true',
      }),
    ).toThrow(/offline/i);
    expect(() =>
      assertWinkBuildEnvironment('production', {
        VITE_WINK_API_BASE: 'https://api.example.test',
      }),
    ).toThrow(/public authority/i);
    expect(() =>
      assertWinkBuildEnvironment('production', {
        VITE_WINK_ACCESS_TOKEN: 'credential',
      }),
    ).toThrow(/public authority/i);
    expect(() =>
      assertWinkBuildEnvironment('development', {
        VITE_WINK_OFFLINE_MODE: 'true',
      }),
    ).not.toThrow();
  });

  it('passes the reusable bridge verification command', async () => {
    await expect(
      verifyWinkBridge({ rootDir: ROOT }),
    ).resolves.toEqual({
      bridgeVersion: '9.0.1',
      protocolVersion: 1,
      sha256: CERTIFIED_SHA256,
      bytes: expect.any(Number),
      environment: 'prod',
      gameId: '36348ccc-1f37-4eca-ad1c-a8a47292ace7',
    });
  });
});
