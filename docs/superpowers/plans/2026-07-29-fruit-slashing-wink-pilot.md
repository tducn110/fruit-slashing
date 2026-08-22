# R4 — Fruit Slashing Wink iframe-only integration pilot

Status: bounded implementation plan, awaiting implementation approval.

This plan is intentionally scoped to R4/C4. It supersedes the older
`2026-07-28-fruit-slashing-wink-pilot.md` draft where that draft refers to
bridge `8.0.0`, an integration environment, or direct/anonymous standalone
fallback. The frozen pilot contract is bridge `9.0.0`, environments `dev` and
`prod` only, iframe-only access, and `PARENT_REQUIRED` at top level.

## 1. Inputs and invariants

### Worktree

- Repository: `/Users/ddwsc/Desktop/papagroup/web/bo-lac-fruit-slashing-pixijs`
- Implementation worktree:
  `/Users/ddwsc/Desktop/papagroup/web/bo-lac-fruit-slashing-pixijs/.worktrees/codex/wink-integration-pilot`
- Branch: `codex/wink-integration-pilot`
- Exact baseline: `43f5208266f9c70a5ff68c6b8cd7c717b63dbf5b`
- Primary checkout remains untouched on `develop`.
- No push or deploy is part of R4.

The previous AI-assisted files are preserved in the recoverable stash
`pre-pilot-ai-integration-2026-07-28` (`d782391b984fbbdcc1a5e104a4c098bcde5fd3f3`).
They are not part of this plan and must not be restored into the pilot.

### Authoritative contract

The implementation consumes the R1 executable contract, fixtures, and the
certified R2 artifact from the Wink FE pilot. The bridge artifact is copied
byte-for-byte from:

`/Users/ddwsc/Desktop/papagroup/web/wink/.worktrees/codex/minigame-runtime-pilot/game-template/wink-bridge.js`

Pinned values:

```text
protocolVersion: 1
bridgeVersion: 9.0.0
bridge SHA-256: afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb
scoped access TTL: 300 seconds
```

The public bridge surface is limited to `subscribe`, `getState`,
`getCapabilities`, `getLeaderboard`, `submitScore`, `complete`, `onPause`,
`onResume`, `onMute`, `onUnmute`, and `help`. The game never receives or
stores a primary Wink token, refresh handle, dev secret, anonymous ID, API
base, or raw `postMessage` credentials.

Frozen semantic rules:

- Only iframe mode is supported.
- A top-level load fails closed with `PARENT_REQUIRED` and makes zero Wink API
  requests.
- Anonymous users may read the leaderboard and complete a round, but
  `submitScore` is denied by capability.
- Authenticated non-guest users may submit a score when the scoped capability
  allows it.
- The game owns the game-over/final-score boundary. The bridge only supplies
  runtime and credentials.
- Completion and score submission are independent operations.
- Parent pause/resume must stop/resume game time without resetting a round.
- Parent mute/unmute must affect audio without changing user mute preference or
  round state.
- Tracking feed/UI remains Wink FE responsibility.
- No anonymous endpoint, refresh endpoint, authority, integration environment,
  direct mode, or Nginx subdomain blocking is added in R4.

## 2. Baseline audit evidence

All commands below were run from the pilot worktree before implementation:

```text
node: v22.11.0
npm: 11.3.0
npm test: 1 file, 3 tests passed
npm run typecheck: passed
npm run build: passed
```

The production build emits only the existing Vite warning about a
`pixi-vendor` chunk above 500 kB (`520.66 kB`). It is not a correctness or C4
blocker; R4 does not introduce chunk splitting or dependency churn to silence
it. The nested-worktree/Turbopack-root warning belongs to the Wink FE
workspace, not this Vite game build, and is not copied into the Fruit
configuration.

Current dependency audit:

