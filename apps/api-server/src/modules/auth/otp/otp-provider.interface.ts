export interface IOtpProvider {
  sendOtp(phone: string, otp: string): Promise<boolean>;
}

export const OTP_PROVIDER = Symbol("OTP_PROVIDER");
