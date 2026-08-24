export type WinkMode = 'wink' | 'offline';

export type WinkPhase =
  | 'booting'
  | 'loading_config'
  | 'waiting_parent_hello'
  | 'waiting_session'
  | 'ready_anonymous'
  | 'ready_authenticated'
  | 'renewing'
  | 'error';

export type WinkIntegrationErrorCode =
  | 'PARENT_REQUIRED'
  | 'BRIDGE_READY_TIMEOUT'
  | 'PROTOCOL_MISMATCH'
  | 'RUNTIME_CONFIG_INVALID'
  | 'SESSION_CREATE_FAILED'
  | 'SESSION_RENEWAL_FAILED'
  | 'SESSION_EXPIRED'
  | 'CAPABILITY_DENIED'
  | 'API_NETWORK_ERROR'
  | 'MESSAGE_REJECTED'
  | 'BRIDGE_MISSING'
  | 'INVALID_SCORE'
  | 'INVALID_ROUND';

export interface WinkIntegrationError {
  code: WinkIntegrationErrorCode;
  message: string;
  retryable: boolean;
}

export interface WinkCapabilities {
  getLeaderboard: boolean;
  submitScore: boolean;
  complete: boolean;
}

export interface RedactedWinkState {
  phase: WinkPhase;
  gameId: string | null;
  environment: 'dev' | 'prod' | null;
  sessionId: string | null;
  identityType: 'anonymous' | 'user' | null;
  capabilities: WinkCapabilities;
  expiresAt: string | null;
  lifecycle: {
    paused: boolean;
    muted: boolean;
  };
  error: WinkIntegrationError | null;
}

export interface WinkLeaderboardEntry {
  rank: number;
  score: number;
  playTime: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

export interface WinkLeaderboard {
  entries: readonly WinkLeaderboardEntry[];
  /**
   * The signed-in player's own best run, carrying its rank across the whole
   * board — so it is still here when that run falls outside `entries`, which it
   * usually does now that the server caps a page at 30 rows.
   *
   * Null while the player is anonymous or a guest, and null before they have
   * scored at all. All three mean the same "no personal best yet" UI; none of
   * them is an error.
   */
  me: WinkLeaderboardEntry | null;
}

export interface WinkScoreInput {
  score: number;
  playTime?: number;
  gameMode?: string;
  counter?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface WinkCompletionInput {
  roundId: string;
  playDurationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface RedactedWinkDiagnostics {
  bridgeVersion: string;
  protocolVersion: number;
  phase: WinkPhase;
  gameId: string | null;
  environment: 'dev' | 'prod' | null;
  hasSession: boolean;
  capabilities: WinkCapabilities;
  lifecycle: {
    paused: boolean;
    muted: boolean;
  };
  errorCode: WinkIntegrationErrorCode | null;
}

export interface WinkGameClient {
  subscribe(listener: (state: RedactedWinkState) => void): () => void;
  getState(): RedactedWinkState;
  getCapabilities(): WinkCapabilities;
  getLeaderboard(options?: {
    limit?: number;
    offset?: number;
  }): Promise<WinkLeaderboard>;
  submitScore(input: WinkScoreInput): Promise<void>;
  complete(input: WinkCompletionInput): Promise<void>;
  onPause(listener: () => void): () => void;
  onResume(listener: () => void): () => void;
  onMute(listener: () => void): () => void;
  onUnmute(listener: () => void): () => void;
  help(): RedactedWinkDiagnostics;
}

export interface WinkIntegration {
  mode: WinkMode;
  phase: WinkPhase;
  capabilities: WinkCapabilities;
  state: RedactedWinkState;
  client: WinkGameClient | null;
  hostPaused: boolean;
  parentMuted: boolean;
  error: WinkIntegrationError | null;
  leaderboard: readonly WinkLeaderboardEntry[];
  /** The player's own best run, or null when they have none to show. */
  personalBest: WinkLeaderboardEntry | null;
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

export type RawWinkBridgeState = {
  phase: WinkPhase;
  gameId: string | null;
  environment: 'dev' | 'prod' | null;
  sessionId: string | null;
  identityType: 'anonymous' | 'user' | null;
  capabilities: WinkCapabilities;
  expiresAt: string | null;
  lifecycle: {
    paused: boolean;
    muted: boolean;
  };
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  } | null;
};

export interface RawWinkBridge {
  subscribe(listener: (state: RawWinkBridgeState) => void): () => void;
  getState(): RawWinkBridgeState;
  getCapabilities(): WinkCapabilities;
  getLeaderboard(options?: {
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  submitScore(input: WinkScoreInput): Promise<unknown>;
  complete(input: WinkCompletionInput): void;
  onPause(listener: () => void): () => void;
  onResume(listener: () => void): () => void;
  onMute(listener: () => void): () => void;
  onUnmute(listener: () => void): () => void;
  help(): unknown;
}
