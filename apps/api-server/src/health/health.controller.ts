import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("System")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({ status: 200, description: "Service is operational" })
  check() {
    return {
      status: "ok",
      service: "asn-api-server",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    };
  }
}
