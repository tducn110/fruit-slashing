import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertWinkBuildEnvironment } from "../../../../vite.config";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const BRIDGE_SOURCE = fs.readFileSync(
  path.join(ROOT, "public/wink-bridge.js"),
  "utf8",
);
const GAME_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_GAME_ID = "55555555-5555-4555-8555-555555555555";
const PARENT_ORIGIN = "http://127.0.0.1:8787";
const GAME_ORIGIN = "http://127.0.0.1:5173";
const ROUND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCOPED_TOKEN = "scoped-security-negative-token";
const API_BASE = "http://127.0.0.1:3000/api/v1";

interface InstalledBridge {
  getState(): Record<string, unknown>;
  getCapabilities(): Record<string, boolean>;
  submitScore(input: Record<string, unknown>): Promise<unknown>;
  complete(input: Record<string, unknown>): void;
  help(): Record<string, unknown>;
}

interface ParentStub {
  postMessage: ReturnType<typeof vi.fn>;
}

interface DomHandle {
  window: Window & typeof globalThis & {
    close(): void;
    eval(source: string): unknown;
  };
}

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options: { runScripts: string; url: string },
  ) => DomHandle;
};

interface BridgeHarness {
  dom: DomHandle;
  target: Window & typeof globalThis & {
    WinkBridge: InstalledBridge;
    WinkBridgeVersion: string;
  };
  parent: ParentStub;
  fetchImpl: ReturnType<typeof vi.fn>;
  consoleEntries: string[];
  send(
    data: Record<string, unknown>,
    options?: { origin?: string; source?: object },
  ): void;
  toRealm<T>(value: T): T;
}

const activeDoms: DomHandle[] = [];

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    gameId: GAME_ID,
    environment: "dev",
    protocolVersion: 1,
    bridgeVersion: "9.2.0",
    allowedParentOrigins: [PARENT_ORIGIN],
    ...overrides,
  };
}

function validAnonymousSession(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: SCOPED_TOKEN,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    sessionId: "33333333-3333-4333-8333-333333333331",
    gameId: GAME_ID,
    gameOrigin: GAME_ORIGIN,
    scopes: ["leaderboard:read"],
    capabilities: {
      getLeaderboard: true,
      submitScore: false,
      complete: true,
    },
    identity: { type: "anonymous" },
    apiBase: API_BASE,
    environment: "dev",
    protocolVersion: 1,
    ...overrides,
  };
}

function envelope(
  type: string,
  payload: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    type,
    protocolVersion: 1,
    gameId: GAME_ID,
    payload,
    ...overrides,
  };
}

function storageSnapshot(storage: Storage): Record<string, string | null> {
  return Object.fromEntries(
    Array.from({ length: storage.length }, (_, index) => {
      const key = storage.key(index) ?? "";
      return [key, storage.getItem(key)];
    }),
  );
}

async function createHarness(options: {
  topLevel?: boolean;
  config?: Record<string, unknown>;
  expectedPhase?: "error" | "waiting_parent_hello";
} = {}): Promise<BridgeHarness> {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id=\"root\"></div></body></html>",
    {
      runScripts: "outside-only",
      url: `${GAME_ORIGIN}/`,
    },
  );
  activeDoms.push(dom);
  const target = dom.window as unknown as BridgeHarness["target"];
  const parent: ParentStub = { postMessage: vi.fn() };
  const consoleEntries: string[] = [];
  const capture = (...values: unknown[]) => {
    consoleEntries.push(
      values.map((value) => String(value)).join(" "),
    );
  };
  Object.defineProperty(target, "console", {
    configurable: true,
    value: {
      ...target.console,
      debug: capture,
      error: capture,
      info: capture,
      log: capture,
      warn: capture,
    },
  });
  Object.defineProperty(target, "parent", {
    configurable: true,
    value: options.topLevel ? target : parent,
  });
  const toRealm = <T,>(value: T): T =>
    target.JSON.parse(JSON.stringify(value)) as T;
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => toRealm(options.config ?? validConfig()),
  }));
  Object.defineProperty(target, "fetch", {
    configurable: true,
    value: fetchImpl,
  });

  target.eval(BRIDGE_SOURCE);
  const harness: BridgeHarness = {
    dom,
    target,
    parent,
    fetchImpl,
    consoleEntries,
    send(data, eventOptions = {}) {
      target.dispatchEvent(
        new target.MessageEvent("message", {
          data: toRealm(data),
          origin: eventOptions.origin ?? PARENT_ORIGIN,
          source: (eventOptions.source ?? parent) as WindowProxy,
        }),
      );
    },
    toRealm,
  };

  if (!options.topLevel) {
    await vi.waitFor(() => {
      expect(target.WinkBridge.getState()).toMatchObject({
        phase: options.expectedPhase ?? "waiting_parent_hello",
      });
    });
  }
  return harness;
}

