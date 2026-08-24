import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateWinkRuntimeConfig,
  writeWinkRuntimeConfig,
} from "../generate-wink-runtime-config.mjs";

const VALID = Object.freeze({
  gameId: "11111111-1111-4111-8111-111111111111",
  environment: "dev",
  protocolVersion: 1,
  bridgeVersion: "9.2.0",
  allowedParentOrigins: ["http://127.0.0.1:8787"],
});

describe("Wink runtime config generation", () => {
  it("generates the exact secret-free five-field dev contract", () => {
    const config = generateWinkRuntimeConfig(VALID);

    expect(config).toEqual(VALID);
    expect(Object.keys(config).sort()).toEqual(
      [
        "allowedParentOrigins",
        "bridgeVersion",
        "environment",
        "gameId",
        "protocolVersion",
      ].sort(),
    );
    expect(JSON.stringify(config)).not.toMatch(
      /apiBase|token|secret|anonymous|refresh|primary/i,
    );
  });

  it("locks prod to the exact production and localhost FE parents", () => {
    expect(
      generateWinkRuntimeConfig({
        ...VALID,
        environment: "prod",
        allowedParentOrigins: [
          "https://winkgames.papastudio.net",
          "http://localhost:3000",
        ],
      }),
    ).toMatchObject({
      environment: "prod",
      allowedParentOrigins: [
        "https://winkgames.papastudio.net",
        "http://localhost:3000",
      ],
    });

    for (const input of [
      { ...VALID, environment: "integration" },
      { ...VALID, allowedParentOrigins: ["*"] },
      { ...VALID, VITE_WINK_API_BASE: "https://api.example.test" },
      {
        ...VALID,
        environment: "prod",
        allowedParentOrigins: ["https://winkgames.papastudio.net"],
      },
      {
        ...VALID,
        environment: "prod",
        allowedParentOrigins: ["https://other.papastudio.net"],
      },
    ]) {
      expect(() => generateWinkRuntimeConfig(input)).toThrow();
    }
  });

  it("writes stable JSON with a final newline", async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "fruit-wink-config-"),
    );
    const outputPath = path.join(directory, "wink-runtime-config.json");

    await writeWinkRuntimeConfig(VALID, outputPath);

    const text = fs.readFileSync(outputPath, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(VALID);
  });
});
