import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const GAME_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const GAME_ORIGIN = "http://127.0.0.1:5173";
const HARNESS_ORIGIN = "http://127.0.0.1:8787";
const BRIDGE_VERSION = "9.1.0";
const PROTOCOL_VERSION = 1;
const MAX_BODY_BYTES = 64 * 1024;

const MIME = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function jsonResponse(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

function success(data) {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("request body too large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function randomSecret(label) {
  return `${label}-${crypto.randomBytes(32).toString("base64url")}`;
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (origin !== GAME_ORIGIN && origin !== HARNESS_ORIGIN) {
    return {};
  }
  return {
    "Access-Control-Allow-Headers":
      "Accept, Authorization, Content-Type, X-Wink-Dev-Auth",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

function exactSessionRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const keys = Object.keys(value).sort();
  const common = [
    "bridgeVersion",
    "gameId",
    "gameOrigin",
    "protocolVersion",
  ];
  const anonymousKeys = [...common, "anonymousId"].sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(common.sort()) &&
    JSON.stringify(keys) !== JSON.stringify(anonymousKeys)
  ) {
    return null;
  }
  if (
    value.gameId !== GAME_ID ||
    value.gameOrigin !== GAME_ORIGIN ||
    value.bridgeVersion !== BRIDGE_VERSION ||
    value.protocolVersion !== PROTOCOL_VERSION
  ) {
    return null;
  }
  return value;
}

export async function createR1FixtureServer({
  host = "127.0.0.1",
  port = 0,
} = {}) {
  const primaryToken = randomSecret("primary");
  const anonymousToken = randomSecret("scoped-anonymous");
  const userToken = randomSecret("scoped-user");
  const devTestAuthSecret = randomSecret("dev-auth");
  const rows = [];
  const counters = {
    anonymousLeaderboardReads: 0,
    anonymousScoreRequests: 0,
    authenticatedLeaderboardReads: 0,
    authenticatedScoreRequests: 0,
    authenticatedSessions: 0,
    anonymousSessions: 0,
    devAuthRequests: 0,
  };
  const redactedRequests = [];
  let apiBase = null;

  function identify(req) {
    const authorization = req.headers.authorization;
    if (authorization === `Bearer ${anonymousToken}`) return "anonymous";
    if (authorization === `Bearer ${userToken}`) return "authenticated";
    return null;
  }

  function record(req, mode = null) {
    redactedRequests.push({
      method: req.method,
      path: new URL(req.url || "/", "http://fixture").pathname,
      mode,
    });
  }

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://fixture");
    const headers = corsHeaders(req);
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, headers);
        res.end();
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        record(req);
        jsonResponse(
          res,
          200,
          { status: "ok", environment: "dev", nodeEnvironment: "test" },
          headers,
        );
        return;
      }

      if (
        req.method === "POST" &&
        requestUrl.pathname === "/api/v1/dev/test-auth/token"
      ) {
        record(req, "authenticated");
        counters.devAuthRequests += 1;
        if (req.headers["x-wink-dev-auth"] !== devTestAuthSecret) {
          jsonResponse(
            res,
            403,
            {
              success: false,
              error: {
                code: "DEV_TEST_AUTH_DENIED",
                message: "Development authentication denied",
              },
            },
            headers,
          );
          return;
        }
        jsonResponse(
          res,
          200,
          success({
            accessToken: primaryToken,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            user: {
              id: USER_ID,
              displayName: "Winkgames Pilot User",
              avatarUrl: null,
              isGuest: false,
              role: "USER",
            },
          }),
          headers,
        );
        return;
      }

      if (
        req.method === "POST" &&
        requestUrl.pathname === "/api/v1/game-sessions/iframe"
      ) {
        const body = exactSessionRequest(await readJson(req));
        if (!body) {
          jsonResponse(
            res,
            400,
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Game session request is invalid",
              },
            },
            headers,
          );
          return;
        }
        const authenticated =
          req.headers.authorization === `Bearer ${primaryToken}`;
        const anonymous =
          !req.headers.authorization &&
          typeof body.anonymousId === "string";
        const mode = authenticated
          ? "authenticated"
          : anonymous
            ? "anonymous"
            : null;
        record(req, mode);
        if (!mode) {
          jsonResponse(
            res,
            401,
            {
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Game session identity is invalid",
              },
            },
            headers,
          );
          return;
        }

        counters[
          mode === "anonymous"
            ? "anonymousSessions"
            : "authenticatedSessions"
        ] += 1;
        const canSubmit = mode === "authenticated";
        jsonResponse(
          res,
          201,
          success({
            accessToken: canSubmit ? userToken : anonymousToken,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            sessionId:
              mode === "anonymous"
                ? "33333333-3333-4333-8333-333333333331"
                : "33333333-3333-4333-8333-333333333333",
            gameId: GAME_ID,
            gameOrigin: GAME_ORIGIN,
            scopes: canSubmit
              ? ["leaderboard:read", "leaderboard:write"]
              : ["leaderboard:read"],
            capabilities: {
              getLeaderboard: true,
              submitScore: canSubmit,
              complete: true,
            },
            identity: canSubmit
              ? {
                  type: "user",
                  user: {
                    id: USER_ID,
                    displayName: "Winkgames Pilot User",
                    avatarUrl: null,
                    isGuest: false,
                  },
                }
              : { type: "anonymous" },
            apiBase,
            environment: "dev",
            protocolVersion: PROTOCOL_VERSION,
          }),
          headers,
        );
        return;
      }

      if (
        requestUrl.pathname ===
        `/api/v1/games/${GAME_ID}/leaderboard`
      ) {
        const mode = identify(req);
        record(req, mode);
        if (!mode) {
          jsonResponse(
            res,
            401,
            {
              success: false,
              error: {
                code: "SESSION_EXPIRED",
                message: "Scoped game session is unavailable",
              },
            },
            headers,
          );
          return;
        }

        if (req.method === "GET") {
          counters[
            mode === "anonymous"
              ? "anonymousLeaderboardReads"
              : "authenticatedLeaderboardReads"
          ] += 1;
          const entries = rows
            .slice()
            .sort((left, right) => right.score - left.score)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));
          jsonResponse(
            res,
            200,
            success({ entries, total: entries.length }),
            headers,
          );
          return;
        }

        if (req.method === "POST") {
          counters[
            mode === "anonymous"
              ? "anonymousScoreRequests"
              : "authenticatedScoreRequests"
          ] += 1;
          if (mode === "anonymous") {
            jsonResponse(
              res,
              403,
              {
                success: false,
                error: {
                  code: "CAPABILITY_DENIED",
                  message: "Capability is not available",
                },
              },
              headers,
            );
            return;
          }
          const body = await readJson(req);
          if (
            !Number.isInteger(body.score) ||
            body.score <= 0 ||
            !body.metadata ||
            typeof body.metadata.roundId !== "string"
          ) {
            jsonResponse(
              res,
              400,
              {
                success: false,
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Score input is invalid",
                },
              },
              headers,
            );
            return;
          }
          const timestamp = new Date().toISOString();
          const entry = {
            id: String(rows.length + 1),
            userId: USER_ID,
            isAnonymous: false,
            displayName: "Winkgames Pilot User",
            score: body.score,
            playTime:
              Number.isInteger(body.playTime) ? body.playTime : null,
            gameMode:
              typeof body.gameMode === "string" ? body.gameMode : null,
            counter:
              Number.isInteger(body.counter) ? body.counter : null,
            metadata: body.metadata,
            rank: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          rows.push(entry);
          jsonResponse(
            res,
            201,
            success({
              entry,
              isNewBest: true,
              previousBest: null,
            }),
            headers,
          );
          return;
        }
      }

      record(req);
      jsonResponse(
        res,
        404,
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Route not found" },
        },
        headers,
      );
    } catch {
      jsonResponse(
        res,
        500,
        {
          success: false,
          error: {
            code: "FIXTURE_ERROR",
            message: "R1 fixture request failed",
          },
        },
        headers,
      );
    }
  });

  await listen(server, host, port);
  const address = server.address();
  if (!address || typeof address === "string") {
    await close(server);
    throw new Error("R1 fixture address is unavailable");
  }
  const url = `http://${host}:${address.port}`;
  apiBase = `${url}/api/v1`;

  return Object.freeze({
    url,
    apiBase,
    devTestAuthSecret,
    close: () => close(server),
    getEvidence: () => ({
      ...counters,
      rows: rows.map((row) => ({
        score: row.score,
        playTime: row.playTime,
        roundId: row.metadata.roundId,
        userId: row.userId,
      })),
      requests: redactedRequests.map((request) => ({ ...request })),
    }),
    getSecrets: () => [
      primaryToken,
      anonymousToken,
      userToken,
      devTestAuthSecret,
      apiBase,
    ],
  });
}

