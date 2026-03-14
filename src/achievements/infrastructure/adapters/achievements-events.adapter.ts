import { Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_EVENTS,
  createApplicationEvent,
} from '../../../shared/application/events/application-events';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';
import { AchievementsEventsPort } from '../../application/ports/achievements-events.port';

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
    this.eventBus.publish(createApplicationEvent(APPLICATION_EVENTS.achievementUnlocked, input));
  }

  async emitBossDefeated(input: {
    tenantId: string;
    bossId: string;
    bossName: string;
    killerId: string;
  }): Promise<void> {
    this.eventBus.publish(createApplicationEvent(APPLICATION_EVENTS.bossDefeated, input));
  }

  async emitBossDefeatedGlobal(input: {
    tenantId: string;
    message: string;
    timestamp: Date;
  }): Promise<void> {
    this.eventBus.publish(createApplicationEvent(APPLICATION_EVENTS.bossDefeatedGlobal, input));
  }
}
