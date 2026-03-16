import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { applyTenantRlsContext, getSecurePrisma } from '../../../prisma/prisma-rls.extension';

@Injectable()
export class TenantScopedPrismaFactory {
  constructor(private readonly prisma: PrismaService) {}

  forRoot() {
    return this.prisma;
  }

  forTenantContext(input: { userId: string; tenantId: string }) {
    return getSecurePrisma(this.prisma as PrismaClient, input.userId, input.tenantId);
  }

  forTenant(tenantId: string, userId = 'system') {
    return this.forTenantContext({ userId, tenantId });
  }

  async runInTenantTransaction<T>(
    input: { userId: string; tenantId: string },
    callback: (tx: PrismaService) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await applyTenantRlsContext(tx, input.userId, input.tenantId);
      return callback(tx as PrismaService);
    });
  }
}
