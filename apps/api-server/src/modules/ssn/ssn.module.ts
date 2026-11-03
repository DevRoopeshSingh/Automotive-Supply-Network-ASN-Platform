import { Module } from "@nestjs/common";
import { SsnController } from "./ssn.controller";
import { RfqService } from "./rfq.service";
import { QuotationService } from "./quotation.service";
import { AuthModule } from "../auth/auth.module";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [SsnController],
  providers: [RfqService, QuotationService, TenantContextGuard, RolesGuard],
  exports: [RfqService, QuotationService],
})
export class SsnModule {}
