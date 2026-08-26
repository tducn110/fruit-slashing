import { useTranslation } from "react-i18next";
import type {
  WinkIntegration,
  WinkIntegrationError,
} from "../../integrations/wink/types";

interface Props {
  integration: WinkIntegration;
  operationError?: WinkIntegrationError | null;
}

export function IntegrationStatusBanner({
  integration,
  operationError = null,
}: Props) {
  const { t } = useTranslation();

  if (operationError?.code !== "CAPABILITY_DENIED") return null;

  return (
    <div
      className="wink-integration-status"
      role="alert"
      aria-live="assertive"
      data-mode={integration.mode}
      data-phase={integration.phase}
      data-error="true"
      style={{
        position: "fixed",
        bottom: "max(10px, env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: "calc(100vw - 24px)",
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid #a33a2b",
        background: "rgba(255, 239, 235, 0.96)",
        color: "#2a2418",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(42,36,24,0.14)",
        pointerEvents: "none",
      }}
    >
      {t('game.login_to_submit')}
    </div>
  );
}
