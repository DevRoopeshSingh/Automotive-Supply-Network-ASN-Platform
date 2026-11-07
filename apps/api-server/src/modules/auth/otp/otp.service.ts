import {
  Injectable,
  Inject,
  BadRequestException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import * as crypto from "crypto";
import { prisma } from "@asn/database";
import { RedisService } from "../../../common/redis/redis.service";
import { envConfig } from "../../../common/config/env.config";
import { OTP_PROVIDER, type IOtpProvider } from "./otp-provider.interface";
import { createLogger } from "@asn/logger";

@Injectable()
export class OtpService {
  private readonly logger = createLogger("OtpService");
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_VERIFICATION_ATTEMPTS = 5;
  private readonly COOLDOWN_SECONDS = 60;
  private readonly RATE_LIMIT_MAX = 5;
  private readonly RATE_LIMIT_WINDOW_SECONDS = 900; // 15 mins

  constructor(
    @Inject(OTP_PROVIDER) private readonly otpProvider: IOtpProvider,
    private readonly redisService: RedisService,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith("0")) {
      return digits.slice(1);
    }
    if (digits.length === 10) {
      return digits;
    }
    throw new BadRequestException(
      "Please provide a valid 10-digit Indian mobile number",
    );
  }

  private hashOtp(otp: string): string {
    return crypto
      .createHash("sha256")
      .update(otp + envConfig.JWT_SECRET)
      .digest("hex");
  }

  async requestOtp(
    rawPhone: string,
  ): Promise<{ success: boolean; message: string }> {
    const phone = this.normalizePhone(rawPhone);

    // 1. Rate Limiting: Check cooldown (60s)
    const cooldownKey = `otp:cooldown:${phone}`;
    const isInCooldown = await this.redisService.get(cooldownKey);
    if (isInCooldown) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "OTP_COOLDOWN",
            message: "Please wait 60 seconds before requesting another OTP.",
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Rate Limiting: Check sliding window request count (max 5 in 15 mins)
    const rateKey = `otp:rate:${phone}`;
    const requestCount = await this.redisService.incr(
      rateKey,
      this.RATE_LIMIT_WINDOW_SECONDS,
    );
    if (requestCount > this.RATE_LIMIT_MAX) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "OTP_RATE_LIMIT_EXCEEDED",
            message:
              "Too many OTP requests. Please try again after 15 minutes.",
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Generate 6-digit cryptographically random OTP
    const otpNumber = crypto.randomInt(100000, 999999).toString();
    const otpHash = this.hashOtp(otpNumber);
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // 4. Invalidate any previous unused OTPs for this phone
    await prisma.otpRecord.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    // 5. Store hashed OTP in database
    await prisma.otpRecord.create({
      data: {
        phone,
        otpHash,
        expiresAt,
        attempts: 0,
        isUsed: false,
      },
    });

    // 6. Set cooldown key in Redis
    await this.redisService.set(cooldownKey, "1", this.COOLDOWN_SECONDS);

    // 7. Dispatch via Provider
    await this.otpProvider.sendOtp(phone, otpNumber);

    this.logger.info(
      `OTP requested for phone: ${phone.slice(0, 3)}****${phone.slice(-3)}`,
    );

    // Return uniform message to prevent user enumeration
    return {
      success: true,
      message: "If the mobile number is valid, an OTP has been dispatched.",
    };
  }

  async verifyOtp(rawPhone: string, otp: string): Promise<boolean> {
    const phone = this.normalizePhone(rawPhone);

    const record = await prisma.otpRecord.findFirst({
      where: {
        phone,
        isUsed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_OTP",
          message: "Invalid or expired OTP. Please request a new code.",
        },
      });
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      await prisma.otpRecord.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw new BadRequestException({
        success: false,
        error: {
          code: "OTP_EXPIRED",
          message: "This OTP has expired. Please request a new code.",
        },
      });
    }

    // Check max attempts
    if (record.attempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      await prisma.otpRecord.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw new BadRequestException({
        success: false,
        error: {
          code: "MAX_ATTEMPTS_EXCEEDED",
          message:
            "Maximum verification attempts exceeded. Please request a new OTP.",
        },
      });
    }

    // Timing-safe hash comparison (with development/test fallback in non-production)
    const isDevDefaultOtp =
      process.env["NODE_ENV"] !== "production" && otp === "123456";

    const providedHash = this.hashOtp(otp);
    const isHashValid = crypto.timingSafeEqual(
      Buffer.from(providedHash, "utf8"),
      Buffer.from(record.otpHash, "utf8"),
    );

    if (!isHashValid && !isDevDefaultOtp) {
      await prisma.otpRecord.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_OTP",
          message: "Invalid OTP code entered.",
        },
      });
    }

    // Mark as used (Single-use enforcement)
    await prisma.otpRecord.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    // Clear cooldown on successful verification
    await this.redisService.del(`otp:cooldown:${phone}`);

    return true;
  }
}
