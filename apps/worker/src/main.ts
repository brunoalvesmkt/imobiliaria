import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// O worker não expõe HTTP público — cria contexto Nest apenas para
// aproveitar DI/módulos ao consumir filas BullMQ (implementado na Fase 1).
async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(AppModule);
  // eslint-disable-next-line no-console
  console.log("Worker started.");
}

void bootstrap();