| Package | Severity | Reachability | R4 disposition |
| --- | --- | --- | --- |
| `vite` `<=6.4.2` | high | direct dev dependency | Do not bulk-upgrade during integration. Record as a dev-server/tooling risk; `npm audit` remains a review item for R5/release hardening. |
| `postcss` `<=8.5.17` | high | transitive | No runtime/browser path in the built game. Keep the lockfile stable and record the transitive finding for release review. |
| `tar` `<=7.5.20` | critical | transitive install tooling | Not shipped in the static image. Do not widen R4 by replacing the package tree; revisit with a targeted lockfile update before any release/deploy. |

The audit result is therefore an explicit defer decision, not an ignored
finding and not an authorization for unrelated dependency upgrades. C4 must
still record the exact `npm audit --json` output and package-lock digest.

## 3. File ownership map

### Tooling and pinned runtime

Create or modify only in the pilot worktree:

- `.nvmrc` — Node major `22`.
- `package.json`, `package-lock.json` — npm-only scripts and test/runtime
  dependencies required for adapter tests.
- `tsconfig.json`, `vite.config.ts` — strict Node/Vite typing and build-time
  environment guards.
- `public/wink-bridge.js` — exact R2 artifact.
- `public/wink-bridge.lock.json` — protocol/version/SHA-256/source commit pin.
- `public/wink-runtime-config.json` — generated five-field public config.
- `scripts/sync-wink-bridge.mjs` — deterministic artifact copy and lock
  generation.
- `scripts/verify-wink-bridge.mjs` — byte/checksum/manifest/config verifier.
- `index.html` — bridge script before the Vite module.

The runtime-config generator is owned by the packaging entrypoint
`game.config.sh`; if implementation needs a reusable Node helper, add
`scripts/generate-wink-runtime-config.mjs` as a small supporting file and
include it in the same tooling commit. It must not become a second contract
implementation.

`GAME_ID` and the registered parent origins must be read from the R1 fixture
and the local R2 harness configuration during implementation. This plan does
not invent a new catalog UUID or origin.

### Typed game adapter and UI

- `src/integrations/wink/types.ts` — redacted game-facing state, capability,
  operation, leaderboard, and typed-error types.
- `src/integrations/wink/client.ts` — the only runtime bridge facade. It owns
  the `window.WinkBridge` declaration, exact method mapping, validation, and
  per-round promise memoization.
- `src/integrations/wink/useWinkIntegration.ts` — one React subscription,
  lifecycle registration, and mode/state projection.
- `src/integrations/wink/__tests__/client.test.ts`
- `src/integrations/wink/__tests__/useWinkIntegration.test.tsx`
- `src/integrations/wink/__tests__/security-negative.test.ts`
- `scripts/__tests__/wink-bridge-files.test.mjs`
- `src/components/ui/IntegrationStatusBanner.tsx` — visible status and
  redacted error UI.
- `src/App.tsx` — integration owner and data/lifecycle wiring.
- `src/hooks/useScoreData.ts` — remote leaderboard and final-score operations;
  local mode only behind an explicit development flag.
- `src/hooks/useScoreData.test.tsx`

### Game semantics and lifecycle

- `src/game/types.ts` — stable `roundId` in `GameResult`.
- `src/features/game/runtime/useGameSession.ts` — round identity,
  idempotent finish, host-pause clock compensation, and lifecycle methods.
- `src/features/game/runtime/useGameSession.test.ts`
- `src/components/game/FruitGame.tsx` — semantic completion boundary, final
  score boundary, pause/resume wiring, and no direct bridge usage.
- `src/components/game/GamePage.tsx` — pass lifecycle state and adapter
  callbacks into the game.
- `src/components/game/DashboardPanel.tsx` — change only if the existing
  local-entry interface cannot render remote entries/error/empty state.
- `src/utils/audio-manager.ts` — change only if a parent-mute layer cannot be
  implemented by the existing public mute methods without losing user
  preferences.

### Packaging and handoff

- `Dockerfile`
- `.dockerignore`
- `etc/default.conf.template`
- `game.config.sh`
- `deploy.sh`
- `README.md` — connected/harness/offline developer handoff and explicit
  non-certifying mode wording.

