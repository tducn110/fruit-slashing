import type {
  RawWinkBridge,
  RawWinkBridgeState,
  RedactedWinkDiagnostics,
  RedactedWinkState,
  WinkCapabilities,
  WinkCompletionInput,
  WinkGameClient,
  WinkIntegrationErrorCode,
  WinkLeaderboard,
  WinkLeaderboardEntry,
  WinkPhase,
  WinkScoreInput,
} from './types';

declare global {
  interface Window {
    WinkBridge?: RawWinkBridge;
  }
}

const BRIDGE_METHODS = [
  'subscribe',
  'getState',
  'getCapabilities',
  'getLeaderboard',
  'submitScore',
  'complete',
  'onPause',
  'onResume',
  'onMute',
  'onUnmute',
  'help',
] as const;
const PHASES: readonly WinkPhase[] = [
  'booting',
  'loading_config',
  'waiting_parent_hello',
  'waiting_session',
  'ready_anonymous',
  'ready_authenticated',
  'renewing',
  'error',
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PLAY_TIME_SECONDS = 86_400;
const MAX_PLAY_DURATION_MS = 86_400_000;

export class WinkGameClientError
  extends Error
  implements Readonly<{
    code: WinkIntegrationErrorCode;
    retryable: boolean;
  }>
{
  readonly code: WinkIntegrationErrorCode;
  readonly retryable: boolean;

  constructor(
    code: WinkIntegrationErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'WinkGameClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isJsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every((item) => isJsonSafe(item, depth + 1));
  }
  return (
    isPlainObject(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        key.length > 0 &&
        key.length <= 128 &&
        isJsonSafe(item, depth + 1),
    )
  );
}

function errorCode(value: unknown): WinkIntegrationErrorCode | null {
  switch (value) {
    case 'PARENT_REQUIRED':
    case 'BRIDGE_READY_TIMEOUT':
    case 'PROTOCOL_MISMATCH':
    case 'RUNTIME_CONFIG_INVALID':
    case 'SESSION_CREATE_FAILED':
    case 'SESSION_RENEWAL_FAILED':
    case 'SESSION_EXPIRED':
    case 'CAPABILITY_DENIED':
    case 'API_NETWORK_ERROR':
    case 'MESSAGE_REJECTED':
    case 'BRIDGE_MISSING':
    case 'INVALID_SCORE':
    case 'INVALID_ROUND':
      return value;
    case 'FRAME_LOAD_TIMEOUT':
      return 'BRIDGE_READY_TIMEOUT';
    case 'GAME_NOT_FOUND':
    case 'GAME_IFRAME_DISABLED':
    case 'GAME_ORIGIN_INVALID':
      return 'RUNTIME_CONFIG_INVALID';
    default:
      return null;
  }
}

function normalizeError(
  value: unknown,
  fallbackCode: WinkIntegrationErrorCode = 'API_NETWORK_ERROR',
  fallbackMessage = 'Wink operation failed',
): WinkGameClientError {
  if (value instanceof WinkGameClientError) return value;
  if (isPlainObject(value)) {
    const code = errorCode(value.code);
    if (code) {
      return new WinkGameClientError(
        code,
        typeof value.message === 'string' && value.message.length > 0
          ? value.message
          : fallbackMessage,
        value.recoverable === true || value.retryable === true,
      );
    }
  }
  return new WinkGameClientError(fallbackCode, fallbackMessage, true);
}

function projectCapabilities(value: unknown): WinkCapabilities {
  if (
    !hasExactKeys(value, [
      'complete',
      'getLeaderboard',
      'submitScore',
    ]) ||
    typeof value.complete !== 'boolean' ||
    typeof value.getLeaderboard !== 'boolean' ||
    typeof value.submitScore !== 'boolean'
  ) {
    throw new WinkGameClientError(
      'MESSAGE_REJECTED',
      'Wink capabilities are invalid',
    );
  }
  return Object.freeze({
    getLeaderboard: value.getLeaderboard,
    submitScore: value.submitScore,
    complete: value.complete,
  });
}

function projectError(value: RawWinkBridgeState['error']) {
  if (value === null) return null;
  const normalized = normalizeError(
    value,
    'MESSAGE_REJECTED',
    'Wink bridge error',
  );
  return Object.freeze({
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
  });
}

function projectState(value: unknown): RedactedWinkState {
  if (!isPlainObject(value) || !PHASES.includes(value.phase as WinkPhase)) {
    throw new WinkGameClientError(
      'MESSAGE_REJECTED',
      'Wink bridge state is invalid',
    );
  }
  if (
    !(value.gameId === null || typeof value.gameId === 'string') ||
    !(
      value.environment === null ||
      value.environment === 'dev' ||
      value.environment === 'prod'
    ) ||
    !(value.sessionId === null || typeof value.sessionId === 'string') ||
    !(
      value.identityType === null ||
      value.identityType === 'anonymous' ||
      value.identityType === 'user'
    ) ||
    !(
      value.expiresAt === null ||
      (typeof value.expiresAt === 'string' &&
        Number.isFinite(Date.parse(value.expiresAt)))
    ) ||
    !hasExactKeys(value.lifecycle, ['muted', 'paused']) ||
    typeof value.lifecycle.muted !== 'boolean' ||
    typeof value.lifecycle.paused !== 'boolean' ||
    !(
      value.error === null ||
      (isPlainObject(value.error) &&
        typeof value.error.code === 'string' &&
        typeof value.error.message === 'string' &&
        typeof value.error.recoverable === 'boolean')
    )
  ) {
    throw new WinkGameClientError(
      'MESSAGE_REJECTED',
      'Wink bridge state is invalid',
    );
  }

  return Object.freeze({
    phase: value.phase as WinkPhase,
    gameId: value.gameId,
    environment: value.environment,
    sessionId: value.sessionId,
    identityType: value.identityType,
    capabilities: projectCapabilities(value.capabilities),
    expiresAt: value.expiresAt,
    lifecycle: Object.freeze({
      paused: value.lifecycle.paused,
      muted: value.lifecycle.muted,
    }),
    error: projectError(value.error as RawWinkBridgeState['error']),
  });
}

function validateLeaderboardOptions(options: unknown) {
  if (options === undefined) return undefined;
  if (
    !hasExactKeys(options, [], ['limit', 'offset']) ||
    (Object.hasOwn(options, 'limit') &&
      (!Number.isInteger(options.limit) ||
        (options.limit as number) < 1 ||
        (options.limit as number) > 500)) ||
    (Object.hasOwn(options, 'offset') &&
      (!Number.isInteger(options.offset) ||
        (options.offset as number) < 0))
  ) {
    throw new WinkGameClientError(
      'MESSAGE_REJECTED',
      'Leaderboard options are invalid',
    );
  }
  return options as { limit?: number; offset?: number };
}

function projectLeaderboardEntry(value: unknown): WinkLeaderboardEntry {
  if (
    !hasExactKeys(value, [
      'counter',
      'createdAt',
      'displayName',
      'gameMode',
      'id',
      'isAnonymous',
      'metadata',
      'playTime',
      'rank',
      'score',
      'updatedAt',
      'userId',
    ]) ||
    typeof value.id !== 'string' ||
    !(value.userId === null || typeof value.userId === 'string') ||
    typeof value.isAnonymous !== 'boolean' ||
    !(
      value.displayName === null ||
      typeof value.displayName === 'string'
    ) ||
    !Number.isInteger(value.score) ||
    (value.score as number) < 0 ||
    !(
      value.playTime === null ||
      (Number.isInteger(value.playTime) &&
        (value.playTime as number) >= 0)
    ) ||
    !(
      value.gameMode === null ||
      typeof value.gameMode === 'string'
    ) ||
    !(
      value.counter === null ||
      (Number.isInteger(value.counter) &&
        (value.counter as number) >= 0)
    ) ||
    !(
      value.metadata === null ||
      (isPlainObject(value.metadata) && isJsonSafe(value.metadata))
    ) ||
    !Number.isInteger(value.rank) ||
    (value.rank as number) < 0 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.updatedAt))
  ) {
    throw new WinkGameClientError(
      'API_NETWORK_ERROR',
      'Leaderboard response is invalid',
      true,
    );
  }

  return Object.freeze({
    rank: value.rank as number,
    score: value.score as number,
    playTime: value.playTime as number | null,
    displayName: value.displayName as string | null,
    avatarUrl: null,
    createdAt: value.createdAt,
  });
}

