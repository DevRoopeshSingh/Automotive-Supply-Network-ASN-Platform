import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  RequestOtpSchema,
  RequestOtpInput,
  VerifyOtpSchema,
  VerifyOtpInput,
  RefreshTokenSchema,
  RefreshTokenInput,
  UpdateProfileSchema,
  UpdateProfileInput,
} from "@asn/validators";
import { UserContext, ApiResponse as IApiResponse } from "@asn/types";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a one-time password (OTP) via phone" })
  @ApiResponse({ status: 200, description: "OTP request evaluated" })
  async requestOtp(
    @Body(new ZodValidationPipe(RequestOtpSchema)) body: RequestOtpInput,
  ): Promise<IApiResponse<{ message: string }>> {
    const result = await this.authService.requestOtp(body.phone);
    return {
      success: true,
      data: { message: result.message },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify phone OTP and obtain authentication tokens",
  })
  @ApiResponse({ status: 200, description: "User authenticated successfully" })
  async verifyOtp(
    @Body(new ZodValidationPipe(VerifyOtpSchema)) body: VerifyOtpInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IApiResponse<{ user: UserContext; tokens: any }>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    const result = await this.authService.verifyOtp(body.phone, body.otp, meta);

    // Set secure HttpOnly cookie for web clients
    res.cookie("asn_refresh_token", result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });

    return {
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate and refresh access token" })
  @ApiResponse({ status: 200, description: "Tokens rotated successfully" })
  async refresh(
    @Body() body: RefreshTokenInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IApiResponse<{ tokens: any }>> {
    // Read from body or cookie
    const token = body?.refreshToken || req.cookies?.["asn_refresh_token"];
    const validated = RefreshTokenSchema.parse({ refreshToken: token });

    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    const tokens = await this.authService.refreshTokens(
      validated.refreshToken,
      meta,
    );

    res.cookie("asn_refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });

    return {
      success: true,
      data: { tokens },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Logout and revoke active session" })
  async logout(
    @CurrentUser() user: UserContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IApiResponse<{ message: string }>> {
    const meta = {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    await this.authService.logout(user.id, undefined, meta);

    res.clearCookie("asn_refresh_token", { path: "/api/v1/auth" });

    return {
      success: true,
      data: { message: "Logged out successfully" },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current authenticated user profile and memberships",
  })
  async getCurrentUser(
    @CurrentUser() user: UserContext,
  ): Promise<IApiResponse<UserContext>> {
    const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      data: profile,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update user profile (name, email)" })
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileInput,
  ): Promise<IApiResponse<UserContext>> {
    const updated = await this.authService.updateProfile(user.id, body);
    return {
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
