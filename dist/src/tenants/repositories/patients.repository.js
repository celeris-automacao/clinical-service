"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let PatientsRepository = class PatientsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createWithStats(data, tenantId) {
        return this.prisma.$transaction(async (tx) => {
            const patient = await tx.patient.create({
                data: {
                    id: data.supabaseId,
                    name: data.name,
                    tenantId: tenantId,
                },
            });
            await tx.playerStats.create({
                data: {
                    patientId: patient.id,
                    tenantId: tenantId,
                    currentLevel: 1,
                    currentXp: 0,
                    currentGold: 0,
                    totalDamageDealt: 0,
                },
            });
            return patient;
        });
    }
    async findBySupabaseId(id) {
        return this.prisma.patient.findUnique({ where: { id } });
    }
};
exports.PatientsRepository = PatientsRepository;
exports.PatientsRepository = PatientsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PatientsRepository);
//# sourceMappingURL=patients.repository.js.map