function projectLeaderboard(value: unknown): WinkLeaderboard {
  // `me` is accepted as an optional key, not a required one: a server that does
  // not send it yet, and a reader with no personal best, must both come out as
  // null rather than as a rejected response.
  if (
    !hasExactKeys(value, ['entries', 'total'], ['me']) ||
    !Array.isArray(value.entries) ||
    !Number.isInteger(value.total) ||
    (value.total as number) < 0
  ) {
    throw new WinkGameClientError(
      'API_NETWORK_ERROR',
      'Leaderboard response is invalid',
      true,
    );
  }

  return Object.freeze({
    entries: Object.freeze(value.entries.map(projectLeaderboardEntry)),
    me:
      value.me === undefined || value.me === null
        ? null
        : projectLeaderboardEntry(value.me),
  });
}

function validateScoreInput(input: unknown): {
  input: WinkScoreInput;
  roundId: string | null;
} {
  if (
    !hasExactKeys(input, ['score'], [
      'counter',
      'gameMode',
      'metadata',
      'playTime',
    ]) ||
    !Number.isInteger(input.score) ||
    (input.score as number) < 0 ||
    (Object.hasOwn(input, 'playTime') &&
      (!Number.isInteger(input.playTime) ||
        (input.playTime as number) < 0 ||
        (input.playTime as number) > MAX_PLAY_TIME_SECONDS)) ||
    (Object.hasOwn(input, 'gameMode') &&
      (typeof input.gameMode !== 'string' ||
        input.gameMode.length > 100)) ||
    (Object.hasOwn(input, 'counter') &&
      (!Number.isInteger(input.counter) ||
        (input.counter as number) < 0)) ||
    (Object.hasOwn(input, 'metadata') &&
      (!isPlainObject(input.metadata) || !isJsonSafe(input.metadata)))
  ) {
    throw new WinkGameClientError(
      'INVALID_SCORE',
      'Final score input is invalid',
    );
  }

  const roundId =
    isPlainObject(input.metadata) &&
    Object.hasOwn(input.metadata, 'roundId')
      ? input.metadata.roundId
      : null;
  if (
    roundId !== null &&
    (typeof roundId !== 'string' || !UUID_PATTERN.test(roundId))
  ) {
    throw new WinkGameClientError(
      'INVALID_ROUND',
      'Round identifier is invalid',
    );
  }
  return {
    input: input as unknown as WinkScoreInput,
    roundId: roundId as string | null,
  };
}