No code is owned in Wink FE, Wink BE, the FE primary checkout, or the
recoverable AI stash by this R4 plan.

## 4. Public adapter API

> **Amended 2026-08-18 — leaderboard shape.** The `WinkGameClient.getLeaderboard`
> signature recorded below is the R4 contract as frozen on 2026-07-29 and is no
> longer current. It now resolves to `WinkLeaderboard`
> (`{ entries, me }`) instead of a bare entry array, and the server caps a page
> at 30 rows. `me` is the signed-in player's own best run with its rank across
> the whole board, or null for an anonymous or guest reader. The rest of this
> section is left as written, as the record of what R4 shipped.


The following is the only API visible to game/UI code. Raw `window.WinkBridge`
is confined to `src/integrations/wink/client.ts`.

```ts
type WinkMode = "wink" | "offline";
type WinkPhase =
  | "booting"
  | "loading_config"
  | "waiting_parent_hello"
  | "waiting_session"
  | "ready_anonymous"
  | "ready_authenticated"
  | "renewing"
  | "error";

interface WinkIntegrationError {
  code:
    | "PARENT_REQUIRED"
    | "BRIDGE_READY_TIMEOUT"
    | "PROTOCOL_MISMATCH"
    | "RUNTIME_CONFIG_INVALID"
    | "SESSION_CREATE_FAILED"
    | "SESSION_RENEWAL_FAILED"
    | "SESSION_EXPIRED"
    | "CAPABILITY_DENIED"
    | "API_NETWORK_ERROR"
    | "MESSAGE_REJECTED"
    | "BRIDGE_MISSING"
    | "INVALID_SCORE"
    | "INVALID_ROUND";
  message: string;
  retryable: boolean;
}

interface WinkCapabilities {
  getLeaderboard: boolean;
  submitScore: boolean;
  complete: boolean;
}

interface WinkLeaderboardEntry {
  rank: number;
  score: number;
  playTime: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

interface WinkGameClient {
  getState(): RedactedWinkState;
  getCapabilities(): WinkCapabilities;
  getLeaderboard(options?: { limit?: number; offset?: number }):
    Promise<readonly WinkLeaderboardEntry[]>;
  submitScore(input: {
    score: number;
    playTime?: number;
    gameMode?: string;
    counter?: number;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void>;
  complete(input: {
    roundId: string;
    playDurationMs?: number;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void>;
  onPause(listener: () => void): () => void;
  onResume(listener: () => void): () => void;
  onMute(listener: () => void): () => void;
  onUnmute(listener: () => void): () => void;
  help(): string;
}

interface WinkIntegration {
  mode: WinkMode;
  phase: WinkPhase;
  capabilities: WinkCapabilities;
  state: RedactedWinkState;
  client: WinkGameClient | null;
  hostPaused: boolean;
  error: WinkIntegrationError | null;
  refreshLeaderboard(): Promise<void>;
  submitFinalScore(input: {
    roundId: string;
    score: number;
    playTimeSec: number;
    qualifies: boolean;
  }): Promise<void>;
  completeRound(input: {
    roundId: string;
    playDurationMs: number;
  }): Promise<void>;
}
```

`submitFinalScore` is a capability-aware operation, not a convenience
fallback: an anonymous denial is returned as `CAPABILITY_DENIED` and surfaced
to the player. `completeRound` is independent and remains callable when score
submission is denied or fails. Both operations are idempotent by `roundId`;
the adapter memoizes promises and never silently retries a completed operation.

## 5. Protocol and state-machine implementation

The copied R2 bridge remains the protocol implementation. R4 only consumes its
typed surface and tests the boundary from the real game.

### State transitions

```text
booting
  -> loading_config
  -> waiting_parent_hello
  -> waiting_session
  -> ready_anonymous | ready_authenticated
  -> renewing
  -> ready_anonymous | ready_authenticated
  -> error
```

The adapter treats `error` as terminal for the current integration instance
unless the certified bridge emits a state transition. It never downgrades a
protocol/config/catalog mismatch to offline mode. Offline mode is selected
only when both conditions hold:

