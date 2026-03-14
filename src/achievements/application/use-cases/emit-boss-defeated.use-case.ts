import { Inject, Injectable } from '@nestjs/common';
import { ACHIEVEMENTS_EVENTS_PORT } from '../../achievements.tokens';
import { AchievementsEventsPort } from '../ports/achievements-events.port';

@Injectable()
export class EmitBossDefeatedUseCase {
  constructor(
    @Inject(ACHIEVEMENTS_EVENTS_PORT)
    private readonly eventsPort: AchievementsEventsPort,
  ) {}

  async execute(input: {
    tenantId: string;
    bossId: string;
    bossName: string;
    killerId: string;
  }) {
    await this.eventsPort.emitBossDefeated(input);
  }
}
