import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export function createBullRedisConnection(config: ConfigService): Redis {
  return new Redis(config.getOrThrow<string>("REDIS_URL"), { maxRetriesPerRequest: null });
}
