# AD-0 — Continue / Rewarded Ad Planning

> **Phase**: AD-0 — Planning only  
> **Status**: Draft ver1  
> **Date**: 2026-06-19  
> **Author**: Senior React/PixiJS/Firebase game architect  
> **Scope**: Plan document — NO CODE CHANGES

---

## 1. Executive summary

### What is this feature?

A **Continue-after-Game-Over** flow that inserts an intermediate decision screen between the terminal game condition (lives = 0 or time = 0) and the final Game Over result screen. The player can choose to watch a rewarded ad (or simulated ad in dev) to resume playing, or end the game immediately.

### Why is it needed?

Currently, when the game ends (timeout or lives depleted), the flow jumps straight to the Game Over overlay with the final score. This is a missed monetization opportunity and a common player retention mechanic in casual mobile-style games. Offering a single continue:

- Increases average session length and engagement
- Creates a natural ad placement that feels fair (player-initiated, reward-based)
- Does not feel forced — player always has the "End Game" option

### Ver1 scope

- State machine for continue offer / decision / resume
- Simulated ad provider (no real SDK)
- One continue per run
- Continue benefit: +15 seconds if timeout, +1 life if lives depleted
- Score preserved, combo reset
- No Firestore schema change
- ContinueOfferOverlay UI component

### What is NOT in ver1

- Real ad SDK integration (Google AdMob, Unity Ads, etc.)
- Multiple continues per run
- Firestore metadata fields for `continued` / `continueCount`
- Leaderboard differentiation between continued and non-continued runs
- Server-side validation of continue events
- A/B testing of continue reward amounts

---

## 2. Current game-over flow

Based on actual code analysis of the repository.

### 2.1 Terminal condition detection

**In `src/game/core.ts`:**

Two terminal conditions exist in the pure game state:

