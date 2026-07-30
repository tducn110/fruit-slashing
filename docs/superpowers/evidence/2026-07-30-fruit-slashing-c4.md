# C4 evidence — Fruit Slashing Wink iframe-only pilot

Run date: 2026-07-30 (Asia/Ho_Chi_Minh)
Worktree: `codex/wink-integration-pilot`
Baseline: `43f5208266f9c70a5ff68c6b8cd7c717b63dbf5b`
R2 harness commit: `efc50ed4a27cb55f351c257350e1993d385e4a3f`

## Toolchain and artifact

Commands were run from the R4 pilot worktree:

```text
node --version       v22.11.0
npm --version        11.3.0
sha256(package-lock.json)
42c1d41fa5cc890c2e834bb6ba108bb3c82c989707d2d3b4fe2d09db2b8eac4e
```

`npm run verify:wink-bridge` passed with:

```text
bridgeVersion=9.0.0
protocolVersion=1
sha256=afe2a789466c3d68f4eec7d8cf2e718f45a29a19a5d8b9eb8c4cec10b18f31eb
gameId=11111111-1111-4111-8111-111111111111
```

The C4 runner verified the same checksum in `dist/wink-bridge.js` and
reported this deterministic dist-tree digest:

```text
9b034e9d480abb4646bd4ef98dbcbcfff3b701708a4dd81de320633f45280ecb
```

## Verification commands

All four required exit gates passed:

```text
npm test                    0  (12 files, 53 tests)
npm run typecheck           0
npm run build               0
npm run verify:wink-bridge  0
docker build --pull=false -t winkgames-fruit-slashing:r4-local-only .  0
```

The build retains the known non-blocking Vite warning for the
`pixi-vendor` chunk (`520.66 kB`); no dependency or chunking change was made
for that warning. The Docker build stage explicitly upgraded the base image's
npm to the pinned `11.3.0` before `npm ci`; only the local image was created.

## Real built-game harness result

Command:

```text
npm run certify:c4
```

The command served the committed `dist/` output, an in-memory R1 fixture, and
the certified R2 harness. Fixture secrets and the harness dev-auth secret
stayed in the Node process and are intentionally absent from this record.

| Path | Result |
| --- | --- |
| Top-level load | `PARENT_REQUIRED`; 0 runtime-config/Wink API requests |
| Anonymous readiness | `ready_anonymous` |
| Anonymous leaderboard | real read succeeded |
| Anonymous completion | 1 `wink:complete` |
| Anonymous score | visible `CAPABILITY_DENIED`; 0 score requests; 0 rows |
| Seeded authenticated readiness | `ready_authenticated`, non-guest |
| Authenticated leaderboard | real read succeeded |
| Authenticated completion | 1 `wink:complete` |
| Authenticated score | 1 qualifying request; 1 persisted row; completion/score `roundId` matched |
| Round identity | authenticated round ID differed from anonymous round ID |
| Parent pause/resume | canvas stable while paused; advanced after resume |
| Parent mute/unmute | gain snapshots `[1,0] → [0,0] → [1,0]`; user SFX preference restored |
| Browser authority/storage scan | 0 observable authority leaks; empty game local/session storage; 0 cookie bytes; 0 credential-shaped URL query leaks |
| Browser errors | 0 page errors |

## Dependency audit disposition

`npm audit --json` reported the same three reachable package findings as the
approved plan:

| Package | Severity | Reachability | R4 disposition |
| --- | --- | --- | --- |
| `vite` (`<=6.4.2`) | high | direct dev dependency | Defer targeted upgrade to R5/release hardening; static production output is not the Vite dev server |
| `postcss` (`<=8.5.17`) | high | transitive | No runtime/browser path in the static game; keep lockfile stable and review in R5 |
| `tar` (`<=7.5.20`) | critical | transitive install tooling | Not shipped in the static image; targeted lockfile remediation is deferred until release hardening |

No bulk upgrade or lockfile churn was introduced. The audit metadata was
`total=3`, `high=2`, `critical=1`; all three entries reported an available
fix, but applying it is outside the bounded R4 scope.

## Scope and security notes

- The static image contains only Vite output and the pinned bridge/config.
- Nginx emits an exact non-wildcard `frame-ancestors` policy, serves `/health`,
  and has no API proxy.
- The runtime config is exactly five public fields and contains no token,
  refresh handle, API base, anonymous ID, or secret.
- A C4-discovered Pixi teardown race was fixed with a destroyed-layer guard in
  `useGameFeedback`; the regression test runs in the full suite.
- A local image tagged `winkgames-fruit-slashing:r4-local-only` was built for
  packaging verification. No image was pushed and no deployment was performed.
