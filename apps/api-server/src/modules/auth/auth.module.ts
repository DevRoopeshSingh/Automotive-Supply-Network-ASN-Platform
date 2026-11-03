import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp/otp.service";
import { SessionService } from "./session/session.service";
import { MockOtpProvider } from "./otp/mock-otp.provider";
import { OTP_PROVIDER } from "./otp/otp-provider.interface";
import { RedisService } from "../../common/redis/redis.service";
import { AuditService } from "../../common/audit/audit.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { envConfig } from "../../common/config/env.config";

@Module({
  imports: [
    JwtModule.register({
      secret: envConfig.JWT_SECRET,
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    AuditService,
    RedisService,
    JwtAuthGuard,
    {
      provide: OTP_PROVIDER,
      useClass: MockOtpProvider,
    },
  ],
  exports: [
    AuthService,
    SessionService,
    JwtAuthGuard,
    JwtModule,
    RedisService,
    AuditService,
    OTP_PROVIDER,
  ],
})
export class AuthModule {}
