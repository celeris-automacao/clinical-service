// src/dashboard/dashboard.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { IDashboardRepository } from './repositories/interfaces/dashboard.repository.interface';

@Injectable()
export class DashboardService {
  constructor(
    @Inject('IDashboardRepository') 
    private readonly repository: IDashboardRepository
  ) { }

  /**
   * Visão Geral: Engajamento, Alertas e Performance 
   */
  async getClinicOverview(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Início do dia 

    const [activeCount, achievements, ranking] = await Promise.all([
      this.repository.countActivePlayers(tenantId, today), 
      this.repository.findRecentAchievements(tenantId, 5), 
      this.repository.findTopPlayers(tenantId, 3) 
    ]);

    return {
      activeToday: activeCount,
      recentAchievements: achievements.map(a => ({
        patient: a.patient.name,
        content: a.content,
        date: a.createdAt
      })), 
      ranking: ranking.map(p => ({
        name: p.patient.name,
        damage: Number(p.totalDamageDealt),
        level: p.currentLevel
      })) 
    };
  }

  /**
   * Alerta de Inatividade: Identifica pacientes que não treinam há X dias 
   */
  async getMissingPatients(tenantId: string, daysInactive: number = 3) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysInactive); 

    const activity = await this.repository.getTaskCompletionsHistory(tenantId); 

    const lastActivities = new Map<string, Date>();
    
    
    activity.forEach(record => {
      if (!lastActivities.has(record.patientId)) {
        lastActivities.set(record.patientId, record.completedAt);
      }
    });

    
    return Array.from(lastActivities.entries())
      .filter(([_, lastDate]) => lastDate < thresholdDate)
      .map(([patientId, lastDate]) => ({
        patientId,
        lastActivity: lastDate,
        status: 'Inativo'
      })); 
  }
}