import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("R4 static packaging boundary", () => {
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
  });
});
