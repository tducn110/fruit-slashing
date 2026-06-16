import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  type DocumentData,
} from "firebase/firestore";

// ─── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// ─── Services ─────────────────────────────────────────────────────────────────
export const auth = getAuth(app);
// Force localStorage persistence — fixes Safari / storage-partitioned browser issues
setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Google Sign‑In: popup-first with 12s timeout → redirect fallback (Safari-safe) */
export async function loginWithGoogle(): Promise<User | undefined> {
  await auth.authStateReady();
  const provider = new GoogleAuthProvider();

  try {
    const result = await Promise.race([
      signInWithPopup(auth, provider),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("POPUP_TIMEOUT")), 12000),
      ),
    ]);
    return result.user;
  } catch (error: any) {
    const reason = error?.message || error?.code || "unknown";
    console.warn("Popup auth failed (" + reason + "), falling back to redirect...");
    await signInWithRedirect(auth, provider);
    return undefined; // redirect happens — execution stops here
  }
}

/** Email + Password Sign‑Up (sets displayName) */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred.user;
}

/** Email + Password Sign‑In */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
export interface ScoreRecord {
  uid: string;
  playerName: string;
  photoURL: string | null;
  score: number;
  playTimeSec: number;
  createdAt: number;
}

/** Save a game run to Firestore (runs collection). Also updates user best score. */
export async function saveRun(
  uid: string,
  playerName: string,
  photoURL: string | null,
  score: number,
  playTimeSec: number,
) {
  await addDoc(collection(db, "runs"), {
    uid,
    playerName,
    photoURL,
    score,
    playTimeSec,
    createdAt: Date.now(),
  });

  // Update user profile / best score
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() ? (snap.data() as DocumentData) : null;
  const currentBest = existing?.bestScore ?? 0;

  await setDoc(
    userRef,
    {
      displayName: playerName,
      photoURL: photoURL ?? existing?.photoURL ?? null,
      bestScore: score > currentBest ? score : currentBest,
      totalGamesPlayed: (existing?.totalGamesPlayed ?? 0) + 1,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    },
    { merge: true },
  );
}

/** Fetch top N scores for the leaderboard. */
export async function getLeaderboard(topN: number = 10): Promise<ScoreRecord[]> {
  const q = query(collection(db, "runs"), orderBy("score", "desc"), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ScoreRecord);
}

/** Fetch user stats (bestScore, totalGamesPlayed) from Firestore. */
export async function getUserStats(uid: string): Promise<{ bestScore: number; totalGamesPlayed: number }> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return { bestScore: 0, totalGamesPlayed: 0 };
  const data = snap.data() as DocumentData;
  return {
    bestScore: (data.bestScore as number) ?? 0,
    totalGamesPlayed: (data.totalGamesPlayed as number) ?? 0,
  };
}
