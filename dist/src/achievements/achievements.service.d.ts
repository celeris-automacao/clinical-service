import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAchievementsRepository } from './repositories/interfaces/achievements.repository.interface';
export declare class AchievementsService {
    private readonly repository;
    private readonly eventEmitter;
    constructor(repository: IAchievementsRepository, eventEmitter: EventEmitter2);
    checkLevelAchievements(patientId: string, tenantId: string, newLevel: number): Promise<void>;
    emitGlobalVictory(tenantId: string, message: string): Promise<void>;
}
