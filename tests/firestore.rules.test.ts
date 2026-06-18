import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-chem-lac",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => environment.clearFirestore());
afterAll(async () => environment.cleanup());

describe("Firestore production rules", () => {
  it("allows public leaderboard reads", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, "runs", "verified-run")));
  });

  it("denies direct run writes for guests and authenticated users", async () => {
    const guest = environment.unauthenticatedContext().firestore();
    const player = environment.authenticatedContext("player-1").firestore();
    await assertFails(setDoc(doc(guest, "runs", "fake"), { score: 999999 }));
    await assertFails(setDoc(doc(player, "runs", "fake"), { uid: "player-1", score: 999999 }));
  });

  it("only allows owners to read user statistics", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "player-1"), { bestScore: 100 });
    });
    const owner = environment.authenticatedContext("player-1").firestore();
    const other = environment.authenticatedContext("player-2").firestore();
    await assertSucceeds(getDoc(doc(owner, "users", "player-1")));
    await assertFails(getDoc(doc(other, "users", "player-1")));
  });
});
