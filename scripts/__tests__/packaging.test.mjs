import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function locationBlock(source, marker) {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n    }", start);
  return source.slice(start, end === -1 ? source.length : end);
}

describe("R4 static packaging boundary", () => {
  it("keeps test discovery inside the active checkout", () => {
    const packageJson = JSON.parse(read("package.json"));

    expect(packageJson.scripts.test).toBe(
      "vitest run --exclude '**/.worktrees/**'",
    );
    expect(packageJson.scripts["test:watch"]).toBe(
      "vitest --exclude '**/.worktrees/**'",
    );
  });

  it("publishes a verifier-ready Wink integration manifest", () => {
    const manifest = JSON.parse(read("wink-integration.json"));

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      game: {
        id: '36348ccc-1f37-4eca-ad1c-a8a47292ace7',
        slug: 'fruit-slashing',
        devOrigin: 'https://fruit-slashing.papastudio.net',
        localOrigin: 'http://127.0.0.1:5173',
      },
      wink: {
        environment: 'prod',
        protocolVersion: 1,
        bridgeVersion: '9.2.0',
        devParentOrigin: 'https://winkgames.papastudio.net',
        harnessOrigin: 'http://127.0.0.1:8787',
        devApiBase: 'https://api-winkgames.papastudio.net/api/v1',
      },
    });
    expect(manifest.files.adapters).toEqual([
      "src/integrations/wink/client.ts",
      "src/integrations/wink/useWinkIntegration.ts",
    ]);
  });

  it("builds with the pinned Node toolchain and ships only dist through nginx", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM node:22.11.0-alpine AS build");
    expect(dockerfile).toContain(
      "RUN npm install --global npm@11.3.0 && npm --version",
    );
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain(
      "COPY --from=build /app/dist/ /usr/share/nginx/html/",
    );
    expect(dockerfile).not.toMatch(/^COPY \. /m);
    expect(dockerfile).not.toMatch(/COPY .*\.env|COPY .*\.npmrc/);
    expect(dockerfile).not.toMatch(
      /test-harness|dev-server|DEV_TEST_AUTH_SECRET/,
    );
    expect(dockerfile).toContain(
      "wget --no-verbose --tries=1 --spider http://localhost/health",
    );
  });

  it("keeps credentials, harness tooling, tests, and local artifacts out of context", () => {
    const dockerignore = read(".dockerignore");

    for (const ignored of [
      ".env",
      ".env.*",
      ".git",
      ".npmrc",
      "node_modules",
      "dist",
      "coverage",
      "docs",
      "**/__tests__",
      "**/*.test.*",
      "*.pem",
      "*.key",
    ]) {
      expect(dockerignore).toContain(ignored);
    }
  });

  it("serves health and SPA fallback under one exact frame-ancestor policy", () => {
    const nginx = read("etc/default.conf.template");

    expect(nginx).toContain(
      'Content-Security-Policy "frame-ancestors ${ALLOWED_PARENT_ORIGINS}"',
    );
    expect(nginx).not.toMatch(/frame-ancestors\s+\*/);
    expect(nginx).not.toContain('Access-Control-Allow-Origin "*"');
    expect(nginx).not.toContain('X-Frame-Options "ALLOWALL"');
    expect(nginx).toContain("location = /health");
    expect(nginx).toContain('return 200 "OK"');
    expect(nginx).toContain("try_files $uri $uri/ /index.html");
    expect(nginx).not.toMatch(/proxy_pass|location\s+\/api/);

    for (const marker of [
      "location = /wink-runtime-config.json",
      "location = /wink-bridge.js",
      "location / {",
    ]) {
      const block = locationBlock(nginx, marker);
      expect(block).toContain(
        'add_header Content-Security-Policy "frame-ancestors ${ALLOWED_PARENT_ORIGINS}" always;',
      );
      expect(block).toContain(
        'add_header X-Content-Type-Options "nosniff" always;',
      );
      expect(block).toContain(
        'add_header Referrer-Policy "no-referrer" always;',
      );
    }
  });

  it("generates and verifies config before any image or deployment mutation", () => {
    const deploy = read("deploy.sh");
    const packageJson = JSON.parse(read("package.json"));

    const generateIndex = deploy.indexOf(
      "node scripts/generate-wink-runtime-config.mjs",
    );
    const verifyIndex = deploy.indexOf("npm run verify:wink-bridge");
    const buildIndex = deploy.indexOf("docker build");
    const deployIndex = deploy.indexOf("docker stack deploy");

    expect(generateIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(generateIndex);
    expect(buildIndex).toBeGreaterThan(verifyIndex);
    expect(deployIndex).toBeGreaterThan(buildIndex);
    expect(deploy).not.toMatch(
      /DEV_TEST_AUTH_SECRET|game-sessions\/anonymous|game-sessions\/refresh/,
    );
    expect(packageJson.scripts["generate:wink-config"]).toBe(
      "node scripts/generate-wink-runtime-config.mjs",
    );
    expect(packageJson.scripts["certify:c4"]).toBe(
      "node scripts/certify-wink-c4.mjs",
    );
    expect(packageJson.scripts["verify:docker-headers"]).toBe(
      "node scripts/verify-docker-headers.mjs",
    );
    for (const runner of [
      "scripts/sync-wink-bridge.mjs",
      "scripts/certify-wink-c4.mjs",
    ]) {
      expect(read(runner)).not.toMatch(/\/Users\/|[A-Za-z]:\\/);
    }
  });
});

