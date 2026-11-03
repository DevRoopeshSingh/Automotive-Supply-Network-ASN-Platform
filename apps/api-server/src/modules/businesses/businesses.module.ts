import { Module } from "@nestjs/common";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";
import { AuthModule } from "../auth/auth.module";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, TenantContextGuard, RolesGuard],
  exports: [BusinessesService, TenantContextGuard, RolesGuard],
})
export class BusinessesModule {}
