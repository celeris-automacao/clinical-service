import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { AchievementsEventsPort } from '../../application/ports/achievements-events.port';
export declare class AchievementsEventsAdapter implements AchievementsEventsPort {
    private readonly eventBus;
    constructor(eventBus: ApplicationEventBusPort);
    emitAchievementUnlocked(input: {
        patientId: string;
        tenantId: string;
        achievement: string;
    }): Promise<void>;
    emitBossDefeated(input: {
        tenantId: string;
        bossId: string;
        bossName: string;
        killerId: string;
    }): Promise<void>;
    emitBossDefeatedGlobal(input: {
        tenantId: string;
        message: string;
        timestamp: Date;
    }): Promise<void>;
}