function bindParent(harness: BridgeHarness): void {
  harness.send(envelope("wink:hello", {}));
  expect(harness.target.WinkBridge.getState()).toMatchObject({
    phase: "waiting_session",
  });
}

function acceptAnonymousSession(harness: BridgeHarness): void {
  harness.send(
    envelope("wink:session", {
      session: validAnonymousSession(),
    }),
  );
  expect(harness.target.WinkBridge.getState()).toMatchObject({
    phase: "ready_anonymous",
    identityType: "anonymous",
  });
}

afterEach(() => {
  activeDoms.splice(0).forEach((dom) => dom.window.close());
  vi.restoreAllMocks();
});

describe("certified bridge security negatives", () => {
  it("fails top-level with PARENT_REQUIRED before any config or API request", async () => {
    const harness = await createHarness({ topLevel: true });

    expect(harness.target.WinkBridge.getState()).toMatchObject({
      phase: "error",
      error: { code: "PARENT_REQUIRED" },
    });
    expect(harness.target.WinkBridge.help()).toMatchObject({
      bridgeVersion: "9.2.0",
      protocolVersion: 1,
      errorCode: "PARENT_REQUIRED",
      hasSession: false,
    });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
    expect(harness.parent.postMessage).not.toHaveBeenCalled();
  });

  it("rejects wrong source, origin, protocol, game ID, and schema", async () => {
    const harness = await createHarness();
    const foreignSource = { postMessage: vi.fn() };
    const invalidMessages = [
      {
        data: envelope("wink:hello", {}),
        source: foreignSource,
      },
      {
        data: envelope("wink:hello", {}),
        origin: "http://127.0.0.1:9999",
      },
      {
        data: envelope("wink:hello", {}, { protocolVersion: 2 }),
      },
      {
        data: envelope("wink:hello", {}, { gameId: OTHER_GAME_ID }),
      },
      {
        data: envelope("wink:hello", { unknown: true }),
      },
    ];

    for (const invalid of invalidMessages) {
      harness.send(invalid.data, invalid);
    }
    expect(harness.target.WinkBridge.getState()).toMatchObject({
      phase: "waiting_parent_hello",
    });
    expect(harness.parent.postMessage).not.toHaveBeenCalled();

    bindParent(harness);
    acceptAnonymousSession(harness);
    const before = harness.target.WinkBridge.getState();
    const staleSource = { postMessage: vi.fn() };
    harness.send(
      envelope("wink:lifecycle", { paused: true, muted: true }),
      { source: staleSource },
    );
    harness.send(
      envelope("wink:lifecycle", { paused: true, muted: true }),
      { origin: "http://127.0.0.1:9999" },
    );
    harness.send(
      envelope(
        "wink:lifecycle",
        { paused: true, muted: true },
        { protocolVersion: 2 },
      ),
    );
    harness.send(
      envelope("wink:lifecycle", {
        paused: true,
        muted: true,
        accessToken: SCOPED_TOKEN,
      }),
    );
    expect(harness.target.WinkBridge.getState()).toEqual(before);

    harness.send(
      envelope("wink:lifecycle", { paused: true, muted: true }),
    );
    expect(harness.target.WinkBridge.getState()).toMatchObject({
      lifecycle: { paused: true, muted: true },
    });
  });

  it("rejects a stale session and redacts its authority", async () => {
    const harness = await createHarness();
    bindParent(harness);
    harness.send(
      envelope("wink:session", {
        session: validAnonymousSession({
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        }),
      }),
    );

    expect(harness.target.WinkBridge.getState()).toMatchObject({
      phase: "error",
      error: { code: "SESSION_EXPIRED" },
    });
    const observable = JSON.stringify({
      state: harness.target.WinkBridge.getState(),
      diagnostics: harness.target.WinkBridge.help(),
      parentMessages: harness.parent.postMessage.mock.calls,
      console: harness.consoleEntries,
    });
    expect(observable).not.toContain(SCOPED_TOKEN);
    expect(observable).not.toContain(API_BASE);
  });

  it("denies anonymous score locally and exposes no session authority", async () => {
    const harness = await createHarness();
    bindParent(harness);
    acceptAnonymousSession(harness);

    await expect(
      harness.target.WinkBridge.submitScore({
        score: 10,
        playTime: 2,
        metadata: { roundId: ROUND_ID },
      }),
    ).rejects.toMatchObject({
      code: "CAPABILITY_DENIED",
      recoverable: false,
    });
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    expect(harness.fetchImpl).toHaveBeenCalledWith(
      "/wink-runtime-config.json",
      { credentials: "omit" },
    );
    expect(
      harness.parent.postMessage.mock.calls.every(
        ([, targetOrigin]) => targetOrigin === PARENT_ORIGIN,
      ),
    ).toBe(true);

    const observable = JSON.stringify({
      url: harness.target.location.href,
      localStorage: storageSnapshot(harness.target.localStorage),
      sessionStorage: storageSnapshot(harness.target.sessionStorage),
      dom: harness.target.document.documentElement.outerHTML,
      state: harness.target.WinkBridge.getState(),
      diagnostics: harness.target.WinkBridge.help(),
      parentMessages: harness.parent.postMessage.mock.calls,
      console: harness.consoleEntries,
    });
    expect(observable).not.toContain(SCOPED_TOKEN);
    expect(observable).not.toContain(API_BASE);
    expect(observable).not.toMatch(
      /primary-access-token|refresh-handle|dev-secret|anonymous-id-sentinel/i,
    );
    expect(BRIDGE_SOURCE).not.toMatch(
      /postMessage\s*\([\s\S]{0,400}?,\s*["']\*["']\s*\)/,
    );
  });

  it("fails closed on config drift and all direct public API authority", async () => {
    const harness = await createHarness({
      config: validConfig({ bridgeVersion: "8.0.0" }),
      expectedPhase: "error",
    });
    await vi.waitFor(() => {
      expect(harness.target.WinkBridge.getState()).toMatchObject({
        phase: "error",
        error: { code: "PROTOCOL_MISMATCH" },
      });
    });
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    expect(harness.parent.postMessage).not.toHaveBeenCalled();

    expect(() =>
      assertWinkBuildEnvironment("development", {
        VITE_WINK_API_BASE: "https://api.wink.example/api/v1",
      }),
    ).toThrow(/public authority/i);
    expect(() =>
      assertWinkBuildEnvironment("development", {
        VITE_WINK_ACCESS_TOKEN: "primary-access-token",
      }),
    ).toThrow(/public authority/i);
  });
});

describe("R4 iframe-only documentation boundary", () => {
  it("documents certified iframe and explicit non-certifying offline commands", () => {
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

    expect(readme).toContain("npm run verify:wink-bridge");
    expect(readme).toContain("VITE_WINK_OFFLINE_MODE=true npm run dev");
    expect(readme).toMatch(/iframe/i);
    expect(readme).toMatch(/PARENT_REQUIRED/);
    expect(readme).not.toMatch(
      /Điểm và bảng xếp hạng được lưu local|không cần đăng nhập hoặc backend riêng/,
    );
  });
});
