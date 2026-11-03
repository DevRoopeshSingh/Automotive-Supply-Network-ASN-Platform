import { describe, it, expect } from "vitest";
import { HealthController } from "./health/health.controller";

describe("HealthController", () => {
  it("should return service health status", () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("asn-api-server");
    expect(result.timestamp).toBeDefined();
  });
});
