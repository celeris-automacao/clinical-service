// src/game/infrastructure/persistence/prisma-game.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GameRepositoryPort } from '../../application/ports/game-repository.port';

@Injectable()
export class GameRepository implements GameRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findPlayerProgress(patientId: string) {
    return this.prisma.playerStats.findUnique({
      where: { patientId },
    });
  }

  async findActiveBoss(tenantId: string) {
    return this.prisma.bossBattle.findFirst({
      where: { tenantId, isActive: true },
    });
  }
}
