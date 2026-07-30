#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRuntimeConfig } from "./verify-wink-bridge.mjs";

const PILOT_PRODUCTION_PARENT = "https://winkgames.papastudio.net";
const SECRET_SHAPE =
  /(?:TOKEN|SECRET|API_BASE|ANONYMOUS|PRIMARY|REFRESH)/i;

function containsSecretShape(value) {
  if (typeof value === "string") return SECRET_SHAPE.test(value);
  if (Array.isArray(value)) return value.some(containsSecretShape);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, child]) =>
        SECRET_SHAPE.test(key) || containsSecretShape(child),
    );
  }
  return false;
}

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(
    hostname,
  );
}

export function generateWinkRuntimeConfig(input) {
  if (containsSecretShape(input)) {
    throw new Error("Wink runtime config cannot contain authority");
  }
  assertRuntimeConfig(input);

  if (input.environment === "prod") {
    if (
      input.allowedParentOrigins.length !== 1 ||
      input.allowedParentOrigins[0] !== PILOT_PRODUCTION_PARENT
    ) {
      throw new Error(
        "Production Wink runtime config requires the exact pilot parent",
      );
    }
  } else {
    for (const origin of input.allowedParentOrigins) {
      const url = new URL(origin);
      if (url.protocol !== "https:" && !isLoopback(url.hostname)) {
        throw new Error(
          "Development parents require HTTPS or exact loopback HTTP",
        );
      }
    }
  }

  return Object.freeze({
    gameId: input.gameId,
    environment: input.environment,
    protocolVersion: input.protocolVersion,
    bridgeVersion: input.bridgeVersion,
    allowedParentOrigins: Object.freeze([
      ...input.allowedParentOrigins,
    ]),
  });
}

export async function writeWinkRuntimeConfig(input, outputPath) {
  if (
    typeof outputPath !== "string" ||
    outputPath.length === 0 ||
    SECRET_SHAPE.test(outputPath)
  ) {
    throw new Error("Wink runtime config output path is invalid");
  }
  const config = generateWinkRuntimeConfig(input);
  await fs.writeFile(
    outputPath,
    `${JSON.stringify(config, null, 2)}\n`,
  );
  return config;
}

async function runCli() {
  const outputPath = path.resolve(
    process.cwd(),
    process.env.OUTPUT_PATH ||
      "public/wink-runtime-config.json",
  );
  const config = await writeWinkRuntimeConfig(
    {
      gameId: process.env.GAME_ID,
      environment: process.env.ENVIRONMENT,
      protocolVersion: Number(process.env.PROTOCOL_VERSION),
      bridgeVersion: process.env.BRIDGE_VERSION,
      allowedParentOrigins: (
        process.env.ALLOWED_PARENT_ORIGINS || ""
      )
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    },
    outputPath,
  );
  console.log(
    `wink runtime config generated environment=${config.environment} protocol=${config.protocolVersion} output=${outputPath}`,
  );
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Wink runtime config generation failed",
    );
    process.exitCode = 1;
  });
}
