import type {
  WinkIntegration,
  WinkIntegrationError,
} from "../../integrations/wink/types";

interface Props {
  integration: WinkIntegration;
  operationError?: WinkIntegrationError | null;
}

function statusLabel(
  integration: WinkIntegration,
  operationError: WinkIntegrationError | null,
): string {
  if (integration.mode === "offline") {
    return "Offline development mode — non-certifying";
  }
  if (operationError) {
    return `Wink integration: ${operationError.code}`;
  }
  switch (integration.phase) {
    case "ready_anonymous":
      return "Wink ready — anonymous play";
    case "ready_authenticated":
      return integration.capabilities.submitScore
        ? "Wink ready — score submission enabled"
        : "Wink ready — score submission unavailable";
    case "renewing":
      return "Wink session renewing…";
    case "waiting_parent_hello":
      return "Waiting for Wink parent…";
    case "waiting_session":
      return "Creating Wink game session…";
    case "loading_config":
      return "Loading Wink configuration…";
    case "booting":
      return "Starting Wink integration…";
    case "error":
      return "Wink integration unavailable";
    default:
      return "Wink integration";
  }
}

export function IntegrationStatusBanner({
  integration,
  operationError = null,
}: Props) {
  const displayedError = operationError ?? integration.error;
  const isError = integration.phase === "error" || displayedError !== null;
  return (
    <div
      className="wink-integration-status"
      role="status"
      aria-live="polite"
      data-mode={integration.mode}
      data-phase={integration.phase}
      data-error={isError ? "true" : "false"}
      style={{
        position: "fixed",
        bottom: "max(10px, env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: "calc(100vw - 24px)",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${isError ? "#a33a2b" : "#74884f"}`,
        background: isError ? "rgba(255, 239, 235, 0.96)" : "rgba(250, 247, 237, 0.96)",
        color: "#2a2418",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(42,36,24,0.14)",
        pointerEvents: "none",
      }}
    >
      {statusLabel(integration, displayedError)}
      {integration.phase === "ready_anonymous" && (
        <span aria-label="score capability"> · score disabled</span>
      )}
    </div>
  );
}