function assertSubmitScoreResult(value: unknown): void {
  if (
    !hasExactKeys(value, ['entry', 'isNewBest', 'previousBest']) ||
    typeof value.isNewBest !== 'boolean' ||
    !(
      value.previousBest === null ||
      (Number.isInteger(value.previousBest) &&
        (value.previousBest as number) >= 0)
    )
  ) {
    throw new WinkGameClientError(
      'API_NETWORK_ERROR',
      'Score response is invalid',
      true,
    );
  }
  projectLeaderboardEntry(value.entry);
}

function validateCompletionInput(input: unknown): WinkCompletionInput {
  if (
    !hasExactKeys(input, ['roundId'], ['metadata', 'playDurationMs']) ||
    typeof input.roundId !== 'string' ||
    !UUID_PATTERN.test(input.roundId) ||
    (Object.hasOwn(input, 'playDurationMs') &&
      (!Number.isInteger(input.playDurationMs) ||
        (input.playDurationMs as number) < 0 ||
        (input.playDurationMs as number) > MAX_PLAY_DURATION_MS)) ||
    (Object.hasOwn(input, 'metadata') &&
      (!isPlainObject(input.metadata) || !isJsonSafe(input.metadata)))
  ) {
    throw new WinkGameClientError(
      'INVALID_ROUND',
      'Round completion input is invalid',
    );
  }
  return input as unknown as WinkCompletionInput;
}

function requireBridge(bridge: RawWinkBridge | null): RawWinkBridge {
  if (
    !bridge ||
    BRIDGE_METHODS.some(
      (method) => typeof bridge[method] !== 'function',
    )
  ) {
    throw new WinkGameClientError(
      'BRIDGE_MISSING',
      'Certified Wink bridge is not installed',
    );
  }
  return bridge;
}

export function getInstalledWinkBridge(): RawWinkBridge | null {
  return typeof window === 'undefined' ? null : window.WinkBridge ?? null;
}

