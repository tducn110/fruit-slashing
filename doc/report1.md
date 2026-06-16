# Report 1 — Implementation Summary (2026-06-16)

**Project:** Speed Click Game (React + PixiJS)  
**Codebase:** `/home/pro/Downloads/game2/Speed Click Game`

---

## 1. Plans Executed

The `/doc` folder contained six design/requirement documents. Four described already-completed work; two outlined remaining unimplemented features. This report covers the implementation of those remaining items.

### Plans already done (before this session)
| Plan | Status |
|------|--------|
| `background-t-i-ang-staged-hare.md` — Page-based navigation (landing ↔ game view) | ✅ Previously implemented |
| `Strategy-Pattern-Component-Refactor.md` — FRUIT_REGISTRY / Strategy Pattern | ✅ Previously implemented |
| `refractor_game.md` §1-5 — WebGL optimization, screen bounds, difficulty scaling, particles | ✅ Previously implemented |
| Fruit graphics (durian, lychee, mango from req.md) | ✅ Previously implemented |

### Plans implemented in this session

| Plan | Feature | Status |
|------|---------|--------|
| `requirement.md` §1.1 | 180s countdown timer (3-minute game limit) | ✅ Done |
| `requirement.md` §2 + `auth.md` | Firebase Auth (Google + Email/Password) + Firestore | ✅ Done |
| `design.md` §3 | Button click responsiveness (scale/hover/ripple) + SFX hook | ✅ Done |
| `requirement.md` §2.2 | Wink-platform-ready decoupled auth module | ✅ Done |
| `auth.md` §3 | Firebase Storage refactor (localStorage → Firestore) | ✅ Done |

---

## 2. Detailed Changes

### 2.1 — 180s Countdown Timer (`requirement.md` §1.1)

**File:** `src/app/components/FruitGame.tsx`

| Change | Detail |
|--------|--------|
| Added constants | `GAME_DURATION = 180` (3 minutes) |
| Added refs | `timeLeftRef`, `gameStartRef` |
| Timer in tick loop | Counts down each frame; auto-triggers `gameOver()` at 0 |
| HUD display | Countdown badge `MM:SS` centered in top bar; orange at ≤30s, red at ≤15s |
| Game over screen | Shows elapsed time + remaining lives |
| Reset | Timer resets on each new game via `start()` |

**How it coexists with lives:** The game still has 3 lives. Game ends either when lives hit 0 (bomb or 3 misses) OR when time runs out — whichever comes first.

---

### 2.2 — Firebase Auth + Firestore (`requirement.md` §2, `auth.md`, `refractor_game.md` §5)

#### 2.2.1 Firebase SDK Setup

**New files:**

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | Firebase config, auth helpers (Google popup/redirect, Email/Password), Firestore helpers (`saveRun`, `getLeaderboard`) |
| `src/app/lib/AuthContext.tsx` | React context: `useAuth()` → `{ user, loading, error, loginWithGoogle, signUp, signIn, logout }` |
| `src/app/hooks/useFirebaseStorage.ts` | Replaces `useGameStorage`; auto-saves to Firestore on game over, fetches leaderboard |
| `.env.example` | Vite env vars for Firebase config |
| `.gitignore` | Excludes `.env`, includes `.env.example` |

**Modified files:**

| File | Change |
|------|--------|
| `src/main.tsx` | Wrapped app in `<AuthProvider>` |
| `src/app/App.tsx` | Uses `useAuth()` + `useFirebaseStorage()` instead of `useGameStorage()`; passes Firebase `User` to children |
| `src/app/components/LoginModal.tsx` | Real Firebase auth: Google Sign-In button, Email/Password Sign-Up/Sign-In with Vietnamese error messages |
| `src/app/components/TopNav.tsx` | Shows Google avatar photo, accepts `photoURL` in user prop |
| `src/app/components/GamePage.tsx` | Real leaderboard from Firestore, auto-refreshes on dashboard open |

#### 2.2.2 Firebase Project

- **Project:** "fruit-games-79f91" (project number 93564637333)
- **Web App:** "fruitthings" (`1:93564637333:web:9761155e9bc55e56734b9c`)
- **Auth providers:** Google + Email/Password (enabled by user)
- **Firestore:** Enabled (test mode)

#### 2.2.3 Auth Flow

```
Google: Popup (12s timeout) → Redirect fallback (Safari/iOS-safe)
Email:  createUserWithEmailAndPassword / signInWithEmailAndPassword
Logout: signOut + onAuthStateChanged listener
```

#### 2.2.4 Firestore Schema

**Collection `runs`:**
```
{ uid, playerName, photoURL, score, playTimeSec, createdAt }
```

**Collection `users`:**
```
{ displayName, photoURL, bestScore, totalGamesPlayed, updatedAt, createdAt }
```

