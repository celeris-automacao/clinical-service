import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Na v6, a conexão é direta e resiliente
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}