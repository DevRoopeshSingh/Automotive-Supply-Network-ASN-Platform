import { Module } from "@nestjs/common";
import { LogisticsController } from "./logistics.controller";
import { ShipmentService } from "./shipment.service";
import { LogisticsProviderService } from "./logistics-provider.service";
import { AuthModule } from "../auth/auth.module";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [LogisticsController],
  providers: [
    ShipmentService,
    LogisticsProviderService,
    TenantContextGuard,
    RolesGuard,
  ],
  exports: [ShipmentService, LogisticsProviderService],
})
export class LogisticsModule {}
