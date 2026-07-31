import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { QueuesModule } from "./queues/queues.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    QueuesModule,
  ],
})
export class AppModule {}
