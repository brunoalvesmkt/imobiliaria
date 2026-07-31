import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * BullMQ exige `maxRetriesPerRequest: null` na conexão usada por
 * filas/workers (comandos bloqueantes) — por isso instanciamos o client
 * ioredis nós mesmos em vez de deixar o BullMQ criar um com defaults.
 */
export function createBullRedisConnection(config: ConfigService): Redis {
  return new Redis(config.getOrThrow<string>("REDIS_URL"), { maxRetriesPerRequest: null });
}
