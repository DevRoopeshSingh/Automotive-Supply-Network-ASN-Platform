import { Injectable } from "@nestjs/common";
import { IOtpProvider } from "./otp-provider.interface";
import { createLogger } from "@asn/logger";

@Injectable()
export class MockOtpProvider implements IOtpProvider {
  private readonly logger = createLogger("MockOtpProvider");
  private lastOtpMap = new Map<string, string>();

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    this.lastOtpMap.set(phone, otp);

    // Only log in development/test, never in production!
    if (process.env["NODE_ENV"] !== "production") {
      this.logger.info(
        `[MOCK OTP DISPATCH] Delivered to ${phone.slice(0, 3)}****${phone.slice(-3)} | Development OTP: ${otp}`,
      );
    }

    return true;
  }

  // Helper method accessible only for unit & integration test suites
  getLatestOtpForTesting(phone: string): string | undefined {
    return this.lastOtpMap.get(phone);
  }
}
