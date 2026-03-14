import { Inject, Injectable } from '@nestjs/common';
import { ACHIEVEMENTS_EVENTS_PORT, ACHIEVEMENTS_REPOSITORY } from '../../achievements.tokens';
import { IAchievementsRepository } from '../ports/achievements-repository.port';
import { AchievementsEventsPort } from '../ports/achievements-events.port';

@Injectable()
export class CheckLevelAchievementsUseCase {
  constructor(
    @Inject(ACHIEVEMENTS_REPOSITORY)
    private readonly repository: IAchievementsRepository,
    @Inject(ACHIEVEMENTS_EVENTS_PORT)
    private readonly eventsPort: AchievementsEventsPort,
  ) {}

  async execute(input: { patientId: string; tenantId: string; newLevel: number }) {
    const rewardsConfig: Record<number, { title: string; icon: string }> = {
      2: { title: 'Medalha de Nível 2', icon: 'award' },
      5: { title: 'Guerreiro de Elite', icon: 'shield-star' },
      7: { title: 'Desbravador Clínico', icon: 'map' },
      10: { title: 'Guerreiro de Prata', icon: 'silver-blade' },
      20: { title: 'Mestre de Ouro', icon: 'gold-crown' },
    };

    const config = rewardsConfig[input.newLevel];
    if (!config) {
      return;
    }

    const reward = await this.repository.getOrCreateBadge(
      input.tenantId,
      config.title,
      config.icon,
    );

    const alreadyClaimed = await this.repository.findClaim(input.patientId, reward.id);
    if (alreadyClaimed) {
      return;
    }

    await this.repository.createClaim(input.patientId, input.tenantId, reward.id);
    await this.eventsPort.emitAchievementUnlocked({
      patientId: input.patientId,
      tenantId: input.tenantId,
      achievement: config.title,
    });
  }
}
