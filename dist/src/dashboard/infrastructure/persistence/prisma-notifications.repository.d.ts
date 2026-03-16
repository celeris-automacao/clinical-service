import { NotificationsRepositoryPort } from '../../application/ports/notifications-repository.port';
export declare class PrismaNotificationsRepository implements NotificationsRepositoryPort {
    createNotification(data: {
        tenantId: string;
        userId: string;
        title: string;
        message: string;
        type: string;
    }): Promise<{
        createdAt: Date;
        tenantId: string;
        userId: string;
        title: string;
        message: string;
        type: string;
    }>;
}