export function createWinkGameClient(
  source: RawWinkBridge | null = getInstalledWinkBridge(),
): WinkGameClient {
  const bridge = requireBridge(source);
  const scorePromises = new Map<string, Promise<void>>();
  const completionPromises = new Map<string, Promise<void>>();

  function submitScore(input: WinkScoreInput): Promise<void> {
    let validated: ReturnType<typeof validateScoreInput>;
    try {
      validated = validateScoreInput(input);
    } catch (error) {
      return Promise.reject(normalizeError(error));
    }
    const existing = validated.roundId
      ? scorePromises.get(validated.roundId)
      : null;
    if (existing) return existing;

    let rawResult: unknown;
    try {
      rawResult = bridge.submitScore(validated.input);
    } catch (error) {
      const operation = Promise.reject(normalizeError(error));
      if (validated.roundId) {
        scorePromises.set(validated.roundId, operation);
      }
      return operation;
    }
    const operation = Promise.resolve(rawResult)
      .then((result) => {
        assertSubmitScoreResult(result);
      })
      .catch((error) => {
        throw normalizeError(error);
      });
    if (validated.roundId) {
      scorePromises.set(validated.roundId, operation);
    }
    return operation;
  }

  function complete(input: WinkCompletionInput): Promise<void> {
    let validated: WinkCompletionInput;
    try {
      validated = validateCompletionInput(input);
    } catch (error) {
      return Promise.reject(normalizeError(error));
    }
    const existing = completionPromises.get(validated.roundId);
    if (existing) return existing;

    let rawResult: void;
    try {
      rawResult = bridge.complete(validated);
    } catch (error) {
      const operation = Promise.reject(
        normalizeError(error, 'MESSAGE_REJECTED'),
      );
      completionPromises.set(validated.roundId, operation);
      return operation;
    }
    const operation = Promise.resolve(rawResult)
      .catch((error) => {
        throw normalizeError(error, 'MESSAGE_REJECTED');
      });
    completionPromises.set(validated.roundId, operation);
    return operation;
  }

  function lifecycle(
    register: (listener: () => void) => () => void,
    listener: () => void,
  ) {
    if (typeof listener !== 'function') {
      throw new WinkGameClientError(
        'MESSAGE_REJECTED',
        'Lifecycle listener is invalid',
      );
    }
    try {
      const unsubscribe = register(listener);
      return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    } catch (error) {
      throw normalizeError(error, 'MESSAGE_REJECTED');
    }
  }

  const client: WinkGameClient = {
    subscribe(listener: (state: RedactedWinkState) => void) {
      if (typeof listener !== 'function') {
        throw new WinkGameClientError(
          'MESSAGE_REJECTED',
          'State listener is invalid',
        );
      }
      try {
        const unsubscribe = bridge.subscribe((state) => {
          listener(projectState(state));
        });
        return typeof unsubscribe === 'function' ? unsubscribe : () => {};
      } catch (error) {
        throw normalizeError(error, 'MESSAGE_REJECTED');
      }
    },
    getState() {
      try {
        return projectState(bridge.getState());
      } catch (error) {
        throw normalizeError(error, 'MESSAGE_REJECTED');
      }
    },
    getCapabilities() {
      try {
        return projectCapabilities(bridge.getCapabilities());
      } catch (error) {
        throw normalizeError(error, 'MESSAGE_REJECTED');
      }
    },
    async getLeaderboard(options?: { limit?: number; offset?: number }) {
      try {
        return projectLeaderboard(
          await bridge.getLeaderboard(
            validateLeaderboardOptions(options),
          ),
        );
      } catch (error) {
        throw normalizeError(error);
      }
    },
    submitScore,
    complete,
    onPause: (listener: () => void) =>
      lifecycle(bridge.onPause.bind(bridge), listener),
    onResume: (listener: () => void) =>
      lifecycle(bridge.onResume.bind(bridge), listener),
    onMute: (listener: () => void) =>
      lifecycle(bridge.onMute.bind(bridge), listener),
    onUnmute: (listener: () => void) =>
      lifecycle(bridge.onUnmute.bind(bridge), listener),
    help(): RedactedWinkDiagnostics {
      const state = projectState(bridge.getState());
      return Object.freeze({
        bridgeVersion: '9.0.1',
        protocolVersion: 1,
        phase: state.phase,
        gameId: state.gameId,
        environment: state.environment,
        hasSession: state.sessionId !== null,
        capabilities: state.capabilities,
        lifecycle: state.lifecycle,
        errorCode: state.error?.code ?? null,
      });
    },
  };
  return Object.freeze(client);
}
