#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyWinkBridge } from "./verify-wink-bridge.mjs";
import {
  createR1FixtureServer,
  createStaticDistServer,
} from "./c4/servers.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DIST_DIR = path.join(ROOT, "dist");
const GAME_ID = "11111111-1111-4111-8111-111111111111";
const GAME_ORIGIN = "http://127.0.0.1:5173";
const HARNESS_ORIGIN = "http://127.0.0.1:8787";
const CERTIFIED_COMMIT =
  "dfcfdafb7f9a85120a7d2db4a40d5c1060d4275a";
const CERTIFIED_SHA256 =
  "ec64697cd9912cd4ff8ed007ff14969280a723f4acb48dfe5bcd27c48e6ec8bc";
const DETERMINISTIC_GAME_SEED = 82_826;
const DEFAULT_R2_TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../wink/.worktrees/codex/minigame-runtime-pilot/game-template",
);
const ROUND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function waitUntil(
  predicate,
  message,
  { timeoutMs = 15_000, intervalMs = 50 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `${message}${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
  );
}

async function listFiles(directory, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relativePath = path.posix.join(prefix, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

async function digestTree(directory) {
  const digest = crypto.createHash("sha256");
  for (const file of await listFiles(directory)) {
    digest.update(file.relativePath);
    digest.update("\0");
    digest.update(await fs.readFile(file.absolutePath));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function loadPlaywright(r2Root) {
  const require = createRequire(import.meta.url);
  return require(path.join(r2Root, "node_modules", "playwright"));
}

async function readCompleteMessages(page) {
  return page.evaluate(() =>
    (window.__C4_MESSAGES__ || []).filter(
      (message) => message.type === "wink:complete",
    ),
  );
}

async function readAudioGains(frame) {
  return frame.evaluate(() =>
    (window.__C4_AUDIO_GAINS__ || [])
      .slice(0, 2)
      .map((gain) => gain.gain.value),
  );
}

async function waitForAudioGains(frame, expected) {
  return waitUntil(
    async () => {
      const gains = await readAudioGains(frame);
      return JSON.stringify(gains) === JSON.stringify(expected)
        ? gains
        : null;
    },
    `audio gains did not reach ${JSON.stringify(expected)}`,
  );
}

async function waitForBridgePhase(frame, phase) {
  await frame.waitForFunction(
    (expected) =>
      window.WinkBridge?.getState().phase === expected,
    phase,
    { timeout: 15_000 },
  );
}

async function waitForDeterministicGameSeed(frame, expectedCount) {
  const seeds = await waitUntil(
    () =>
      frame.evaluate(
        ({ expectedCount, expectedSeed }) => {
          const values = window.__C4_GAME_SEEDS__ || [];
          return values.length >= expectedCount &&
            values.slice(0, expectedCount).every(
              (value) => value === expectedSeed,
            )
            ? values
            : null;
        },
        {
          expectedCount,
          expectedSeed: DETERMINISTIC_GAME_SEED,
        },
      ),
    "Fruit game did not consume the deterministic C4 seed",
  );
  invariant(
    seeds.length === expectedCount,
    "Fruit game consumed an unexpected number of round seeds",
  );
}

async function waitForHero(frame, label) {
  const page = frame.page();
  const currentFrame = () =>
    page
      .frames()
      .find((candidate) => candidate.url() === `${GAME_ORIGIN}/`) ||
    frame;
  const target = currentFrame();
  try {
    await target.locator(".hero-play-button").waitFor({
      state: "visible",
      timeout: 20_000,
    });
    return target;
  } catch (error) {
    const context = await target
      .evaluate(() => ({
        body: document.body.innerText.slice(0, 500),
        url: window.location.href,
      }))
      .catch(() => ({ body: "frame unavailable", url: "" }));
    const pageFrames = page
      .frames()
      .map((candidate) => ({
        url: candidate.url(),
        detached: candidate.isDetached(),
      }));
    const pageErrors = frame
      .page()
      .url();
    const outer = await target
      .evaluate(() => document.documentElement.outerHTML.slice(0, 1_000))
      .catch(() => "frame unavailable");
    throw new Error(
      `${label}: ${error instanceof Error ? error.message : String(error)}; ` +
        `frame=${JSON.stringify(context)} frames=${JSON.stringify(pageFrames)} ` +
        `page=${pageErrors} html=${JSON.stringify(outer)}`,
    );
  }
}

async function exerciseLeaderboard({
  fixture,
  frame,
  mode,
}) {
  const field =
    mode === "anonymous"
      ? "anonymousLeaderboardReads"
      : "authenticatedLeaderboardReads";
  const before = fixture.getEvidence()[field];
  await frame.locator(".hero-leaderboard-button").click();
  try {
    await waitUntil(
      () => fixture.getEvidence()[field] >= before + 1,
      `${mode} leaderboard read did not reach the R1 fixture`,
    );
  } catch (error) {
    const state = await frame.evaluate(() => ({
      banner: document.querySelector(".wink-integration-status")?.textContent,
      bridge: window.WinkBridge?.getState(),
    }));
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; ` +
        `fixture=${JSON.stringify(fixture.getEvidence())}; ` +
        `frame=${JSON.stringify(state)}`,
    );
  }
  await frame
    .getByRole("button", { name: "Quay lại", exact: true })
    .click();
  frame = await waitForHero(frame, `${mode} leaderboard return`);
}