```text
import.meta.env.DEV === true
VITE_WINK_OFFLINE_MODE === "true"
```

The adapter projects state/capabilities without copying credentials. No
`postMessage` listener is added by Fruit code, and no wildcard target origin
is permitted.

### Exact rejection cases to preserve

- top-level: `PARENT_REQUIRED`, no runtime-config or Wink API request;
- wrong source or origin: reject and keep current session state;
- wrong protocol or game ID: `PROTOCOL_MISMATCH`/`MESSAGE_REJECTED`;
- malformed schema or extra/missing keys: `MESSAGE_REJECTED`;
- stale frame/session event: ignore/reject without changing the active round;
- catalog mismatch: visible typed error, no downgrade;
- capability denial: visible typed error, no local write.

## 6. Execution tasks (tests first)

Each task below is an independently reviewable commit boundary. The test
listed first must be written before its implementation files are changed.

### Task 1 — Normalize the baseline and establish SDK pins

**Files:** `.nvmrc`, `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`, `public/wink-bridge.js`,
`public/wink-bridge.lock.json`, `scripts/sync-wink-bridge.mjs`,
`scripts/verify-wink-bridge.mjs`, `index.html`.

**Test first:** create
`scripts/__tests__/wink-bridge-files.test.mjs` to assert Node major 22,
exact bridge bytes/checksum/version/protocol, no primary/API/secret fields in
the public config, bridge-before-module ordering in `index.html`, and
production/offline build guard behavior.

**Implementation scope:** normalize npm-only tooling; add the Node 22 pin;
copy the certified R2 artifact byte-for-byte; generate the lock from copied
bytes; generate/validate `wink-runtime-config.json` with exactly
`gameId`, `environment`, `bridgeVersion`, `protocolVersion`, and
`allowedParentOrigins`; load the bridge before `main.tsx`; expose
`verify:wink-bridge`. Only `dev` and `prod` are accepted.

**Verification:**

```bash
npx vitest run scripts/__tests__/wink-bridge-files.test.mjs
npm run typecheck
npm run verify:wink-bridge
```

**Expected result:** all pass; checksum is the pinned
`afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb`;
production API/secret/offline inputs are rejected; no pnpm lock/workspace is
introduced.

**Commit:** `chore(r4): pin bridge and normalize game runtime`.

### Task 2 — Add the typed bridge adapter and error model

**Files:** `src/integrations/wink/types.ts`,
`src/integrations/wink/client.ts`,
`src/integrations/wink/__tests__/client.test.ts`.

**Test first:** use a fake bridge and assert ready-state projection,
capability projection, exact leaderboard mapping, input validation, typed
errors, and one-promise-per-round idempotency. Include anonymous
`CAPABILITY_DENIED`, score failure followed by completion, completion failure,
and malformed result cases.

**Implementation scope:** keep the bridge global declaration and all
bridge-method calls inside `client.ts`; validate finite non-negative score,
bounded play time, and UUID round IDs; map R1 response fields to the UI-safe
entry shape; memoize score/completion promises separately by `roundId`;
redact state before it leaves the adapter.

**Verification:**

```bash
npx vitest run src/integrations/wink/__tests__/client.test.ts
npm run typecheck
```

**Expected result:** adapter tests pass without `localStorage`, network, token,
or raw `postMessage` access from game code.

**Commit:** `feat(r4): add typed Wink game adapter`.

### Task 3 — Wire one React integration subscription and visible status

**Files:** `src/integrations/wink/useWinkIntegration.ts`,
`src/integrations/wink/__tests__/useWinkIntegration.test.tsx`,
`src/components/ui/IntegrationStatusBanner.tsx`, `src/App.tsx`.

**Test first:** assert one subscribe/unsubscribe lifecycle, anonymous versus
authenticated readiness/capabilities, renewal/error projection, host
pause/resume/mute/unmute callbacks, missing bridge handling, and that offline
mode requires the explicit development flag.