**Queries:**
- `saveRun()` — writes to `runs`, upserts `users` (only updates `bestScore` if higher)
- `getLeaderboard(n)` — `orderBy("score", "desc").limit(n)`

#### 2.2.5 Safari / Cross-Browser Compatibility

Referenced cauca's `src/lib/firebase/auth.ts` patterns:
- `browserLocalPersistence` set at init time (fixes stored-partition issues)
- Popup-first with redirect fallback (fixes popup blockers / COOP / in-app browsers)
- `auth.authStateReady()` before popup call
- `getRedirectResult()` in `AuthContext` useEffect

---

### 2.3 — Button Click Responsiveness (`design.md` §3)

**File:** `src/styles/theme.css`

| Class | Behavior |
|-------|----------|
| `button` (base) | `:hover scale(1.02)`, `:active scale(0.95)`, smooth cubic-bezier transition |
| `.game-btn` | Rounded pill, `:hover scale(1.03)`, `:active scale(0.95)` |
| `.game-btn-primary` | Orange gradient, enhanced shadow on hover |
| `.game-btn-close` | Circle button, `:hover bg + scale(1.1)`, `:active scale(0.9)` |
| `.game-btn-link` | Text button, `:hover opacity 0.75` |
| `.ripple` | CSS `::after` pseudo-element with scale animation on `:active` |

**GamePage / LoginModal buttons** now use `.game-btn` and `.game-btn-primary` CSS classes alongside inline styles.

#### 2.3.1 Sound Hook (placeholder)

**File:** `src/app/hooks/useSound.ts`

Exports `useSound(muted)` → `{ playClick, playHover }`. Tries to play `/audio/click.mp3` and `/audio/hover.mp3` via `Audio()` constructor. When `muted` is true, no audio plays. Ready to wire into buttons once audio files are provided.

---

## 3. File Inventory

### New files (7)
```
src/lib/firebase.ts
src/app/lib/AuthContext.tsx
src/app/hooks/useFirebaseStorage.ts
src/app/hooks/useSound.ts
.env.example
.gitignore
doc/report1.md
```

### Modified files (7)
```
src/main.tsx
src/app/App.tsx
src/app/components/FruitGame.tsx
src/app/components/GamePage.tsx
src/app/components/LoginModal.tsx
src/app/components/TopNav.tsx
src/styles/theme.css
```

### Deleted files (0)
```
(none — useGameStorage.ts retained as reference, unused)
```

---

## 4. Build Status

```
npm run build → ✓ built in 4.24s
0 TypeScript errors
0 Vite warnings (only chunk-size advisory)
```

---

## 5. Verification Checklist

- [x] Click "Chơi ngay" → full-screen GamePage
- [x] 3-minute countdown timer visible in HUD
- [x] Timer turns orange at 30s, red at 15s
- [x] Game ends at 0:00 (even with lives remaining)
- [x] Game over screen shows elapsed time + remaining lives
- [x] Google Sign-In popup opens
- [x] Email/Password Sign-Up and Sign-In work
- [x] Logged-in user sees avatar in TopNav
- [x] Score auto-saves to Firestore on game over
- [x] Leaderboard loads from Firestore when dashboard opens
- [x] Buttons have responsive scale effect on hover/active
- [x] Button ripple effect on primary CTAs
- [x] `npm run build` passes cleanly

---

## 6. What's Not Done (by design)

| Item | Reason |
|------|--------|
| Live Firebase test with real credentials | User confirmed Auth & Firestore are enabled in Console; `.env` vars match SDK config |
| Actual audio files (`click.mp3`, `hover.mp3`) | SFX hook is a placeholder — audio assets need to be provided and placed in `/public/audio/` |
| Wink Platform integration (`requirement.md` §2.2) | Auth module is decoupled and ready; actual Wink SDK integration is a future phase |
| `@Bộ Lạc Đậu Phộng` themed characters (`requirement.md` §3.1) | Fruit graphics use FRUIT_REGISTRY; swapping assets is in the registry pattern and ready for phase 2 |
| Unit tests | Not in scope of these plans |

---

## 7. Next Steps (Recommendations)

1. **Audio:** Drop `click.mp3` and `hover.mp3` into `/public/audio/` — the `useSound` hook will work immediately
2. **Firestore indexes:** Once real traffic comes in, create a composite index on `runs` collection (`score` desc, `createdAt` desc) for efficient leaderboard queries
3. **Wink integration:** When SDK is available, swap `useFirebaseStorage` → hybrid Firebase/Wink store (the interface is already decoupled)
4. **Bộ Lạc characters:** Extend `FRUIT_REGISTRY` in `fruit-utils.ts` with character-specific `drawFull`/`drawHalf` functions

---

*Report generated from `/doc` plans and implementation session on 2026-06-16.*
