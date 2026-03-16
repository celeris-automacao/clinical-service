export interface SocialRepositoryPort {
  findFeedByTenant(tenantId: string, limit: number): Promise<any[]>;
  createPost(data: {
    patientId: string;
    tenantId: string;
    content: string;
    type: string;
  }): Promise<any>;
}
