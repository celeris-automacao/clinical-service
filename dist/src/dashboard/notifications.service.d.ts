import { NotificationsRepository } from './repositories/notifications.repository';
export declare class NotificationsService {
    private readonly repository;
    constructor(repository: NotificationsRepository);
    handleAchievement(payload: any): Promise<void>;
    handleBossDefeated(payload: any): Promise<void>;
}