async function verifyLifecycle({ frame, page }) {
  await new Promise((resolve) => setTimeout(resolve, 1_250));

  const settings = frame.getByRole("button", {
    name: "Cài đặt",
    exact: true,
  });
  await settings.click();
  await frame
    .getByRole("button", {
      name: "Tắt hiệu ứng âm thanh",
      exact: true,
    })
    .click();
  const userPreference = await waitForAudioGains(frame, [1, 0]);
  await settings.click();

  await page.locator("#pause-game").click();
  await frame.waitForFunction(
    () => window.WinkBridge?.getState().lifecycle.paused === true,
    null,
    { timeout: 10_000 },
  );
  const canvas = frame.locator("canvas").last();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const pausedFirst = await canvas.screenshot();
  await new Promise((resolve) => setTimeout(resolve, 550));
  const pausedSecond = await canvas.screenshot();
  const pauseStable =
    sha256(pausedFirst) === sha256(pausedSecond);
  invariant(pauseStable, "Pixi canvas advanced while parent-paused");

  await page.locator("#mute-game").click();
  await frame.waitForFunction(
    () => window.WinkBridge?.getState().lifecycle.muted === true,
    null,
    { timeout: 10_000 },
  );
  const parentMuted = await waitForAudioGains(frame, [0, 0]);

  await page.locator("#unmute-game").click();
  await frame.waitForFunction(
    () => window.WinkBridge?.getState().lifecycle.muted === false,
    null,
    { timeout: 10_000 },
  );
  const restored = await waitForAudioGains(frame, [1, 0]);

  await page.locator("#resume-game").click();
  await frame.waitForFunction(
    () => window.WinkBridge?.getState().lifecycle.paused === false,
    null,
    { timeout: 10_000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  const resumed = await canvas.screenshot();
  const resumeAdvanced =
    sha256(resumed) !== sha256(pausedSecond);
  invariant(resumeAdvanced, "Pixi canvas did not advance after resume");

  return {
    pauseStable,
    resumeAdvanced,
    userPreference,
    parentMuted,
    restored,
  };
}

async function sliceUntilGameOver({ frame, page }) {
  const canvas = frame.locator("canvas").last();
  const box = await canvas.boundingBox();
  invariant(box, "Fruit game canvas has no browser bounds");

  const marginX = Math.max(8, box.width * 0.03);
  const marginY = Math.max(8, box.height * 0.04);
  await page.mouse.move(box.x + marginX, box.y + marginY);
  await page.mouse.down();
  try {
    const deadline = Date.now() + 30_000;
    let index = 0;
    while (Date.now() < deadline) {
      if (
        await frame
          .getByText("Tiếp tục?", { exact: true })
          .isVisible()
          .catch(() => false)
      ) {
        return;
      }
      const row = index % 11;
      const x =
        index % 2 === 0
          ? box.x + box.width - marginX
          : box.x + marginX;
      const y =
        box.y +
        marginY +
        (row / 10) * (box.height - marginY * 2);
      await page.mouse.move(x, y, { steps: 2 });
      await new Promise((resolve) => setTimeout(resolve, 22));
      index += 1;
    }
  } finally {
    await page.mouse.up();
  }
  throw new Error("Deterministic Fruit round did not reach game over");
}

async function playRound({
  expectedCompletionCount,
  fixture,
  frame,
  mode,
  page,
  verifyParentLifecycle = false,
}) {
  await frame.locator(".hero-play-button").click();
  const canvas = frame.locator("canvas").last();
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  await frame.locator(".countdownOverlay").waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await frame.locator(".countdownOverlay").waitFor({
    state: "detached",
    timeout: 10_000,
  });
  await waitForDeterministicGameSeed(
    frame,
    expectedCompletionCount,
  );

  const lifecycle = verifyParentLifecycle
    ? await verifyLifecycle({ frame, page })
    : null;
  await sliceUntilGameOver({ frame, page });

  await frame
    .getByRole("button", { name: "Không", exact: true })
    .click();
  const scoreElement = frame.locator(".scoreValue");
  await scoreElement.waitFor({ state: "visible" });
  const scoreText = (await scoreElement.textContent()) || "";
  const finalScore = Number(scoreText.replace(/[^\d]/g, ""));
  invariant(
    Number.isInteger(finalScore) && finalScore > 0,
    `${mode} round did not produce a qualifying final score`,
  );

  const completions = await waitUntil(
    async () => {
      const values = await readCompleteMessages(page);
      return values.length === expectedCompletionCount
        ? values
        : null;
    },
    `${mode} completion was not observed exactly once`,
  );
  const completion = completions.at(-1);
  invariant(
    ROUND_ID_PATTERN.test(completion.roundId),
    `${mode} completion roundId is invalid`,
  );

  const beforeEnd = fixture.getEvidence();
  invariant(
    beforeEnd.authenticatedScoreRequests === 0,
    "score was submitted before the final End Game boundary",
  );
  await frame
    .getByRole("button", {
      name: "Kết thúc game",
      exact: true,
    })
    .click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  frame = await waitForHero(frame, `${mode} final score exit`);

  return {
    frame,
    completion,
    finalScore,
    lifecycle,
  };
}

async function snapshotGameSurface(frame) {
  return frame.evaluate(() => {
    const storage = (source) =>
      Object.fromEntries(
        Array.from({ length: source.length }, (_, index) => {
          const key = source.key(index) || "";
          return [key, source.getItem(key)];
        }),
      );
    return {
      cookie: document.cookie,
      diagnostics: JSON.stringify(window.WinkBridge?.help() || null),
      dom: document.documentElement.outerHTML,
      href: window.location.href,
      localStorage: storage(window.localStorage),
      sessionStorage: storage(window.sessionStorage),
      state: JSON.stringify(
        window.WinkBridge?.getState() || null,
      ),
    };
  });
}

async function run() {
  invariant(
    Number(process.versions.node.split(".")[0]) === 22,
    "C4 requires Node 22",
  );
  const r2Template = path.resolve(
    process.env.WINK_R2_TEMPLATE_DIR || DEFAULT_R2_TEMPLATE,
  );
  const r2Root = path.resolve(r2Template, "..");
  const r2Commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: r2Root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  invariant(
    r2Commit === CERTIFIED_COMMIT,
    "R2 harness worktree is not at the certified commit",
  );

  const bridgeEvidence = await verifyWinkBridge({
    rootDir: ROOT,
    certifiedTemplateDir: r2Template,
  });
  const [distBridge, distConfigText, publicConfigText] =
    await Promise.all([
      fs.readFile(path.join(DIST_DIR, "wink-bridge.js")),
      fs.readFile(
        path.join(DIST_DIR, "wink-runtime-config.json"),
        "utf8",
      ),
      fs.readFile(
        path.join(ROOT, "public", "wink-runtime-config.json"),
        "utf8",
      ),
    ]);
  invariant(
    sha256(distBridge) === CERTIFIED_SHA256,
    "dist contains a non-certified bridge",
  );
  invariant(
    distConfigText === publicConfigText,
    "dist runtime config differs from the verified public config",
  );
  const runtimeConfig = JSON.parse(distConfigText);
  invariant(
    runtimeConfig.environment === "dev" &&
      runtimeConfig.gameId === GAME_ID &&
      runtimeConfig.protocolVersion === 1 &&
      runtimeConfig.bridgeVersion === "9.2.0" &&
      JSON.stringify(runtimeConfig.allowedParentOrigins) ===
        JSON.stringify([HARNESS_ORIGIN]),
    "dist runtime config is not the exact local C4 config",
  );

  let staticServer = null;
  let fixture = null;
  let harness = null;
  let browser = null;
  const browserConsole = [];
  const browserErrors = [];
  const browserUrls = [];
  try {
    staticServer = await createStaticDistServer({
      rootDir: DIST_DIR,
    });
    fixture = await createR1FixtureServer();
    const harnessModule = await import(
      pathToFileURL(path.join(r2Template, "dev-server.mjs")).href
    );
    harness = await harnessModule.createHarnessServer({
      host: "127.0.0.1",
      port: 8787,
      upstreamApiBase: fixture.apiBase,
      harnessOrigin: HARNESS_ORIGIN,
      devTestAuthSecret: fixture.devTestAuthSecret,
    });

    const health = await fetch(`${staticServer.url}/health`);
    invariant(
      health.status === 200 && (await health.text()) === "OK",
      "built game health endpoint failed",
    );
    const deepLink = await fetch(`${staticServer.url}/play/deep-link`);
    invariant(
      deepLink.status === 200 &&
        (await deepLink.text()).includes("/wink-bridge.js"),
      "built game SPA fallback failed",
    );

    const { chromium } = loadPlaywright(r2Root);
    browser = await chromium.launch({
      headless: process.env.C4_HEADED !== "true",
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(({ deterministicSeed }) => {
      const messages = [];
      Object.defineProperty(window, "__C4_MESSAGES__", {
        configurable: false,
        value: messages,
      });
      const unhandledRejections = [];
      Object.defineProperty(window, "__C4_UNHANDLED_REJECTIONS__", {
        configurable: false,
        value: unhandledRejections,
      });
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        unhandledRejections.push({
          code:
            reason && typeof reason.code === "string"
              ? reason.code
              : null,
          message:
            reason && typeof reason.message === "string"
              ? reason.message
              : String(reason),
        });
      });
      window.addEventListener(
        "message",
        (event) => {
          const data = event.data;
          if (
            !data ||
            typeof data !== "object" ||
            typeof data.type !== "string" ||
            !data.type.startsWith("wink:")
          ) {
            return;
          }
          messages.push({
            type: data.type,
            gameId:
              typeof data.gameId === "string"
                ? data.gameId
                : null,
            roundId:
              typeof data.payload?.roundId === "string"
                ? data.payload.roundId
                : null,
          });
        },
        true,
      );

      const gains = [];
      Object.defineProperty(window, "__C4_AUDIO_GAINS__", {
        configurable: false,
        value: gains,
      });
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass?.prototype?.createGain) {
        const originalCreateGain =
          AudioContextClass.prototype.createGain;
        AudioContextClass.prototype.createGain = function (...args) {
          const gain = originalCreateGain.apply(this, args);
          gains.push(gain);
          return gain;
        };
      }

      const gameSeeds = [];
      Object.defineProperty(window, "__C4_GAME_SEEDS__", {
        configurable: false,
        value: gameSeeds,
      });
      if (window.crypto?.getRandomValues) {
        const originalGetRandomValues =
          window.crypto.getRandomValues.bind(window.crypto);
        Object.defineProperty(window.crypto, "getRandomValues", {
          configurable: true,
          value(array) {
            if (
              array instanceof Uint32Array &&
              array.length === 1
            ) {
              array[0] = deterministicSeed;
              gameSeeds.push(deterministicSeed);
              return array;
            }
            return originalGetRandomValues(array);
          },
        });
      }
    }, { deterministicSeed: DETERMINISTIC_GAME_SEED });

    const attachDiagnostics = (page) => {
      page.on("console", (message) => {
        browserConsole.push(message.text());
      });
      page.on("pageerror", (error) => {
        browserErrors.push(error.message);
      });
      page.on("request", (request) => {
        browserUrls.push(request.url());
      });
    };

    const topLevel = await context.newPage();
    attachDiagnostics(topLevel);
    const directUrls = [];
    topLevel.on("request", (request) => {
      directUrls.push(request.url());
    });
    await topLevel.goto(GAME_ORIGIN, {
      waitUntil: "domcontentloaded",
    });
    await topLevel.waitForFunction(
      () =>
        window.WinkBridge?.getState().error?.code ===
        "PARENT_REQUIRED",
      null,
      { timeout: 10_000 },
    );
    await topLevel
      .locator(
        '.wink-integration-status[data-phase="error"]',
      )
      .waitFor({ state: "visible" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const topLevelState = await topLevel.evaluate(() =>
      window.WinkBridge.getState(),
    );
    invariant(
      topLevelState.error?.code === "PARENT_REQUIRED",
      "top-level game did not expose PARENT_REQUIRED",
    );
    invariant(
      directUrls.every(
        (url) =>
          !url.includes("wink-runtime-config.json") &&
          !url.includes("/api/v1/"),
      ),
      "top-level game made a Wink config/API request",
    );
    await topLevel.locator(".hero-leaderboard-button").waitFor({
      state: "visible",
      timeout: 20_000,
    });
    const topLevelUnhandledBefore = await topLevel.evaluate(
      () => window.__C4_UNHANDLED_REJECTIONS__.length,
    );
    await topLevel.locator(".hero-leaderboard-button").click();
    await topLevel.locator(".leaderboardScreen").waitFor({
      state: "visible",
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const topLevelUnhandledAfter = await topLevel.evaluate(
      () => window.__C4_UNHANDLED_REJECTIONS__.length,
    );
    invariant(
      topLevelUnhandledAfter === topLevelUnhandledBefore,
      "top-level negative UI path produced an unhandled rejection",
    );
    await topLevel.close();

    const page = await context.newPage();
    attachDiagnostics(page);
    await page.goto(HARNESS_ORIGIN, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Load game", exact: true })
      .click();
    await page.locator("#capabilities").waitFor({
      state: "visible",
    });
    await page
      .locator("#capabilities")
      .filter({ hasText: "leaderboard read: true" })
      .waitFor({ timeout: 15_000 });
    await page
      .locator("#capabilities")
      .filter({ hasText: "score submit: false" })
      .waitFor({ timeout: 15_000 });

    let frame = await waitUntil(
      () =>
        page
          .frames()
          .find((candidate) => candidate.url() === `${GAME_ORIGIN}/`) ||
        null,
      "R2 harness did not load the built Fruit frame",
    );
    await waitForBridgePhase(frame, "ready_anonymous");
    await waitForHero(frame, "initial anonymous landing");

    await exerciseLeaderboard({
      fixture,
      frame,
      mode: "anonymous",
    });
    const anonymousRound = await playRound({
      expectedCompletionCount: 1,
      fixture,
      frame,
      mode: "anonymous",
      page,
      verifyParentLifecycle: true,
    });
    frame = anonymousRound.frame;
    await frame
      .locator(".wink-integration-status")
      .filter({ hasText: "CAPABILITY_DENIED" })
      .waitFor({ state: "visible", timeout: 10_000 });
    const afterAnonymous = fixture.getEvidence();
    invariant(
      afterAnonymous.anonymousScoreRequests === 0 &&
        afterAnonymous.rows.length === 0,
      "anonymous score reached R1 or persisted a row",
    );

    await page
      .getByRole("button", {
        name: "Seeded user",
        exact: true,
      })
      .click();
    await page
      .locator("#capabilities")
      .filter({ hasText: "score submit: true" })
      .waitFor({ timeout: 15_000 });
    await waitForBridgePhase(frame, "ready_authenticated");

    await exerciseLeaderboard({
      fixture,
      frame,
      mode: "authenticated",
    });
    const authenticatedRound = await playRound({
      expectedCompletionCount: 2,
      fixture,
      frame,
      mode: "authenticated",
      page,
    });
    frame = authenticatedRound.frame;
    const afterAuthenticated = await waitUntil(
      () => {
        const evidence = fixture.getEvidence();
        return evidence.authenticatedScoreRequests === 1 &&
          evidence.rows.length === 1
          ? evidence
          : null;
      },
      "authenticated score did not persist exactly one R1 row",
    );
    invariant(
      afterAuthenticated.rows[0].roundId ===
        authenticatedRound.completion.roundId,
      "authenticated score and completion did not share roundId",
    );
    invariant(
      anonymousRound.completion.roundId !==
        authenticatedRound.completion.roundId,
      "new game reused the previous roundId",
    );
    invariant(
      (await readCompleteMessages(page)).length === 2,
      "completion was emitted more than once per round",
    );

    const anonymousId = await page.evaluate(() =>
      localStorage.getItem("wink_harness_anonymous_id"),
    );
    const gameSurface = await snapshotGameSurface(frame);
    const harnessLogs =
      (await page.locator("#logs").textContent()) || "";
    const observable = JSON.stringify({
      gameSurface,
      harnessLogs,
      browserConsole,
      messages: await page.evaluate(
        () => window.__C4_MESSAGES__ || [],
      ),
    });
    for (const secret of [
      ...fixture.getSecrets(),
      anonymousId,
    ].filter(Boolean)) {
      invariant(
        !observable.includes(secret),
        "credential or authority leaked into observable browser surfaces",
      );
    }
    invariant(
      Object.keys(gameSurface.localStorage).length === 0 &&
        Object.keys(gameSurface.sessionStorage).length === 0 &&
        gameSurface.cookie === "",
      "certified game wrote browser storage or cookies",
    );
    invariant(
      browserUrls.every(
        (url) =>
          !/[?&](?:token|secret|apiBase|anonymousId|refresh)=/i.test(
            url,
          ),
      ),
      "browser URL exposed credential-shaped query authority",
    );
    invariant(
      browserErrors.length === 0,
      `browser page errors: ${browserErrors.join("; ")}`,
    );

    const evidence = {
      toolchain: {
        node: process.version,
        npm: execFileSync("npm", ["--version"], {
          encoding: "utf8",
        }).trim(),
        packageLockSha256: sha256(
          await fs.readFile(path.join(ROOT, "package-lock.json")),
        ),
      },
      build: {
        distSha256: await digestTree(DIST_DIR),
        deterministicGameSeed: DETERMINISTIC_GAME_SEED,
        bridgeVersion: bridgeEvidence.bridgeVersion,
        protocolVersion: bridgeEvidence.protocolVersion,
        bridgeSha256: bridgeEvidence.sha256,
        r2HarnessCommit: r2Commit,
      },
      topLevel: {
        errorCode: "PARENT_REQUIRED",
        winkConfigOrApiRequests: directUrls.filter(
          (url) =>
            url.includes("wink-runtime-config.json") ||
            url.includes("/api/v1/"),
        ).length,
        unhandledRejections: 0,
      },
      anonymous: {
        phase: "ready_anonymous",
        leaderboardReads:
          afterAnonymous.anonymousLeaderboardReads,
        completions: 1,
        scoreResult: "CAPABILITY_DENIED",
        scoreRequests: afterAnonymous.anonymousScoreRequests,
        rowsWritten: 0,
        qualifyingScore: anonymousRound.finalScore,
      },
      authenticated: {
        phase: "ready_authenticated",
        identity: "seeded_non_guest",
        leaderboardReads:
          afterAuthenticated.authenticatedLeaderboardReads,
        completions: 1,
        scoreRequests:
          afterAuthenticated.authenticatedScoreRequests,
        rowsWritten: afterAuthenticated.rows.length,
        qualifyingScore: authenticatedRound.finalScore,
        completionAndScoreRoundIdMatch: true,
      },
      lifecycle: anonymousRound.lifecycle,
      security: {
        gameLocalStorageKeys: Object.keys(
          gameSurface.localStorage,
        ),
        gameSessionStorageKeys: Object.keys(
          gameSurface.sessionStorage,
        ),
        gameCookieBytes: gameSurface.cookie.length,
        observableAuthorityLeaks: 0,
        browserCredentialQueryLeaks: 0,
      },
    };
    console.log(JSON.stringify(evidence, null, 2));
    return evidence;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (harness) await harness.close().catch(() => {});
    if (fixture) await fixture.close().catch(() => {});
    if (staticServer) await staticServer.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "C4 certification failed",
  );
  process.exitCode = 1;
});
