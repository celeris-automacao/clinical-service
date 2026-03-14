import { Inject, Injectable } from '@nestjs/common';
import { AchievementsEventsPort } from '../../application/ports/achievements-events.port';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';

@Injectable()
export class AchievementsEventsAdapter implements AchievementsEventsPort {
  constructor(
    @Inject(APPLICATION_EVENT_BUS)
    private readonly eventBus: ApplicationEventBusPort,
  ) {}

  async emitAchievementUnlocked(input: {
    patientId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void> {
    this.eventBus.emit('achievement.unlocked', input);
  }

  async emitBossDefeatedGlobal(input: {
    tenantId: string;
    message: string;
    timestamp: Date;
  }): Promise<void> {
    this.eventBus.emit('boss.defeated.global', input);
  }
}
