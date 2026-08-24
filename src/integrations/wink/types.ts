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
  environment: 'local' | 'dev' | 'prod' | null;
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

export interface WinkPersonalBest {
  me: WinkLeaderboardEntry | null;
}

export interface WinkLeaderboardEntry {
  rank: number;
  score: number;
  playTime: number | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
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
  environment: 'local' | 'dev' | 'prod' | null;
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
  getPersonalBest(): Promise<WinkPersonalBest>;
  getLeaderboard(options?: {
    limit?: number;
    offset?: number;
  }): Promise<readonly WinkLeaderboardEntry[]>;
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
  personalBest: WinkLeaderboardEntry | null;
  refreshPersonalBest(): Promise<void>;
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
  environment: 'local' | 'dev' | 'prod' | null;
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
  getPersonalBest(): Promise<unknown>;
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
