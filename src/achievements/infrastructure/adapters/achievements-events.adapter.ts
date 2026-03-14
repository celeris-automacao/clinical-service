import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementsEventsPort } from '../../application/ports/achievements-events.port';

@Injectable()
export class AchievementsEventsAdapter implements AchievementsEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emitAchievementUnlocked(input: {
    patientId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void> {
    this.eventEmitter.emit('achievement.unlocked', input);
  }

  async emitBossDefeatedGlobal(input: {
    tenantId: string;
    message: string;
    timestamp: Date;
  }): Promise<void> {
    this.eventEmitter.emit('boss.defeated.global', input);
  }
}