describe("production canary image handoff", () => {
  it("renders a YAML-safe Traefik Host rule", () => {
    const deploy = read("deploy.sh");
    const ruleLine = deploy
      .split("\n")
      .find((line) => line.includes(".rule=Host("));

    expect(ruleLine).toBeTruthy();
    const rendered = execFileSync(
      "sh",
      [
        "-eu",
        "-c",
        [
          "ROUTER_NAME=winkgames-minigame-dev-fruit-slashing",
          "DOMAIN=dev-fruit-slashing.papastudio.net",
          ruleLine.trim(),
        ].join("\n"),
      ],
      { encoding: "utf8" },
    );

    expect(rendered).toBe(
      "      - 'traefik.http.routers.winkgames-minigame-dev-fruit-slashing.rule=Host(`dev-fruit-slashing.papastudio.net`)'\n",
    );
  });

  it("uses the dedicated production stack, origin, repository, and exact parents", () => {
    const config = read("game.config.sh");
    const runtimeConfig = JSON.parse(
      read("public/wink-runtime-config.json"),
    );

    expect(config).toContain('GAME_SLUG="bo-lac-fruit-slashing"');
    expect(config).toContain('ENVIRONMENT="prod"');
    expect(config).toContain(
      'ALLOWED_PARENT_ORIGINS="https://winkgames.papastudio.net http://localhost:3000"',
    );
    expect(config).toContain('DOMAIN="${GAME_SLUG}.papastudio.net"');
    expect(config).toContain(
      'STACK_NAME="papastudio-winkgames-games"',
    );
    expect(config).toContain('SERVICE_NAME="${GAME_SLUG}"');
    expect(config).toContain(
      'ROUTER_NAME="winkgames-minigame-prod-${GAME_SLUG}"',
    );
    expect(config).toContain('IMAGE_NAME="winkgames/prod/${GAME_SLUG}"');
    expect(config).not.toContain('STACK_NAME="papastudio-winkgames"');
    expect(config).not.toContain('STACK_NAME="papastudio-winkgames-dev"');
    expect(config).not.toContain('IMAGE_TAG="r4-local-only"');
    expect(config).not.toContain("latest");
    expect(runtimeConfig).toEqual({
      gameId: "36348ccc-1f37-4eca-ad1c-a8a47292ace7",
      environment: "prod",
      protocolVersion: 1,
      bridgeVersion: "9.2.0",
      allowedParentOrigins: [
        "https://winkgames.papastudio.net",
        "http://localhost:3000",
      ],
    });
  });

  it("derives an immutable image tag from clean HEAD and separates check, publish, deploy, and rollback modes", () => {
    const deploy = read("deploy.sh");

    expect(deploy).toContain('SOURCE_SHA="$(git rev-parse HEAD)"');
    expect(deploy).toContain('IMAGE_TAG="git-${SOURCE_SHA}"');
    expect(deploy).toContain('TAGGED_IMAGE="${IMAGE_REPOSITORY}:${IMAGE_TAG}"');
    expect(deploy).toContain('R5_GAME_IMAGE="${IMAGE_REPOSITORY}@${PUSH_DIGEST}"');
    expect(deploy).toContain('docker build --platform "${IMAGE_PLATFORM}"');
    expect(deploy).toContain("git diff --quiet");
    expect(deploy).toContain("git diff --cached --quiet");
    expect(deploy).toContain("docker manifest inspect");
    expect(deploy).toContain("R5_IMAGE_TAG_EXISTS");
    for (const mode of [
      "--check-only",
      "--build-push",
      "--deploy",
      "--rollback",
    ]) {
      expect(deploy).toContain(mode);
    }
    expect(deploy).not.toContain("r4-local-only");
    expect(deploy).not.toMatch(/(?:^|[/:])latest(?:$|[\s"'])/m);
  });

  it("runs config, checksum, tests, typecheck, build, and header gates before push or stack mutation", () => {
    const deploy = read("deploy.sh");
    const indexes = [
      deploy.indexOf("node scripts/generate-wink-runtime-config.mjs"),
      deploy.indexOf("npm run verify:wink-bridge"),
      deploy.indexOf("npm test"),
      deploy.indexOf("npm run typecheck"),
      deploy.indexOf("npm run build"),
      deploy.indexOf("npm run verify:docker-headers"),
    ];
    const buildIndex = deploy.indexOf("docker build");
    const pushIndex = deploy.indexOf("docker push");
    const deployIndex = deploy.indexOf("docker stack deploy");

    expect(indexes.every((index) => index > -1)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    expect(deploy).toContain(
      'WINK_DOCKER_ALLOWED_PARENT_ORIGINS="${ALLOWED_PARENT_ORIGINS}"',
    );
    expect(buildIndex).toBeGreaterThan(indexes.at(-1));
    expect(pushIndex).toBeGreaterThan(buildIndex);
    expect(deployIndex).toBeGreaterThan(indexes.at(-1));
    expect(deploy).toContain('image: ${R5_GAME_IMAGE}');
    expect(deploy).toContain('"${STACK_NAME}"');
    expect(deploy).toContain('traefik.http.routers.${ROUTER_NAME}');
    expect(deploy).toContain('CURRENT_IMAGE');
    expect(deploy).toContain('UPDATE_STATE');
    expect(deploy).toContain(
      '[ "${CURRENT_IMAGE}" = "${R5_GAME_IMAGE}" ]',
    );
    expect(deploy).toContain('[ "${UPDATE_STATE}" = "completed" ]');
    expect(deploy).not.toContain("docker service update");
    expect(deploy).not.toContain("docker system prune");
    expect(deploy).not.toContain("git pull");
    expect(deploy).not.toContain("papastudio-winkgames_fruit-slashing");
  });

  it("writes mode-0600 atomic rollback metadata with previous and digest-pinned next images", () => {
    const deploy = read("deploy.sh");
    const gitignore = read(".gitignore");

    expect(deploy).toContain("umask 077");
    expect(deploy).toContain("previousImage");
    expect(deploy).toContain("nextImage");
    expect(deploy).toContain("sourceSha");
    expect(deploy).toContain("action");
    expect(deploy).toContain("ROLLBACK_METADATA_TMP");
    expect(deploy).toContain("R5_ROLLBACK_METADATA_PATH_INVALID");
    expect(deploy).toContain("pwd -P");
    expect(deploy).toContain("(^|/)\\.\\.(/|$)|//");
    expect(deploy).toContain(
      'mv "${ROLLBACK_METADATA_TMP}" "${ROLLBACK_METADATA_PATH}"',
    );
    expect(deploy).toContain("sha256:[0-9a-f]{64}");
    expect(gitignore).toContain("artifacts/minigame-pilot/");
  });
});
