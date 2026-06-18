import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  GAME_DURATION_MS,
  isValidInputLog,
  rankFor,
  replayGame,
  type InputSample,
} from "../../src/game/core";

initializeApp();
const db = getFirestore();
const REGION = "asia-southeast1";
const SESSION_GRACE_MS = 15_000;

interface StartGameResponse {
  sessionId: string;
  seed: number;
  startedAt: number;
  durationMs: number;
}

interface SubmitGameRequest {
  sessionId?: unknown;
  inputLog?: unknown;
}

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Đăng nhập để gửi điểm.");
  return auth.uid;
}

function callableOptions(consumeAppCheckToken = false) {
  return {
    region: REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken,
    timeoutSeconds: 30,
    memory: "256MiB" as const,
  };
}

export const startGame = onCall(callableOptions(), async (request): Promise<StartGameResponse> => {
  const uid = requireUid(request.auth);
  const sessionRef = db.collection("gameSessions").doc(uid);
  const now = Date.now();
  const sessionId = randomBytes(16).toString("hex");
  const seed = randomBytes(4).readUInt32LE(0) || 1;

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(sessionRef);
    const data = existing.data();
    if (data?.status === "active" && typeof data.createdAt === "number" && now - data.createdAt < 3000) {
      throw new HttpsError("resource-exhausted", "Bạn đã có một ván đang hoạt động.");
    }
    transaction.set(sessionRef, {
      uid,
      sessionId,
      seed,
      status: "active",
      startedAt: now,
      expiresAt: now + GAME_DURATION_MS + SESSION_GRACE_MS,
      createdAt: now,
    });
  });

  return { sessionId, seed, startedAt: now, durationMs: GAME_DURATION_MS };
});

export const submitGame = onCall(callableOptions(true), async (request) => {
  const uid = requireUid(request.auth);
  const data = request.data as SubmitGameRequest;
  if (typeof data?.sessionId !== "string" || !isValidInputLog(data.inputLog)) {
    throw new HttpsError("invalid-argument", "Replay không hợp lệ.");
  }

  const sessionRef = db.collection("gameSessions").doc(uid);
  const sessionSnapshot = await sessionRef.get();
  const session = sessionSnapshot.data();
  if (!session || session.sessionId !== data.sessionId || session.status !== "active") {
    throw new HttpsError("failed-precondition", "Session không tồn tại hoặc đã được gửi.");
  }

  const now = Date.now();
  if (now > session.expiresAt) throw new HttpsError("deadline-exceeded", "Session đã hết hạn.");
  const result = replayGame(session.seed, data.inputLog as InputSample[]);
  if (result.endReason === "timeout" && now < session.startedAt + GAME_DURATION_MS - 1000) {
    throw new HttpsError("failed-precondition", "Ván chơi chưa đủ thời lượng.");
  }

  const runRef = db.collection("runs").doc();
  const userRef = db.collection("users").doc(uid);
  const account = await getAuth().getUser(uid);
  const playerName = account.displayName || "Người chơi";
  const photoURL = account.photoURL || null;

  await db.runTransaction(async (transaction) => {
    const [freshSessionSnapshot, userSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(userRef),
    ]);
    const freshSession = freshSessionSnapshot.data();
    if (!freshSession || freshSession.sessionId !== data.sessionId || freshSession.status !== "active") {
      throw new HttpsError("already-exists", "Replay này đã được gửi.");
    }
    const user = userSnapshot.data();
    if (result.score > 0) {
      transaction.set(runRef, {
        uid,
        playerName,
        photoURL,
        score: result.score,
        playTimeSec: Math.round(result.tick / 60),
        verified: true,
        createdAt: now,
      });
    }
    transaction.set(userRef, {
      displayName: playerName,
      photoURL,
      bestScore: Math.max(typeof user?.bestScore === "number" ? user.bestScore : 0, result.score),
      totalGamesPlayed: (typeof user?.totalGamesPlayed === "number" ? user.totalGamesPlayed : 0) + 1,
      createdAt: user?.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
    transaction.update(sessionRef, { status: "submitted", submittedAt: now, runId: result.score > 0 ? runRef.id : null });
  });

  return { score: result.score, rank: rankFor(result.score), runId: result.score > 0 ? runRef.id : null };
});
