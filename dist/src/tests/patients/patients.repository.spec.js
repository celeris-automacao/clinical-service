"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const testing_1 = require("@nestjs/testing");
const prisma_patients_repository_1 = require("../../patients/infrastructure/persistence/prisma-patients.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaPatientsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        patient: {
            findFirst: jest.fn(),
            count: jest.fn(),
        },
        patientProfile: {
            upsert: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_patients_repository_1.PrismaPatientsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        runInTenantTransaction: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_patients_repository_1.PrismaPatientsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve criar paciente, endereco e playerStats iniciais dentro da transacao', async () => {
        const dto = {
            supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            name: 'Paciente Teste',
            email: 'paciente@teste.com',
            phone: '11911111111',
            document: '11122233344',
            gender: client_1.Gender.MALE,
            birthDate: '1990-01-01',
            address: {
                zipCode: '01311000',
                street: 'Av Paulista',
                number: '1000',
                neighborhood: 'Bela Vista',
                city: 'Sao Paulo',
                state: 'SP',
            },
        };
        const tenantId = 'tenant-1';
        const createdPatient = { id: dto.supabaseId, name: dto.name, tenantId };
        const tx = {
            patient: {
                create: jest.fn().mockResolvedValue(createdPatient),
            },
            playerStats: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await repository.createWithStats(dto, tenantId);
        expect(tx.patient.create).toHaveBeenCalledWith({
            data: {
                id: dto.supabaseId,
                name: dto.name,
                tenantId,
                email: dto.email,
                phone: dto.phone,
                document: dto.document,
                gender: dto.gender,
                birthDate: new Date(dto.birthDate),
                address: {
                    create: {
                        zipCode: dto.address.zipCode,
                        street: dto.address.street,
                        number: dto.address.number,
                        complement: undefined,
                        neighborhood: dto.address.neighborhood,
                        city: dto.address.city,
                        state: dto.address.state,
                        country: 'BR',
                    },
                },
            },
        });
        expect(tx.playerStats.create).toHaveBeenCalledWith({
            data: {
                patientId: createdPatient.id,
                tenantId,
                currentLevel: 1,
            },
        });
        expect(result).toEqual(createdPatient);
    });
    it('deve contar pacientes por tenant', async () => {
        await repository.countByTenant('tenant-1');
        expect(tenantPrisma.patient.count).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1' },
        });
    });
    it('deve buscar paciente por supabaseId dentro do tenant', async () => {
        await repository.findBySupabaseId('patient-1', 'tenant-1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'patient-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.patient.findFirst).toHaveBeenCalledWith({
            where: { id: 'patient-1', tenantId: 'tenant-1' },
        });
    });
    it('deve buscar paciente por id dentro do tenant', async () => {
        await repository.findById('patient-2', 'tenant-1');
        expect(tenantPrisma.patient.findFirst).toHaveBeenCalledWith({
            where: { id: 'patient-2', tenantId: 'tenant-1' },
        });
    });
    it('deve fazer upsert do perfil clinico do paciente do tenant', async () => {
        const dto = {
            initialGoals: 'Perder peso',
            symptoms: 'Dor lombar',
            pathologies: 'Hipertensao',
            medicalNotes: 'Acompanhar pressao',
        };
        jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1', tenantId: 'tenant-1' });
        await repository.updateProfile('patient-1', 'tenant-1', dto);
        expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'patient-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.patientProfile.upsert).toHaveBeenCalledWith({
            where: { patientId: 'patient-1' },
            update: dto,
            create: {
                patientId: 'patient-1',
                ...dto,
            },
        });
    });
});
//# sourceMappingURL=patients.repository.spec.js.map