function resolveStaticPath(rootDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const requested = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(rootDir, `.${requested}`);
  if (
    resolved !== rootDir &&
    !resolved.startsWith(`${rootDir}${path.sep}`)
  ) {
    return null;
  }
  return resolved;
}

export async function createStaticDistServer({
  rootDir,
  host = "127.0.0.1",
  port = 5173,
  allowedParentOrigin = HARNESS_ORIGIN,
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const indexPath = path.join(resolvedRoot, "index.html");
  await fs.access(indexPath);

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://game");
    if (
      req.method === "GET" &&
      requestUrl.pathname === "/health"
    ) {
      res.writeHead(200, {
        "Content-Security-Policy":
          `frame-ancestors ${allowedParentOrigin}`,
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("OK");
      return;
    }
    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405);
      res.end();
      return;
    }

    let filePath = resolveStaticPath(
      resolvedRoot,
      requestUrl.pathname,
    );
    if (!filePath) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      if (!path.extname(requestUrl.pathname)) {
        filePath = indexPath;
      }
    }

    try {
      const body = await fs.readFile(filePath);
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Security-Policy":
          `frame-ancestors ${allowedParentOrigin}`,
        "Content-Type":
          MIME[path.extname(filePath).toLowerCase()] ||
          "application/octet-stream",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(body);
      }
    } catch {
      res.writeHead(404);
      res.end();
    }
  });

  await listen(server, host, port);
  return Object.freeze({
    url: `http://${host}:${port}`,
    close: () => close(server),
  });
}