**Implementation scope:** create one client instance per app, subscribe once,
expose redacted integration state, and render a status banner in loading,
landing, game, and leaderboard views. Never print credentials or raw bridge
diagnostics. Pass lifecycle state/callbacks down through typed props.

**Verification:**

```bash
npx vitest run src/integrations/wink/__tests__/useWinkIntegration.test.tsx
npm run typecheck
npm run build
```

**Expected result:** status is visible for booting, ready anonymous,
ready authenticated, renewal, capability/network/session errors, and
`PARENT_REQUIRED`; no silent fallback is possible.

**Commit:** `feat(r4): expose Wink integration state in the app`.

### Task 4 — Replace local-success score data with remote-first behavior

**Files:** `src/hooks/useScoreData.ts`,
`src/hooks/useScoreData.test.tsx`, `src/App.tsx`,
`src/components/game/DashboardPanel.tsx` only if required.

**Test first:** assert loading does not substitute local entries, remote
leaderboard entries map correctly, remote empty is rendered empty, network
failure is visible and preserves no false success, anonymous score denial
creates no local row, authenticated qualifying score calls `submitScore`, and
explicit offline development mode alone may read/write `localScores`.

**Implementation scope:** accept `WinkIntegration`; fetch leaderboard through
`getLeaderboard`; submit only the final qualifying score; keep score and
completion status independent; remove `Người chơi`/mock ranking from the
certified path; keep local storage only as an explicitly labelled,
non-certifying developer mode.

**Verification:**

```bash
npx vitest run src/hooks/useScoreData.test.tsx
npm run typecheck
```

**Expected result:** anonymous users can read the real leaderboard but cannot
mistakenly see a locally “saved” score; authenticated non-guest users see
success only after the scoped submission resolves.

**Commit:** `feat(r4): make leaderboard and score operations remote-first`.

### Task 5 — Model round identity and the real final-score boundary

**Files:** `src/game/types.ts`,
`src/features/game/runtime/useGameSession.ts`,
`src/features/game/runtime/useGameSession.test.ts`,
`src/components/game/FruitGame.tsx`,
`src/components/game/GamePage.tsx`.

**Test first:** add controlled-clock tests for one stable round UUID across
  countdown/game-over/revive/finalize, a new UUID for a new round,
  idempotent game-over, score multiplier applied only at finalization, and
  completion/score independence.

**Implementation scope:** generate `roundId` once at the real round start;
preserve it during revive; keep the semantic `complete` call at the actual
game-over boundary exactly once; call score submission only when the player
chooses “End Game” and the final score qualifies; guard duplicate finalize
clicks and navigation/unmount paths. The game does not call the bridge
directly—callbacks target the typed adapter supplied by `App`.

**Verification:**

```bash
npx vitest run src/features/game/runtime/useGameSession.test.ts
npm run typecheck
```

**Expected result:** a round can complete without a score, a score can fail
without suppressing completion, and a duplicate event produces no second
operation.

**Commit:** `feat(r4): bind Wink operations to game round semantics`.

### Task 6 — Pause/resume Pixi time and layer parent mute correctly

**Files:** `src/features/game/runtime/useGameSession.ts`,
`src/features/game/runtime/useGameSession.test.ts`,
`src/features/game/runtime/useGameTicker.ts`,
`src/components/game/FruitGame.tsx`,
`src/components/game/GamePage.tsx`,
`src/utils/audio-manager.ts` only if required,
`src/integrations/wink/useWinkIntegration.ts`.

**Test first:** assert parent pause stops deterministic game advancement and
  countdown timers, duplicate pause/resume is harmless, resumed elapsed time
  excludes the paused interval, revive keeps the same round, parent mute
  suppresses audio while preserving the user’s music/SFX choices, and
  unmute restores those choices without resetting the round.

**Implementation scope:** use the bridge lifecycle callbacks to toggle a
  host-paused ref and compensate `startedAtRef`; ensure `useGameTicker` does
  not advance core state, particles, or game timers while paused; add a
  separate parent-mute layer in `audio-manager` only when existing setters
  cannot preserve user preference. Do not stop/destroy the Pixi app or recreate
  the round.

