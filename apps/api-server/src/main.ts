import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import { createLogger } from "@asn/logger";

dotenv.config();

const logger = createLogger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  const corsOrigin = process.env["CORS_ORIGIN"];
  const allowedOrigins =
    corsOrigin && corsOrigin !== "*"
      ? corsOrigin.split(",").map((o) => o.trim())
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
        ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser agents (cURL, mobile apps, health monitors) or matching origins
      if (!origin || allowedOrigins.includes(origin) || corsOrigin === "*") {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
      }
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global API Route Prefix
  app.setGlobalPrefix("api/v1", {
    exclude: ["health"],
  });

  // Swagger OpenAPI Setup
  const config = new DocumentBuilder()
    .setTitle("Automotive Supply Network (ASN) Core API")
    .setDescription(
      "Modular Monolith Backend API for ASN Commerce, Multi-Tenant Auth, Logistics & Supplier OS",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .addTag(
      "Authentication",
      "Phone OTP login, refresh rotation and profile endpoints",
    )
    .addTag(
      "Business Accounts",
      "Multi-tenant organization accounts, switching and invitations",
    )
    .addTag(
      "Catalog & Vehicle Fitment",
      "Automotive product master, category hierarchy, vehicle compatibility engine",
    )
    .addTag(
      "Supplier OS — Warehouses & Inventory",
      "Multi-warehouse inventory, real-time stock control, and bulk catalog import",
    )
    .addTag(
      "Supplier Supply Network (SSN) — Wholesale & B2B RFQs",
      "Supplier-to-supplier wholesale sourcing, quotations, negotiation, and atomic RFQ awards",
    )
    .addTag(
      "Logistics & Multi-Leg Delivery Orchestration",
      "Shipment creation, multi-leg delivery planning, 3PL/fleet assignment, tracking ledger, and Proof of Delivery (POD)",
    )
    .addTag("System", "Health and telemetry")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env["PORT"] || 4000;
  await app.listen(port);
  logger.info(`🚀 ASN API Server successfully launched on port ${port}`);
  logger.info(
    `📖 OpenAPI Documentation accessible at http://localhost:${port}/docs`,
  );
}

bootstrap().catch((err) => {
  logger.error("Fatal error during API server boot", err);
  process.exit(1);
});