1. **Timeout** — [`core.ts:204-207`](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/game/core.ts#L204-L207):
   ```ts
   if (state.tick >= DURATION_TICKS) {
     state.ended = true;
     state.endReason = "timeout";
     return;
   }
   ```
   Game duration is `GAME_DURATION_MS = 180_000` (3 minutes).

2. **Lives depleted** — [`core.ts:345-348`](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/game/core.ts#L344-L348):
   ```ts
   state.lives -= 1;
   // ...
   if (state.lives <= 0) state.ended = true;
   if (state.lives <= 0) state.endReason = "lives";
   ```
   Player starts with 3 lives. Slicing a bomb costs 1 life.

### 2.2 Game-over propagation chain

```
core.ts: state.ended = true
    ↓
useGameTicker.ts: detects state.ended && !gameOverHandledRef (line 93)
    → constructs GameResult { score, playTimeSec, endReason }
    → calls finishGame(result) (line 101)
    ↓
useGameSession.ts: finishGame() (line 38)
    → guards with submittedRef.current (prevents double-submit)
    → sets submittedRef.current = true
    → sets playingRef.current = false
    → sets running = false
    → sets finalScore = result.score
    → calls onGameOver?.(result)
    ↓
FruitGame.tsx: onGameOver prop (line 64)
    → passed to useGameSession, which calls it in finishGame
    ↓
GamePage.tsx: handleGameOver (line 53)
    → calls onGameOver(result) — which is useScoreData's handleGameOver
    → sets panel = "dashboard" (auto-opens leaderboard)
    ↓
useScoreData.ts: handleGameOver (line 60)
    → sets lastScore
    → validates score
    → saves to Firebase (remote) or localStorage (fallback)
    → updates bestScore, totalGamesPlayed, leaderboard
```

### 2.3 Game Over UI rendering

**In `FruitGame.tsx` (line 224-229):**
```tsx
<GameOverOverlay
  finalScore={finalScore}
  running={running}
  countdown={countdown}
  onReplay={session.resetSession}
/>
```

**In `GameOverOverlay.tsx` (line 14):**
```tsx
if (running || countdown !== null || finalScore === null) return null;
```

The overlay only renders when:
- Game is NOT running
- No countdown active
- `finalScore` is NOT null (set by `finishGame`)

### 2.4 Double-submit guard

`submittedRef` in `useGameSession.ts:17` prevents `finishGame()` from being called twice in the same session. It resets on `startSession()` (line 27).

### 2.5 Score submission timing

Score is submitted **immediately** when `finishGame()` fires — `onGameOver` callback reaches `useScoreData.handleGameOver` which writes to Firebase in the same event loop iteration (async, but initiated immediately).

> [!IMPORTANT]
> **This is the critical point for the continue feature.** If the continue offer happens AFTER `finishGame()` has been called, the score has already been submitted. The continue flow MUST intercept BEFORE `finishGame()` is called.

### 2.6 Flow diagram (current)

```
┌─────────┐
│ RUNNING │
└────┬────┘
     │ state.ended = true
     ▼
┌──────────────────┐
│ useGameTicker    │ detects state.ended
│ → finishGame()   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ useGameSession   │ submittedRef = true
│ → onGameOver()   │ running = false
│ → finalScore set │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ useScoreData     │ → saveScore() / saveLocalScore()
│ → Firebase write │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ GameOverOverlay  │ shows score + "Chơi lại"
│ + DashboardPanel │ auto-opens leaderboard
└──────────────────┘
```

---

## 3. Proposed new flow

### 3.1 State machine

```
RUNNING
  │
  │ terminal condition reached (lives=0 or tick>=DURATION_TICKS)
  ▼
CONTINUE_OFFER
  │
  ├── user chooses "End Game" ──────────────────────► FINAL_GAME_OVER
  │
  ├── user not eligible (already continued) ────────► FINAL_GAME_OVER
  │
  └── user chooses "Continue"
      │
      ▼
  CONTINUE_AD_LOADING
      │
      ├── ad loaded successfully
      │   ▼
      │ CONTINUE_AD_WATCHING
      │   │
      │   ├── ad completed ──► CONTINUE_GRANTED ──► RUNNING_CONTINUED
      │   │
      │   └── ad dismissed early ──► CONTINUE_OFFER (retry) or FINAL_GAME_OVER
      │
      └── ad failed to load ──► CONTINUE_OFFER (with error message)
          │
          └── user chooses "End Game" ──► FINAL_GAME_OVER

RUNNING_CONTINUED
  │
  │ terminal condition reached again
  ▼
FINAL_GAME_OVER (no second continue offer)
  │
  ▼
score submitted + GameOverOverlay + DashboardPanel
```

### 3.2 State mapping to current architecture

| New State | `running` | `finalScore` | New field: `phase` |
|---|---|---|---|
| RUNNING | `true` | `null` | `"running"` |
| CONTINUE_OFFER | `false` (paused) | `null` | `"continueOffer"` |
| CONTINUE_AD_LOADING | `false` | `null` | `"adLoading"` |
| CONTINUE_AD_WATCHING | `false` | `null` | `"adWatching"` |
| CONTINUE_GRANTED | transitional | `null` | `"running"` (resuming) |
| RUNNING_CONTINUED | `true` | `null` | `"running"` |
| FINAL_GAME_OVER | `false` | `number` | `"gameOver"` |

### 3.3 Key invariant

> **Score submission (`onGameOver` → `useScoreData.handleGameOver`) MUST only be called in FINAL_GAME_OVER, never in CONTINUE_OFFER.**

---

## 4. Continue eligibility rules

### Ver1 rules

| Rule | Value | Rationale |
|---|---|---|
| Max continues per run | **1** | Simple, fair, prevents abuse |
| Eligible terminal reasons | **Both** `"timeout"` and `"lives"` | Both are natural continue points |
| Requires login | **No** | Continue is a gameplay feature, not a persistence feature |
| Requires score > 0 | **No** | Even 0-score players can continue (encourages engagement) |
| Blocked if score already submitted | **Yes** | Cannot continue after `finishGame()` has been called |
| Blocked if ad provider unavailable (prod) | **Yes** — falls back to `FINAL_GAME_OVER` | No free continues in production |
| Dev mode exception | **Yes** — simulated ad always available | Enables testing without real SDK |

### 4.1 Continue benefit per terminal reason

| Terminal reason | Continue benefit | Rationale |
|---|---|---|
| `"timeout"` | **+15 seconds** added to remaining game time | 15s is meaningful but not game-breaking. Full 30s would be too generous at end-game difficulty. |
| `"lives"` | **+1 life** restored | Restores one life so player can keep playing. Not full 3 lives — that would devalue the consequence of bombs. |

### 4.2 State preservation rules on continue

| State field | Preserved? | Rationale |
|---|---|---|
| `score` | ✅ Yes | Core reward of continue — keep your score |
| `combo` | ❌ Reset to 0 | Prevents combo-farming abuse: die → continue → keep 5x combo |
| `lives` | Set to 1 (if lives-ended) | +1 life is the continue reward |
| `tick` | Adjusted (if timeout) | Rolled back by 15 seconds worth of ticks |
| `ended` | Reset to `false` | Resumes the game loop |
| `endReason` | Reset to `null` | Game is no longer ended |
| `fruits` | ✅ Preserved | On-screen fruits remain |

### 4.3 Should runs be marked as `continued: true`?

**Ver1: No.** No schema change. The continue is purely an in-memory gameplay feature. The final submitted score is the same whether or not the player continued.

**Future consideration:** If fairness concerns arise, a `continued: boolean` field in the `runs` collection could allow leaderboard filtering. But this requires Firestore rules update and is deferred.

---

## 5. Reward / continue benefit design

### 5.1 Recommended ver1 approach

```
Ver1 recommended:
- Allow 1 continue per run
- Continue gives +15 seconds if terminal reason was "timeout"
- Continue gives +1 life if terminal reason was "lives"
- Score is preserved as-is
- Combo is reset to 0
- Game difficulty level (based on tick/elapsed time) is NOT reset
- Result is NOT submitted until final game over
- No Firestore schema change
```

### 5.2 Option comparison: schema change vs no-schema

| Aspect | No schema change (recommended ver1) | Schema change |
|---|---|---|
| **Implementation complexity** | Low | Medium |
| **Firestore rules change** | None | Must add `continued`, `continueCount` to `hasOnly` allowlist |
| **Deploy required** | No rules deploy | Yes — rules deploy |
| **Leaderboard fairness** | Cannot distinguish continued runs | Can filter/flag continued runs |
| **Risk** | Low — purely client-side change | Medium — rules deploy can break existing writes |
| **Future upgrade path** | Can add schema later | Already in place |
| **Rollback** | Trivial | Must revert rules + client code |

**Decision:** No schema change in ver1. Add schema later if product requires leaderboard differentiation.

---

## 6. Ad strategy

> [!IMPORTANT]
> No ad SDK will be installed in this planning phase or in AD-1/AD-2. Real SDK integration is a separate phase (AD-5).

### 6.1 Option comparison

| Option | Type | Fit for Continue | User Experience | Recommended? |
|---|---|---|---|---|
| **A — Rewarded Ad** | User-initiated, reward on completion | ✅ Perfect | Good — player voluntarily watches for reward | ✅ Production target |
| **B — Interstitial** | Forced full-screen ad | ❌ Poor | Bad — feels punitive before game over | ❌ Not recommended |
| **C — Dev Simulated Ad** | Fake ad, resolves after 2s delay | ✅ Dev-only | Good — enables full flow testing | ✅ Ver1 implementation |
| **D — No-ad Fallback** | Continue disabled entirely | N/A | Neutral — no continue feature | ⚠️ Production fallback only |

### 6.2 Ver1 ad provider interface

```typescript
interface AdProvider {
  /** Check if a rewarded ad is available. */
  isReady(): boolean;
  
  /** Request and show a rewarded ad. Resolves with reward result. */
  showRewardedAd(): Promise<AdResult>;
}

interface AdResult {
  granted: boolean;
  reason: "completed" | "dismissed" | "error" | "unavailable";
}
```

### 6.3 Ver1 simulated provider

```typescript
class SimulatedAdProvider implements AdProvider {
  isReady(): boolean { return true; }
  
  async showRewardedAd(): Promise<AdResult> {
    // Simulate a 2-second ad
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { granted: true, reason: "completed" };
  }
}
```

### 6.4 Production considerations

```
- Production should verify ad network policy before SDK integration.
- Ad SDK choice (AdMob, Unity Ads, IronSource) is a product decision.
- The AdProvider interface allows swapping implementations without touching game code.
- No provider should be hardcoded — use a factory or config pattern.
```

---

## 7. UX/UI plan

### 7.1 New component: `ContinueOfferOverlay`

**Location:** `src/components/game/ContinueOfferOverlay.tsx`

**Content:**

```
┌─────────────────────────────────────┐
│                                     │
│         ⏸ Tạm dừng!                │
│                                     │
│    Điểm hiện tại: 342 điểm         │
│                                     │
│    ┌─────────────────────────────┐  │
│    │  🎬 Xem quảng cáo          │  │
│    │  để nhận thêm 15 giây      │  │
│    │  [   Tiếp tục chơi   ]     │  │
│    └─────────────────────────────┘  │
│                                     │
│    [ Kết thúc ván này ]             │
│                                     │
│    (Bạn còn 1 lượt tiếp tục)       │
│                                     │
└─────────────────────────────────────┘
```

Dynamic text based on terminal reason:
- Timeout: "để nhận thêm 15 giây" (to get 15 more seconds)
- Lives: "để nhận thêm 1 mạng" (to get 1 more life)

### 7.2 UI states

| State | UI behavior |
|---|---|
| `idle` | Shows offer with both buttons active |
| `adLoading` | "Tiếp tục chơi" button shows spinner, disabled. "Kết thúc" also disabled. |
| `adWatching` | Overlay may dim further. Buttons disabled. |
| `adCompleted` | Brief "Thưởng đã nhận!" flash → resume game |
| `adFailed` | Error message "Không thể tải quảng cáo. Vui lòng thử lại hoặc kết thúc ván." Continue button re-enables for retry. |
| `notEligible` | This state should not show the overlay — go straight to FINAL_GAME_OVER. |

### 7.3 UI requirements

| Requirement | Detail |
|---|---|
| Layer position | React overlay on top of Pixi canvas, same pattern as `GameOverOverlay` |
| Pixi interaction | Game loop is **paused** while overlay is visible. No fruit spawning, no physics. |
| z-index | Same or higher than `GameOverOverlay` (above canvas, below top bar) |
| Keyboard a11y | `Enter` → Continue, `Escape` → End Game |
| Mobile friendly | Buttons large enough for touch (min 44×44px tap target) |
| Animation | Gentle fade-in. No jarring transitions. |
| No Pixi objects | All UI is React/HTML/CSS. No Pixi graphics for ad UI. |

### 7.4 Countdown timer on offer (optional ver1)

Consider a 10-second countdown on the continue offer overlay. If the player doesn't decide within 10 seconds, auto-select "End Game". This prevents indefinite pausing.

**Recommendation:** Include in ver1. A visible countdown creates urgency and prevents AFK abuse.

---

## 8. Architecture impact

### 8.1 Files that need modification

| File | Change type | Description |
|---|---|---|
| [useGameSession.ts](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/features/game/runtime/useGameSession.ts) | **Modify** | Add `phase` state (`running` / `continueOffer` / `adLoading` / `adWatching` / `gameOver`). Add `continueUsed` ref. Add `requestContinue()` and `grantContinue()` methods. Modify `finishGame()` to check continue eligibility before finalizing. |
| [useGameTicker.ts](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/features/game/runtime/useGameTicker.ts) | **Modify** | When `state.ended` is detected, instead of calling `finishGame()` directly, call a new `onTerminalReached()` callback that routes through continue eligibility check. |
| [FruitGame.tsx](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/components/game/FruitGame.tsx) | **Modify** | Wire `ContinueOfferOverlay` into the render tree. Pass continue callbacks. Handle `grantContinue` → mutate core state → resume ticker. Show `ContinueOfferOverlay` when phase is `continueOffer`. |
| [GameOverOverlay.tsx](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/components/game/GameOverOverlay.tsx) | **Minor modify** | No functional change needed if the continue overlay is a separate component. May need to ensure it only renders during `FINAL_GAME_OVER` phase (already guarded by `finalScore !== null`). |
| [core.ts](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/game/core.ts) | **Modify (minimal)** | Add a pure function `resumeAfterContinue(state, reason)` that resets `ended`, `endReason`, adjusts `tick` or `lives` based on the continue benefit. **Must remain pure — no ad/Firebase/React imports.** |
| [types.ts](file:///home/pro/Downloads/game2/Speed%20Click%20Game/src/game/types.ts) | **Modify (minimal)** | Optionally add `continued?: boolean` to `GameResult` for internal tracking (no schema change). |

### 8.2 New files

| File | Type | Description |
|---|---|---|
| `src/components/game/ContinueOfferOverlay.tsx` | Component | React overlay for the continue decision UI |
| `src/lib/adProvider.ts` | Service | `AdProvider` interface + `SimulatedAdProvider` implementation |

### 8.3 Files NOT modified

| File | Reason |
|---|---|
| `src/lib/firebase.ts` | No schema change in ver1 |
| `src/hooks/useScoreData.ts` | `handleGameOver` is only called on FINAL_GAME_OVER — no change needed |
| `src/lib/localScores.ts` | No schema change |
| `firestore.rules` | No new fields |
| `src/components/game/GamePage.tsx` | Continue is handled inside `FruitGame.tsx`, `GamePage` only receives final `onGameOver` |
| `src/features/game/render/*` | Render hooks don't own game state transitions |
| `src/features/game/input/*` | Input hooks are unaffected — input is disabled when `playingRef.current = false` |

### 8.4 Hard boundaries

```
core.ts:
  ✗ MUST NOT import: ad SDK, Firebase, React, Pixi, browser APIs
  ✓ MAY export: resumeAfterContinue(state, reason) pure function

adProvider.ts:
  ✗ MUST NOT import: game render hooks, core.ts, Pixi, components
  ✓ MAY import: nothing (self-contained service)

ContinueOfferOverlay.tsx:
  ✗ MUST NOT mutate core state directly
  ✓ MAY call: session callbacks (requestContinue, endGame)

useGameSession.ts:
  ✗ MUST NOT import: ad SDK, Pixi, render hooks
  ✓ MAY import: types from core/types
```

---

## 9. State ownership proposal

| Concern | Owner | Rationale |
|---|---|---|
| `continueUsed` (ref) | `useGameSession` | Session-level state, resets on new game |
| `phase` (state) | `useGameSession` | Controls what overlay is visible |
| `pendingEndReason` | `useGameSession` | Stored when terminal condition is reached but not finalized |
| Continue eligibility decision | `useGameSession` | Checks `continueUsed` + `pendingEndReason` |
| Resume game (mutate core state) | `FruitGame.tsx` via callback | Has access to `coreRef.current`; calls `resumeAfterContinue()` then resumes ticker |
| Ad request/response | `ContinueOfferOverlay` or parent | Calls `adProvider.showRewardedAd()` and reports result back |
| Final score submission | `useScoreData.handleGameOver` | Only called when `useGameSession.finishGame()` fires (FINAL_GAME_OVER only) |

### 9.1 Data flow for continue

```
useGameTicker detects state.ended
    ↓
calls onTerminalReached(reason) instead of finishGame()
    ↓
useGameSession.onTerminalReached:
    if continueUsed → finishGame() → FINAL_GAME_OVER
    if !continueUsed → set phase = "continueOffer", store pendingEndReason
    ↓
FruitGame renders ContinueOfferOverlay (phase === "continueOffer")
    ↓
User clicks "Continue"
    ↓
ContinueOfferOverlay calls onRequestContinue()
    → set phase = "adLoading"
    → adProvider.showRewardedAd()
    → on success: set phase = "running", continueUsed = true
       → FruitGame calls resumeAfterContinue(coreRef.current, reason)
       → set playingRef.current = true
       → resume ticker
    → on failure: set phase = "continueOffer" with error state
    ↓
User clicks "End Game" (at any point during offer)
    ↓
useGameSession.finishGame() → FINAL_GAME_OVER → onGameOver → score submit
```

---

## 10. Score/Firebase/leaderboard implications

### 10.1 Score submission invariants

| Invariant | Enforced by | Status |
|---|---|---|
| Score submitted only after FINAL_GAME_OVER | `finishGame()` not called during CONTINUE_OFFER | Must verify in implementation |
| No score submitted during CONTINUE_OFFER | `submittedRef` guard + phase check | Existing guard helps |
| If user continues, score continues accumulating | Core state preserved, `score` not reset | By design |
| If user ends, submit pending result | `finishGame()` called with current score | Standard path |
| If ad fails, no continue granted | Ad result check before resume | Must implement |
| If page reload at CONTINUE_OFFER | No score submitted (same as current — only submitted on finishGame) | Safe — submittedRef is false |
| No duplicate submit after continue+final | `submittedRef` prevents double call | Existing guard |

### 10.2 Firebase schema (NO CHANGE in ver1)

Current `runs` document fields:
```
uid, playerName, photoURL, score, playTimeSec, verified, createdAt
```

No new fields added. `playTimeSec` will reflect total play time including continue extension — this is acceptable because the player genuinely played that long.

### 10.3 Leaderboard

Leaderboard deduplication (P-2) is unaffected. It groups by `uid` and keeps the highest score. A continued run's score is still a valid score.

### 10.4 Future schema fields (deferred)

If schema change is desired later:

```typescript
// Added to runs document
continued: boolean;       // true if player used continue
continueCount: number;    // number of continues used (1 in ver1)
continueGrantedAt?: number; // timestamp when continue was granted
```

Would require:
- Update `GameResult` type
- Update `saveScore` payload
- Update `firestore.rules` `hasOnly` and `hasAll` lists
- Update `LocalScore` type
- Deploy new Firestore rules
- Update tests

---

## 11. Abuse / fairness risks

### 11.1 Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Spam continue** — player continues infinitely | High | Hard limit: 1 continue per run (in-memory `continueUsed` ref) |
| **Fake ad callback** — ad didn't complete but reward granted | Medium | Ver1 accepts client-authoritative ad result. Real SDK provides signed callbacks. Deferred to AD-5. |
| **Page reload during continue** — play indefinitely by reloading | Low | Continue state is in-memory. Reload = new game. No score submitted for incomplete runs. |
| **Duplicate score submit** — submit before and after continue | High | `submittedRef` guard. `finishGame()` only called once per session. Verify in tests. |
| **Score inflation** — continue allows much higher scores | Medium | Continue benefit is modest (+15s or +1 life). Difficulty does NOT reset. Game gets harder over time. |
| **Leaderboard fairness** — continued runs compete with non-continued | Low | Ver1 accepts this. Future: add `continued` flag to allow filtering. |
| **Local fallback manipulation** — localStorage scores edited | Low (pre-existing) | Client-authoritative limitation exists regardless of continue feature. Not new risk. |
| **`verified: false` semantic** — still false for continued runs | Info | `verified` is always `false` from client. A future server function could set `true`. Continue doesn't change this. |

### 11.2 Ver1 mitigations

```
✓ One continue per run (in-memory guard)
✓ No score submit before final game over
✓ Difficulty level not reset after continue
✓ Combo reset to 0 after continue
✓ Modest continue benefit (+15s or +1 life, not both)
✓ submittedRef prevents double-submit
✓ Ad result checked before granting reward
✗ No server-side ad callback verification (deferred to AD-5)
✗ No continued-run marking in leaderboard (deferred)
```

---

## 12. Implementation phases

### AD-1 — State machine + simulated continue (no UI)

**Scope:**
- Add `phase` state to `useGameSession`
- Add `continueUsed` ref
- Add `onTerminalReached()` logic
- Add `resumeAfterContinue()` pure function in `core.ts`
- Add `adProvider.ts` with `SimulatedAdProvider`
- Modify `useGameTicker` to route through terminal check
- Wire continue grant → core state mutation → resume in `FruitGame.tsx`
- No new UI component yet — use `console.log` or auto-grant for testing

**Files to touch:**
- `src/game/core.ts` — add `resumeAfterContinue()`
- `src/game/types.ts` — optionally add `continued?: boolean` to `GameResult`
- `src/features/game/runtime/useGameSession.ts` — add phase + continue logic
- `src/features/game/runtime/useGameTicker.ts` — route terminal detection
- `src/components/game/FruitGame.tsx` — wire continue callbacks
- `src/lib/adProvider.ts` — new file, simulated provider

**Verification:**
```bash
npm run typecheck
npm test
npm run build
git diff --check
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

**Commit:** `feat: add continue state machine with simulated ad provider`

**Rollback:** Revert commit. No Firebase/rules changes to undo.

---

### AD-2 — ContinueOfferOverlay UI

**Scope:**
- Create `ContinueOfferOverlay.tsx`
- Style consistent with existing `GameOverOverlay` / game aesthetic
- Wire into `FruitGame.tsx` render tree
- Show when `phase === "continueOffer"`
- Buttons: Continue (with ad loading state) / End Game
- 10-second countdown timer on offer
- Mobile-friendly, accessible

**Files to touch:**
- `src/components/game/ContinueOfferOverlay.tsx` — new component
- `src/components/game/FruitGame.tsx` — add overlay to JSX
- `src/styles/game-ui.css` — new styles for continue overlay

**Verification:**
```bash
npm run typecheck
npm test
npm run build
git diff --check
```

**Commit:** `feat: add ContinueOfferOverlay UI component`

**Rollback:** Remove component + revert FruitGame changes.

---

### AD-3 — Score finalization guard + tests

**Scope:**
- Add unit tests for `resumeAfterContinue()`
- Add tests verifying score is NOT submitted during CONTINUE_OFFER
- Add test: continue used → second terminal → FINAL_GAME_OVER directly
- Add test: ad failure → no reward
- Verify `submittedRef` guard covers all paths

**Files to touch:**
- `src/game/core.test.ts` — add resume tests
- Possibly new test file for session logic

**Verification:**
```bash
npm run typecheck
npm test
npm run build
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npx --yes knip --no-progress
```

**Commit:** `test: add continue flow and score finalization tests`

**Rollback:** Remove test additions.

---

### AD-4 — Optional metadata schema + Firebase rules update

**Scope (deferred — only if product decides):**
- Add `continued: boolean` and `continueCount: number` to `GameResult`
- Update `saveScore` payload
- Update `firestore.rules` `hasOnly` / `hasAll` for runs
- Update `LocalScore` type
- Deploy updated Firestore rules
- Update tests

**Files to touch:**
- `src/game/types.ts`
- `src/lib/firebase.ts`
- `src/lib/localScores.ts`
- `firestore.rules`
- Tests

**Verification:**
```bash
npm run typecheck
npm test
npm run build
# Deploy rules to emulator first:
npx firebase emulators:start --only firestore
# Then deploy to production after testing:
npx firebase deploy --only firestore:rules
```

**Commit:** `feat: add continued metadata to score schema`

**Rollback:** Revert commit + redeploy original rules.

---

### AD-5 — Real rewarded ad provider adapter

**Scope (deferred — requires product/SDK decision):**
- Choose ad SDK (AdMob Web, Unity Ads, etc.)
- Implement `RealAdProvider` conforming to `AdProvider` interface
- Add SDK initialization in app bootstrap
- Add error handling / fallback to `SimulatedAdProvider` in dev
- Test on real devices

**Files to touch:**
- `src/lib/adProvider.ts` — add real provider
- `index.html` or `vite.config.ts` — SDK script tag or import
- `src/App.tsx` or `src/main.tsx` — SDK init

**Verification:**
- Manual test on mobile and desktop browsers
- Verify ad loads and completes
- Verify reward granted only on completion

**Commit:** `feat: integrate real rewarded ad SDK`

**Rollback:** Revert to `SimulatedAdProvider`.

---

### AD-6 — Final audit + manual smoke

**Scope:**
- Full audit (same as F-1)
- Runtime smoke test with continue flow
- Verify all state transitions
- Verify leaderboard still works
- Verify no duplicate submits

**Verification:**
```bash
npm run typecheck
npm test
npm run build
git diff --check
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npx --yes knip --no-progress
```

**Commit:** None expected (audit only).

---

## 13. Test plan

### 13.1 Unit tests

| Test case | Expected |
|---|---|
| No continue → final game over → submit once | Score submitted exactly once |
| Continue accepted → resumes game → final game over → submit once | Score submitted exactly once, with accumulated score |
| Continue rejected ("End Game") → final game over | Score submitted with score at time of terminal |
| Continue used → cannot continue second time | Second terminal goes directly to FINAL_GAME_OVER |
| Ad fail → no reward granted | Phase returns to `continueOffer` or `gameOver` |
| Ad loading → buttons disabled | UI state reflects loading |
| Score preserved after continue | `state.score` unchanged by `resumeAfterContinue()` |
| Combo reset after continue | `state.combo === 0` after `resumeAfterContinue()` |
| Lives +1 after lives-ended continue | `state.lives === 1` after `resumeAfterContinue(state, "lives")` |
| Time +15s after timeout continue | `state.tick` rolled back by `15 * TICK_RATE` ticks |
| `state.ended` reset after continue | `state.ended === false` |
| `state.endReason` reset after continue | `state.endReason === null` |
| Leaderboard still dedupes by uid | P-2 logic unchanged |
| `submittedRef` prevents double submit | `finishGame()` called twice → only first executes |

### 13.2 Manual smoke test checklist

```
[ ] Game runs normally without continue
[ ] Terminal condition → continue offer overlay appears
[ ] "End Game" button → final game over with correct score
[ ] "Continue" button → simulated ad → game resumes
[ ] After continue, game difficulty matches elapsed time (not reset)
[ ] After continue, combo is 0
[ ] After continue, lives = 1 (if lives-ended) or time extended (if timeout)
[ ] Second terminal after continue → no continue offer → final game over
[ ] Score submitted only once to Firebase
[ ] Leaderboard shows correct best score per user
[ ] Home → Game → Continue → Home → Game: no Pixi teardown crash
[ ] 10-second countdown on offer → auto end game
[ ] Mobile touch: buttons respond correctly
```

### 13.3 Verification commands

```bash
npm run typecheck
npm test
npm run build
git diff --check
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npx --yes knip --no-progress
```

---

## 14. Open questions

> [!IMPORTANT]
> These decisions need product approval before implementation begins.

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Continue reward: +time, +life, or both? | A: +15s for timeout, +1 life for lives *(context-dependent)* / B: Always +15s regardless / C: Always +1 life regardless | **A** — context-dependent, more intuitive |
| Q2 | Continue limit: once per run or more? | A: Once / B: Twice / C: Unlimited (with increasing ad frequency) | **A** — once per run for ver1 |
| Q3 | Should continued runs be marked in leaderboard? | A: No (ver1) / B: Yes, with badge / C: Separate leaderboard | **A** — no marking in ver1 |
| Q4 | Should continue require login? | A: No / B: Yes | **A** — continue is gameplay, not persistence |
| Q5 | Should ad be real SDK now or simulated first? | A: Simulated first / B: Real SDK immediately | **A** — simulated first, real SDK in AD-5 |
| Q6 | Should no-ad fallback exist in dev only? | A: Dev only / B: Also in production as free continue | **A** — dev only; production requires real ad |
| Q7 | Should continue be allowed after bomb death (lives=0)? | A: Yes / B: No, only timeout | **A** — both terminal reasons are valid continue points |
| Q8 | Should combo reset after continue? | A: Yes, reset to 0 / B: No, preserve combo | **A** — reset to prevent combo-farming abuse |
| Q9 | Should there be a countdown timer on the continue offer? | A: Yes, 10 seconds / B: No timer | **A** — 10 second countdown prevents AFK abuse |
| Q10 | How much bonus time for timeout continue? | A: 15 seconds / B: 30 seconds / C: 10 seconds | **A** — 15s is balanced for 3-minute game |

---

## 15. Recommended ver1 decision

```
Recommended Ver1:
─────────────────
- Implement simulated rewarded-ad flow first (AD-1, AD-2)
- Allow ONE continue per run
- Continue grants +15 seconds if terminal reason was "timeout"
- Continue grants +1 life if terminal reason was "lives"
- Preserve score as-is
- Reset combo to 0
- Do NOT reset difficulty (game stays hard)
- Do NOT change Firestore schema in AD-1/AD-2/AD-3
- Submit score ONLY after FINAL_GAME_OVER
- Add real ad SDK only after state machine is stable (AD-5)
- Include 10-second countdown on continue offer overlay
- No server-side ad verification in ver1

Implementation order:
  AD-1 → state machine + core resume function + simulated ad provider
  AD-2 → ContinueOfferOverlay UI
  AD-3 → tests + score finalization guards
  AD-4 → optional schema (only if product decides)
  AD-5 → real ad SDK
  AD-6 → final audit

Critical invariant to protect:
  ⚠️ Score submission (onGameOver → useScoreData) MUST only fire
     in FINAL_GAME_OVER, never during CONTINUE_OFFER.
     This is the #1 priority to verify in AD-3 tests.
```
