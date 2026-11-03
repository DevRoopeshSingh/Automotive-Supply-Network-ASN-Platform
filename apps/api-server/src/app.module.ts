import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { CatalogModule } from "./modules/catalog/catalog.module";

@Module({
  imports: [HealthModule, AuthModule, BusinessesModule, CatalogModule],
})
export class AppModule {}
