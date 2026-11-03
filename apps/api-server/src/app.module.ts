import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";

@Module({
  imports: [HealthModule, AuthModule, BusinessesModule],
})
export class AppModule {}