**Verification:**

```bash
npx vitest run src/features/game/runtime/useGameSession.test.ts
npm run typecheck
npm run build
```

**Expected result:** pause/resume and mute/unmute are observable in the real
  Pixi game and do not create a new round or duplicate completion.

**Commit:** `feat(r4): honor parent lifecycle without resetting rounds`.

### Task 7 — Add security-negative and top-level tests

**Files:** `src/integrations/wink/__tests__/security-negative.test.ts`,
`scripts/__tests__/wink-bridge-files.test.mjs`, `index.html`,
`public/wink-runtime-config.json`, `README.md`.

**Test first:** write tests that load the built bridge/game with no parent and
  assert `PARENT_REQUIRED` plus zero requests to runtime config, session, or
  Wink API; inject wrong source/origin/protocol/game ID/schema; assert
  capability denial, no wildcard target origin, no token/secret in URL,
  storage, console, diagnostics, or DOM; reject catalog/config drift and
  production API use in dev.

**Implementation scope:** make only the minimum testability changes needed to
  expose redacted status. Keep security assertions at the boundary and never
  weaken the certified bridge to make tests pass. Update README with commands
  for iframe harness use and explicit offline-only development.

**Verification:**

```bash
npx vitest run src/integrations/wink/__tests__/security-negative.test.ts
npm run verify:wink-bridge
```

**Expected result:** every negative path fails closed with a typed visible
  error and zero credential/API leakage.

**Commit:** `test(r4): certify iframe security negatives`.

### Task 8 — Package the exact static game and record C4 evidence

**Files:** `Dockerfile`, `.dockerignore`, `etc/default.conf.template`,
`game.config.sh`, `deploy.sh`, `README.md`, plus the C4 verification script
or fixture added under `scripts/` if needed to point the R2 harness at `dist/`.

**Test first:** add packaging tests for bridge checksum/config presence,
no secret files in the image context, exact `frame-ancestors`, no wildcard
headers, `/health`, SPA deep-link fallback, and no direct API proxy.

**Implementation scope:** build the static Vite output with the pinned bridge
verification gate; generate a secret-free environment-specific runtime config
from explicit dev/prod inputs; publish only static assets; keep harness
credentials in the Node harness process, never in the browser/image. Add a
repeatable local command that starts the built game origin and uses the
existing R2 harness in both anonymous and seeded authenticated modes.

**Verification:**

```bash
npm test
npm run typecheck
npm run build
npm run verify:wink-bridge
```

Then run the R2 harness against the real built `dist` and record redacted
evidence for both modes:

```text
anonymous: ready -> getLeaderboard -> complete -> submitScore(CAPABILITY_DENIED)
authenticated: ready -> getLeaderboard -> complete -> submitScore(success)
```

**Expected result:** all four exit commands return `0`; the same built game
passes both identity modes; anonymous denial is visible and persists no score;
authenticated submission persists one valid score; completion remains one-shot.

**Commit:** `test(r4): certify real Fruit game through R2 harness`.

## 7. Test matrix

| Area | Anonymous | Authenticated non-guest | Top-level/negative |
| --- | --- | --- | --- |
| Bridge readiness | `ready_anonymous` | `ready_authenticated` | `PARENT_REQUIRED`, zero requests |
| Capabilities | leaderboard/read + complete | leaderboard/read + complete + submit | mismatch/capability errors visible |
| Leaderboard | real `getLeaderboard`, including empty | same | network/session error, no local substitution |
| Score | `submitScore` denied, no local row | one qualifying `submitScore` | invalid score, duplicate click, stale frame |
| Completion | one `complete(roundId)` | one `complete(roundId)` | duplicate event and unmount are no-ops |
| Lifecycle | pause/resume timer and Pixi | pause/resume timer and Pixi | duplicate/stale lifecycle ignored |
| Audio | parent mute/unmute preserves user choice | same | no round reset |
| Config/security | no primary/scoped token exposed | no primary/scoped token exposed | wrong origin/source/protocol/game/schema |
| Packaging | same static build | same static build | no API proxy, no wildcard headers |

