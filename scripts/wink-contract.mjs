/**
 * Single source of truth for the Wink iframe pilot contract.
 *
 * Every other script in this repository derives its pins from here. Do not
 * duplicate these literals elsewhere and do not edit them per game: the bridge
 * artifact is certified by version, protocol, byte length, and checksum.
 */

export const BRIDGE_VERSION = '9.2.0';
export const PROTOCOL_VERSION = 1;
export const BRIDGE_SHA256 =
  'ec64697cd9912cd4ff8ed007ff14969280a723f4acb48dfe5bcd27c48e6ec8bc';
export const BRIDGE_BYTES = 38269;

/**
 * Provenance of the certified artifact in the Wink repository. This records
 * where the bytes came from; it is deliberately NOT compared against the live
 * HEAD of a local Wink checkout, because a game repository must build without
 * one.
 */
export const BRIDGE_SOURCE = Object.freeze({
  repository: 'wink',
  commit: 'dfcfdafb7f9a85120a7d2db4a40d5c1060d4275a',
  artifact: 'game-template/wink-bridge.js',
  manifest: 'game-template/wink-bridge.manifest.json',
});

export const LOCAL_GAME_ORIGIN = 'http://127.0.0.1:5173';
/** A Wink front end run from a checkout, framing a deployed game. */
export const LOCAL_WINK_FE_ORIGIN = 'http://localhost:3000';
export const HARNESS_ORIGIN = 'http://127.0.0.1:8787';

/**
 * There is one deployed environment. It answers on winkgames.papastudio.net, the
 * team uses it as their development environment, and its runtime still reports
 * the label `prod` because that is the label a NODE_ENV=production host had
 * before WINK_ENV existed. Both labels therefore describe the same deployment.
 *
 * `staging` is gone. It was added only because `dev` was occupied by
 * dev-winkgames.papastudio.net, which was decommissioned on 2026-08-20. The
 * certified 9.0.2 artifact still accepts a `staging` runtime config — an artifact
 * is certified by its bytes and is not rebuilt for a vocabulary change — but the
 * platform no longer derives anything for that label, so nothing can mint one.
 */
export const ENVIRONMENTS = Object.freeze([
  'local',
  'dev',
  'prod',
]);

/**
 * Per-environment public authorities and deployment naming.
 *
 * Two entries describe the same machine — see ENVIRONMENTS above — and `local`
 * describes a laptop. Nothing here has a `dev-` prefix any more; that prefix
 * belonged to a second deployment that no longer exists.
 */
export const ENVIRONMENT_CONTRACT = Object.freeze({
  // A laptop. It never deploys, so the naming fields exist only so that
  // `deriveGamePlan` stays total; the origins and API base are the ones the
  // backend already defaults to (GAME_SESSION_PARENT_ORIGINS, PUBLIC_API_BASE).
  local: Object.freeze({
    parentOrigins: Object.freeze([
      'http://127.0.0.1:3001',
      HARNESS_ORIGIN,
    ]),
    apiBase: 'http://127.0.0.1:3000/api/v1',
    domainPrefix: 'local-',
    stackName: 'papastudio-winkgames-local-games',
    imagePrefix: 'winkgames/local/',
    routerPrefix: 'winkgames-minigame-local-',
  }),
  // The one deployed environment. Its naming has no prefix and its image prefix
  // still reads `winkgames/prod/`: renaming 152 Harbor repositories and every
  // Swarm service to match a label is churn with no benefit, and the registry
  // cannot even accept writes today. The path is a name, not a claim.
  dev: Object.freeze({
    parentOrigins: Object.freeze([
      'https://winkgames.papastudio.net',
      LOCAL_WINK_FE_ORIGIN,
    ]),
    apiBase: 'https://api-winkgames.papastudio.net/api/v1',
    domainPrefix: '',
    stackName: 'papastudio-winkgames-games',
    imagePrefix: 'winkgames/prod/',
    routerPrefix: 'winkgames-minigame-prod-',
  }),
  // The same deployment under the label its runtime still reports. Kept because
  // every live game's runtime config, the backend's WINK_ENV and the front end's
  // toWinkEnvironment all resolve to `prod` today; removing it would invalidate
  // all of them at once. A real production VPS does not exist yet — when it is
  // built, this is the entry that changes and `dev` stays as it is.
  prod: Object.freeze({
    parentOrigins: Object.freeze([
      'https://winkgames.papastudio.net',
      LOCAL_WINK_FE_ORIGIN,
    ]),
    apiBase: 'https://api-winkgames.papastudio.net/api/v1',
    domainPrefix: '',
    stackName: 'papastudio-winkgames-games',
    imagePrefix: 'winkgames/prod/',
    routerPrefix: 'winkgames-minigame-prod-',
  }),
});

