# Fruit Slashing

Fruit Slashing is a Vite/PixiJS mini-game. Its Wink integration follows the
Wink SDK v1 contract and keeps all platform calls inside
`src/integrations/wink/useWinkIntegration.ts`.

## Wink SDK v1

`index.html` loads the canonical SDK before the application entrypoint:

```html
<script src="https://sdk.winkgames.fun/v1/wink.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

The adapter initializes `window.Wink` once, forwards lifecycle and host events,
reads leaderboard/personal-best data, and submits only final scores when the
SDK grants `submitScore`. This repository does not add custom tracking,
credentials, direct Wink HTTP calls, or a custom messaging protocol.

## Local checks

```bash
npm run typecheck
npm test
npm run build
```

The build is a static Vite output in `dist/`. See `wink.game.json` for the
platform build contract.
