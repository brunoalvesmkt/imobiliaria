import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // rawBody habilitado para permitir validar a assinatura HMAC dos
  // webhooks da Meta (SECURITY.md §3) — o corpo bruto precisa sobreviver
  // intacto ao lado do JSON já parseado.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());
  app.enableCors({
    origin: process.env.APP_URL ?? "http://localhost:3000",
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

void bootstrap();
