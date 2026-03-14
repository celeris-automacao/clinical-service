export interface NotificationsRepositoryPort {
  createNotification(data: {
    tenantId: string;
    userId: string;
    title: string;
    message: string;
    type: string;
  }): Promise<any>;
}
