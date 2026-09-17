# Gates: Complete Synchronization with Mini-game Standards

- [x] GATE-1: document.documentElement.lang is synced on init and language change in src/i18n.ts
  CHECK: grep -q "document.documentElement.lang" src/i18n.ts
  EXPECT: 0
  RESULT: PASS

- [x] GATE-2: getPersonalBest called on boot and not inferred from leaderboard rows in useWinkIntegration.ts
  CHECK: grep -q "getPersonalBest" src/integrations/wink/useWinkIntegration.ts && ! grep -q "setPersonalBest(board\.me)" src/integrations/wink/useWinkIntegration.ts
  EXPECT: 0
  RESULT: PASS

- [x] GATE-3: BGM uses HTMLAudioElement streaming (Dual-Engine architecture)
  CHECK: grep -q "new Audio" src/utils/audio-manager.ts && ! grep -q "buffers\.bgm" src/utils/audio-manager.ts
  EXPECT: 0
  RESULT: PASS

- [x] GATE-4: TypeScript typecheck passes
  CHECK: npm run typecheck
  EXPECT: 0
  RESULT: PASS

- [x] GATE-5: Vitest test suite passes
  CHECK: npm test
  EXPECT: 0
  RESULT: PASS (17 test files passed, 52/52 tests)

- [x] GATE-6: Vite production build passes
  CHECK: npm run build
  EXPECT: 0
  RESULT: PASS (built in 4.63s)
