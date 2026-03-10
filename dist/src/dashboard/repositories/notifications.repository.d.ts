import { PrismaService } from '../../prisma/prisma.service';
import { INotificationsRepository } from './interfaces/notifications.repository.interface';
export declare class NotificationsRepository implements INotificationsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
