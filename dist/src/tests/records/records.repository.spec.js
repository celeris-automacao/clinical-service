"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const records_repository_1 = require("../../records/repositories/records.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('RecordsRepository', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                records_repository_1.RecordsRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        clinicalRecord: {
                            create: jest.fn(),
                            findMany: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();
        repository = module.get(records_repository_1.RecordsRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    describe('create', () => {
        it('deve persistir um novo registro clínico com os campos mapeados corretamente', async () => {
            const dto = { weight: 80.5, skeletal_muscle_mass: 35, body_fat_mass: 20 };
            const userId = 'user-123';
            const tenantId = 'tenant-456';
            await repository.create(dto, userId, tenantId);
            expect(prisma.clinicalRecord.create).toHaveBeenCalledWith({
                data: {
                    weight: dto.weight,
                    skeletalMuscleMass: dto.skeletal_muscle_mass,
                    bodyFatMass: dto.body_fat_mass,
                    patientId: userId,
                    tenantId: tenantId,
                },
            });
        });
    });
    describe('findAllByPatient', () => {
        it('deve buscar o histórico completo ordenado por data ASCENDENTE para o gráfico', async () => {
            const userId = 'user-123';
            const tenantId = 'tenant-456';
            await repository.findAllByPatient(userId, tenantId);
            expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
                where: { patientId: userId, tenantId },
                orderBy: { recordedAt: 'asc' },
            });
        });
    });
    describe('findLastTwo', () => {
        it('deve buscar apenas os 2 registros mais recentes para cálculo de dano', async () => {
            const userId = 'user-123';
            await repository.findLastTwo(userId);
            expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
                where: { patientId: userId },
                orderBy: { recordedAt: 'desc' },
                take: 2,
            });
        });
    });
    describe('getClinicalDamageByTenant', () => {
        it('deve calcular o dano acumulado de todos os pacientes da clínica com base na perda de peso', async () => {
            const tenantId = 'tenant-123';
            const mockRecords = [
                { patientId: 'p1', weight: 100, recordedAt: new Date('2023-01-01') },
                { patientId: 'p1', weight: 95, recordedAt: new Date('2023-01-02') },
                { patientId: 'p2', weight: 80, recordedAt: new Date('2023-01-01') },
                { patientId: 'p2', weight: 82, recordedAt: new Date('2023-01-02') },
                { patientId: 'p2', weight: 79, recordedAt: new Date('2023-01-03') },
            ];
            jest.spyOn(prisma.clinicalRecord, 'findMany').mockResolvedValue(mockRecords);
            const result = await repository.getClinicalDamageByTenant(tenantId);
            expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
                where: { tenantId },
                select: { patientId: true, weight: true, recordedAt: true },
                orderBy: { recordedAt: 'asc' },
            });
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2);
            expect(result.get('p1')).toBe(38500);
            expect(result.get('p2')).toBe(23100);
        });
        it('deve retornar um Map vazio se a clínica não possuir registros', async () => {
            jest.spyOn(prisma.clinicalRecord, 'findMany').mockResolvedValue([]);
            const result = await repository.getClinicalDamageByTenant('tenant-vazio');
            expect(result.size).toBe(0);
        });
    });
});
//# sourceMappingURL=records.repository.spec.js.map