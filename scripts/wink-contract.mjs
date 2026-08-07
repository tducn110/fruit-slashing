export const BRIDGE_VERSION = '9.0.1';
export const PROTOCOL_VERSION = 1;
export const REGISTRY = 'registry2.papagroup.net';
export const DOMAIN_SUFFIX = '.papastudio.net';

export const ENVIRONMENT_CONTRACT = Object.freeze({
  dev: Object.freeze({
    parentOrigins: Object.freeze([
      'https://dev-winkgames.papastudio.net',
      'http://127.0.0.1:8787',
    ]),
    domainPrefix: 'dev-',
    stackName: 'papastudio-winkgames-dev-games',
    imagePrefix: 'winkgames/dev/',
    routerPrefix: 'winkgames-minigame-dev-',
  }),
  prod: Object.freeze({
    parentOrigins: Object.freeze([
      'https://winkgames.papastudio.net',
      'http://localhost:3000',
    ]),
    domainPrefix: '',
    stackName: 'papastudio-winkgames-games',
    imagePrefix: 'winkgames/prod/',
    routerPrefix: 'winkgames-minigame-prod-',
  }),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function deriveGamePlan({ slug, environment }) {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new Error('WINK_GAME_SLUG_INVALID');
  }
  const contract = ENVIRONMENT_CONTRACT[environment];
  if (!contract) throw new Error('WINK_ENVIRONMENT_INVALID');

  const domain = `${contract.domainPrefix}${slug}${DOMAIN_SUFFIX}`;
  return Object.freeze({
    environment,
    slug,
    domain,
    gameOrigin: `https://${domain}`,
    allowedParentOrigins: contract.parentOrigins,
    stackName: contract.stackName,
    serviceName: slug,
    serviceFullName: `${contract.stackName}_${slug}`,
    routerName: `${contract.routerPrefix}${slug}`,
    registry: REGISTRY,
    imageName: `${contract.imagePrefix}${slug}`,
    imageRepository: `${REGISTRY}/${contract.imagePrefix}${slug}`,
  });
}
