import { Injectable } from '@nestjs/common';
import { NotificationsRepositoryPort } from '../../application/ports/notifications-repository.port';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepositoryPort {
  async createNotification(data: {
    tenantId: string;
    userId: string;
    title: string;
    message: string;
    type: string;
  }) {
    return { ...data, createdAt: new Date() };
  }
}