export const REGISTRY = 'registry2.papagroup.net';
export const DOMAIN_SUFFIX = '.papastudio.net';

/** Hostnames a game may never claim, even if its slug would produce them. */
export const RESERVED_HOSTNAMES = Object.freeze([
  'winkgames.papastudio.net',
  'api-winkgames.papastudio.net',
  // Decommissioned 2026-08-20. Still reserved so no slug can claim a name the
  // DNS zone and old documents may still point at.
  'dev-winkgames.papastudio.net',
  'dev-api-winkgames.papastudio.net',
]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Values that must never appear in a public artifact or a derived name. */
export const SECRET_SHAPE =
  /(?:TOKEN|SECRET|API_BASE|ANONYMOUS|PRIMARY|REFRESH|AUTHORIZATION|COOKIE|PASSWORD)/i;

export function isEnvironment(value) {
  return ENVIRONMENTS.includes(value);
}

export function isSlug(value) {
  return (
    typeof value === 'string' &&
    value.length >= 2 &&
    value.length <= 48 &&
    SLUG_PATTERN.test(value)
  );
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isExactOrigin(value) {
  if (typeof value !== 'string' || value === '*' || value.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

export function containsSecretShape(value) {
  if (typeof value === 'string') return SECRET_SHAPE.test(value);
  if (Array.isArray(value)) return value.some(containsSecretShape);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, child]) => SECRET_SHAPE.test(key) || containsSecretShape(child),
    );
  }
  return false;
}

/**
 * Derive every deployment name for one game from its slug and environment.
 *
 * `game.config.sh` performs the same derivation in shell so the deploy script
 * stays dependency-free; `verify-game-config.mjs` compares the two and fails
 * closed on any drift.
 */
export function deriveGamePlan({ slug, environment }) {
  if (!isSlug(slug)) {
    throw new Error('WINK_GAME_SLUG_INVALID');
  }
  if (!isEnvironment(environment)) {
    throw new Error('WINK_ENVIRONMENT_INVALID');
  }

  const env = ENVIRONMENT_CONTRACT[environment];
  const domain = `${env.domainPrefix}${slug}${DOMAIN_SUFFIX}`;
  if (RESERVED_HOSTNAMES.includes(domain)) {
    throw new Error('WINK_GAME_DOMAIN_RESERVED');
  }

  const plan = Object.freeze({
    environment,
    slug,
    domain,
    gameOrigin: `https://${domain}`,
    localGameOrigin: LOCAL_GAME_ORIGIN,
    allowedParentOrigins: Object.freeze([...env.parentOrigins]),
    apiBase: env.apiBase,
    stackName: env.stackName,
    serviceName: slug,
    serviceFullName: `${env.stackName}_${slug}`,
    routerName: `${env.routerPrefix}${slug}`,
    registry: REGISTRY,
    imageName: `${env.imagePrefix}${slug}`,
    imageRepository: `${REGISTRY}/${env.imagePrefix}${slug}`,
    protocolVersion: PROTOCOL_VERSION,
    bridgeVersion: BRIDGE_VERSION,
  });

  if (containsSecretShape(plan)) {
    throw new Error('WINK_GAME_PLAN_FORBIDDEN_SHAPE');
  }
  return plan;
}

/**
 * The exact allowed origins to register on this game's backend catalog row: the
 * deployed origin, plus the local dev origin on `dev` so the harness can load
 * the game before it is deployed anywhere.
 */
export function catalogAllowedOrigins(plan) {
  // Only `local` gets the loopback game origin. It used to be `dev`, when `dev`
  // meant a throwaway deployment; `dev` is the live catalog now, and a row there
  // that accepts a laptop origin weakens the origin check for a real game.
  return plan.environment === 'local'
    ? [plan.gameOrigin, LOCAL_GAME_ORIGIN]
    : [plan.gameOrigin];
}
