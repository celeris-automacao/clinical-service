import { PrismaService } from '../prisma/prisma.service';
export declare class SocialService {
    private prisma;
    constructor(prisma: PrismaService);
    getFeed(tenantId: string): Promise<({
        patient: {
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        type: string;
        patientId: string;
        createdAt: Date;
        content: string;
    })[]>;
    createPost(patientId: string, tenantId: string, content: string, type: string): Promise<{
        id: string;
        tenantId: string;
        type: string;
        patientId: string;
        createdAt: Date;
        content: string;
    }>;
}
