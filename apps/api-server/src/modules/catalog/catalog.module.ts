import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../../common/guards/roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, RolesGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