The harness evidence must use the same `dist/` output that passed build and
checksum verification. The fixture game used for C3 is not sufficient for C4.

## 8. GitNexus and change-safety protocol

Before editing an existing function/class/method, run GitNexus impact analysis
from the indexed pilot worktree:

```bash
node /Users/ddwsc/Desktop/papagroup/web/wink/.gitnexus/run.cjs impact <symbol> \
  --repo /Users/ddwsc/Desktop/papagroup/web/bo-lac-fruit-slashing-pixijs/.worktrees/codex/wink-integration-pilot \
  --branch codex/wink-integration-pilot \
  --direction upstream --depth 3
```

At minimum, run impact for `App`, `useScoreData`, `useGameSession`,
`FruitGame`, `GamePage`, `useGameTicker`, and any audio-manager method being
modified. If the result is HIGH or CRITICAL, stop and report the blast radius
before editing. New adapter files do not require impact analysis until they
are called by existing symbols; re-run impact before wiring them.

Before every commit, run GitNexus `detect_changes()` and confirm only the
planned symbols/files and execution flows changed. Unexpected symbols,
credential/storage flows, or a HIGH/CRITICAL risk requires review and no commit.

## 9. Dependency and warning disposition

- Keep the current package versions and lockfile unless a test-first task
  demonstrates a direct R4 failure.
- Do not bulk-upgrade in response to `npm audit`.
- Record the three baseline findings and their reachability in the C4 evidence.
- Revisit `vite` and transitive `postcss`/`tar` with targeted upgrades in R5 or
  release hardening, with a fresh test/build/audit run.
- Treat the existing >500 kB `pixi-vendor` warning as non-blocking. Do not
  change chunking in R4 unless a C4 browser test demonstrates a functional
  loading failure.
- Do not introduce a nested pnpm workspace or lockfile.

## 10. Explicitly deferred work

R4 does not include:

- R3 Wink FE route/feed/runtime changes (already certified with the fixture
  game at C3).
- R5 dev VPS deployment, capacity/isolation checks, seeded BE data, Playwright
  remote certification, evidence redaction pipeline, or rollback rehearsal.
- Production deployment, DNS, TLS, reverse-proxy route changes, or direct game
  subdomain blocking.
- New backend endpoints, anonymous/refresh/authority contract restoration, or
  BE schema changes.
- Tracking feed/UI migration into the game adapter.
- Analytics, reward, ad, social, or tournament features.
- Automated dependency modernization unrelated to a failing R4 gate.

## 11. C4 exit gate

C4 is complete only when all conditions are evidenced from the exact committed
pilot worktree:

1. `npm test` exits `0`.
2. `npm run typecheck` exits `0`.
3. `npm run build` exits `0`.
4. `npm run verify:wink-bridge` exits `0` and verifies bridge `9.0.0`,
   protocol `1`, and SHA-256
   `afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb`.
5. The R2 harness runs the real built Fruit game in anonymous mode:
   leaderboard read succeeds, completion succeeds, score submission returns
   visible `CAPABILITY_DENIED`, and no score row is written.
6. The same harness runs the real built game in authenticated non-guest mode:
   leaderboard read succeeds, completion succeeds, and one qualifying score
   submission succeeds.
7. The real game pauses/resumes Pixi time and game timers and responds to
   parent mute/unmute without resetting the round.
8. Top-level direct load is `PARENT_REQUIRED` with zero Wink API requests.
9. Security-negative tests reject wrong source/origin/protocol/game/schema and
   expose no token, secret, API base, or anonymous ID.
10. GitNexus `detect_changes()` reports only the intended R4 symbols/flows.
11. The C4 evidence records Node/npm versions, package-lock digest, audit
    disposition, bridge checksum, commands, and redacted harness results.

After this gate, stop. R5 must be separately approved before any dev
deployment or remote certification.
