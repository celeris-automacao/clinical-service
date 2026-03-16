import { APPLICATION_EVENTS, ApplicationEventEnvelope } from '../../../shared/application/events/application-events';
import { NotificationsRepositoryPort } from '../../application/ports/notifications-repository.port';
export declare class NotificationsService {
    private readonly repository;
    constructor(repository: NotificationsRepositoryPort);
    handleAchievement(event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.achievementUnlocked>): Promise<void>;
    handleBossDefeated(event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.bossDefeated>): Promise<void>;
}
