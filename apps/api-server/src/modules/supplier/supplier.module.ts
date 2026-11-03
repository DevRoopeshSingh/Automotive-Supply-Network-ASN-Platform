import { Module } from "@nestjs/common";
import { SupplierController } from "./supplier.controller";
import { SupplierWarehouseService } from "./supplier-warehouse.service";
import { SupplierInventoryService } from "./supplier-inventory.service";
import { InventoryImportService } from "./inventory-import.service";
import { AuthModule } from "../auth/auth.module";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [SupplierController],
  providers: [
    SupplierWarehouseService,
    SupplierInventoryService,
    InventoryImportService,
    TenantContextGuard,
    RolesGuard,
  ],
  exports: [
    SupplierWarehouseService,
    SupplierInventoryService,
    InventoryImportService,
  ],
})
export class SupplierModule {}
