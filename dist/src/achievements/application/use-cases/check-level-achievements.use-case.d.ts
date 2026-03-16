import { AchievementsRepositoryPort } from '../ports/achievements-repository.port';
import { AchievementsEventsPort } from '../ports/achievements-events.port';
export declare class CheckLevelAchievementsUseCase {
    private readonly repository;
    private readonly eventsPort;
    constructor(repository: AchievementsRepositoryPort, eventsPort: AchievementsEventsPort);
    execute(input: {
        patientId: string;
        tenantId: string;
        newLevel: number;
    }): Promise<void>;
}
