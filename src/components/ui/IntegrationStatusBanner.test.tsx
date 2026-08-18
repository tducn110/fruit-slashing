import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WinkIntegration } from "../../integrations/wink/types";
import { IntegrationStatusBanner } from "./IntegrationStatusBanner";

const integration = {
  mode: "wink",
  phase: "ready_anonymous",
} as WinkIntegration;

describe("IntegrationStatusBanner", () => {
  it("stays hidden during normal anonymous play", () => {
    expect(
      renderToStaticMarkup(
        <IntegrationStatusBanner integration={integration} />,
      ),
    ).toBe("");
  });

  it("stays hidden for errors unrelated to a blocked score submission", () => {
    expect(
      renderToStaticMarkup(
        <IntegrationStatusBanner
          integration={integration}
          operationError={{
            code: "API_NETWORK_ERROR",
            message: "Network unavailable",
            retryable: true,
          }}
        />,
      ),
    ).toBe("");
  });

  it("shows a concise alert after score submission is denied", () => {
    const markup = renderToStaticMarkup(
      <IntegrationStatusBanner
        integration={integration}
        operationError={{
          code: "CAPABILITY_DENIED",
          message: "Score submission denied",
          retryable: false,
        }}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Không thể gửi điểm");
    expect(markup).not.toContain("Wink ready");
  });
});
