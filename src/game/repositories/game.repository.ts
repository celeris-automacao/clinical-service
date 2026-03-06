// src/game/repositories/game.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IGameRepository } from './interfaces/game.repository.interface';

@Injectable()
export class GameRepository implements IGameRepository {
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