import { PrismaService } from '../../prisma/prisma.service';
import { IRecordsRepository } from './interfaces/records.repository.interface';
import { CreateRecordDto } from '../dto/create-record.dto';
import { ClinicalRecord } from '@prisma/client';
export declare class RecordsRepository implements IRecordsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord>;
    findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
    findLastTwo(patientId: string): Promise<ClinicalRecord[]>;
    getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
}
