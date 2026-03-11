// src/achievements/achievements.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAchievementsRepository } from './repositories/interfaces/achievements.repository.interface';

@Injectable()
export class AchievementsService {
  constructor(
    @Inject('IAchievementsRepository')
    private readonly repository: IAchievementsRepository,
    private readonly eventEmitter: EventEmitter2
  ) { }

  async checkLevelAchievements(patientId: string, tenantId: string, newLevel: number) {
    const rewardsConfig = {
      2: { title: 'Medalha de Nível 2', icon: 'award' },
      5: { title: 'Guerreiro de Elite', icon: 'shield-star' },
      7: { title: 'Desbravador Clínico', icon: 'map' },
      10: { title: 'Guerreiro de Prata', icon: 'silver-blade' },
      20: { title: 'Mestre de Ouro', icon: 'gold-crown' }
    };

    const config = rewardsConfig[newLevel];
    if (!config) return;

    // 1. Garante que a medalha existe na clínica via Repository
    const reward = await this.repository.getOrCreateBadge(tenantId, config.title, config.icon);

    // 2. Verifica se o paciente já tem via Repository
    const alreadyClaimed = await this.repository.findClaim(patientId, reward.id);

    if (!alreadyClaimed) {
      // 3. Registra o resgate via Repository
      await this.repository.createClaim(patientId, tenantId, reward.id);

      // 4. Notifica o sistema (Feed Social e Push)
      this.eventEmitter.emit('achievement.unlocked', {
        patientId,
        tenantId,
        achievement: config.title
      });
    }
  }

  async emitGlobalVictory(tenantId: string, message: string) {
    // Disparamos o evento social para que o módulo 'social' ou 'notifications' 
    // possa avisar todo mundo no mural
    this.eventEmitter.emit('boss.defeated.global', {
      tenantId,
      message,
      timestamp: new Date(),
    });

    console.log(`🏆 Vitória Global emita para o tenant ${tenantId}: ${message}`);
  }
}