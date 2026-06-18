import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { rankFor } from "../../src/game/core";

initializeApp();
const db = getFirestore();
const REGION = "asia-southeast1";

interface SubmitScoreRequest {
  score?: unknown;
}

function requireUid(auth: { uid: string } | undefined): string {
  if (!auth) throw new HttpsError("unauthenticated", "Đăng nhập để gửi điểm.");
  return auth.uid;
}

function callableOptions() {
  return {
    region: REGION,
    timeoutSeconds: 15,
    memory: "256MiB" as const,
  };
}

export const submitScore = onCall(callableOptions(), async (request) => {
  const uid = requireUid(request.auth);
  const data = request.data as SubmitScoreRequest;
  const rawScore = data?.score;
  if (typeof rawScore !== "number" || !Number.isInteger(rawScore) || rawScore < 0) {
    throw new HttpsError("invalid-argument", "Điểm không hợp lệ.");
  }

  const score = Math.min(rawScore, 9999);
  const now = Date.now();
  const userRef = db.collection("users").doc(uid);
  const runRef = db.collection("runs").doc();
  const account = await getAuth().getUser(uid);
  const playerName = account.displayName || account.email || "Người chơi";
  const photoURL = account.photoURL || null;

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const user = userSnapshot.data();

    if (score > 0) {
      transaction.set(runRef, {
        uid,
        playerName,
        photoURL,
        score,
        playTimeSec: 180,
        verified: false,
        createdAt: now,
      });
    }

    transaction.set(userRef, {
      displayName: playerName,
      photoURL,
      bestScore: Math.max(typeof user?.bestScore === "number" ? user.bestScore : 0, score),
      totalGamesPlayed: (typeof user?.totalGamesPlayed === "number" ? user.totalGamesPlayed : 0) + 1,
      createdAt: user?.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
  });

  return { score, rank: rankFor(score), runId: score > 0 ? runRef.id : null };
});
