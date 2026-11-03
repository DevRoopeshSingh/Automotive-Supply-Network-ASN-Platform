import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import { createLogger } from "@asn/logger";

dotenv.config();

const logger = createLogger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.enableCors({
    origin: process.env["CORS_ORIGIN"] || "*",
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
      "Modular Monolith Backend API for ASN Commerce, Logistics & Supplier OS",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
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
