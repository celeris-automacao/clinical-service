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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const achievements_service_1 = require("../game/achievements.service");
const prisma_rls_extension_1 = require("../prisma/prisma-rls.extension");
let RecordsService = class RecordsService {
    constructor(prisma, achievementsService) {
        this.prisma = prisma;
        this.achievementsService = achievementsService;
    }
    async create(dto, user) {
        const record = await this.prisma.clinicalRecord.create({
            data: {
                patientId: user.userId,
                tenantId: user.tenantId,
                weight: new client_1.Prisma.Decimal(dto.weight),
                skeletalMuscleMass: dto.skeletal_muscle_mass ? new client_1.Prisma.Decimal(dto.skeletal_muscle_mass) : null,
                bodyFatMass: dto.body_fat_mass ? new client_1.Prisma.Decimal(dto.body_fat_mass) : null,
            },
        });
        const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId, dto);
        await this.prisma.playerStats.update({
            where: { patientId: user.userId },
            data: {
                totalDamageDealt: { increment: damageDealt },
                currentGold: { increment: damageDealt }, // O suor (músculo) vira ouro!
            }
        });
        return {
            id: record.id,
            message: damageDealt > 0
                ? `🔥 ATAQUE CRÍTICO! Você causou ${damageDealt.toLocaleString()} de dano no Boss!`
                : "Registro salvo. Continue focado na missão!",
            damage: damageDealt
        };
    }
    async calculateAndApplyDamage(userId: string, tenantId: string, dto: CreateRecordDto): Promise<number> {
        // Busca os dois últimos registros para comparação
        const records = await this.repository.findLastTwo(userId);
        if (records.length < 2) return 0;

        const current = records[0]; // O registro que acabamos de criar
        const previous = records[1]; // O registro imediatamente anterior

        // 1. Cálculo de Perda de Peso (Base: 1kg = 7700 pts)
        const weightDiff = Number(previous.weight) - Number(current.weight);
        const weightDamage = weightDiff > 0 ? weightDiff * 7700 : 0;

        // 2. Ganho de Massa Muscular (Bônus Crítico: 1kg = 10.000 pts)
        const muscleDiff = Number(current.skeletalMuscleMass) - Number(previous.skeletalMuscleMass);
        const muscleDamage = muscleDiff > 0 ? muscleDiff * 10000 : 0;

        // 3. Redução de Massa de Gordura (Bônus de Agilidade: 1kg = 5.000 pts)
        const fatDiff = Number(previous.bodyFatMass) - Number(current.bodyFatMass);
        const fatDamage = fatDiff > 0 ? fatDiff * 5000 : 0;

        const totalDamage = Math.round(weightDamage + muscleDamage + fatDamage);

        if (totalDamage > 0) {
            // Atualiza o Boss ativo com o dano total acumulado
            await this.prisma.bossBattle.updateMany({
                where: { tenantId, isActive: true },
                data: { currentHp: { decrement: totalDamage } }
            });
        }

        return totalDamage;
    }

    async getEvolution(user) {
        const records = await this.prisma.clinicalRecord.findMany({
            where: {
                patientId: user.userId,
                tenantId: user.tenantId,
            },
            orderBy: {
                recordedAt: 'asc',
            },
        });
        return records.map(r => ({
            recordedAt: r.recordedAt,
            weight: Number(r.weight),
            skeletalMuscleMass: r.skeletalMuscleMass ? Number(r.skeletalMuscleMass) : null,
            bodyFatMass: r.bodyFatMass ? Number(r.bodyFatMass) : null,
        }));
    }
    async getStats(user) {
        const records = await this.prisma.clinicalRecord.findMany({
            where: {
                patientId: user.userId,
                tenantId: user.tenantId,
            },
            orderBy: {
                recordedAt: 'asc',
            },
        });
        let totalDamage = 0;
        let totalWeightLoss = 0;
        for (let i = 1; i < records.length; i++) {
            const weightDiff = Number(records[i - 1].weight) - Number(records[i].weight);
            if (weightDiff > 0) {
                totalWeightLoss += weightDiff;
                totalDamage += weightDiff * 7700;
            }
        }
        const levelInfo = this.calculateProgressToNextLevel(totalDamage);
        return {
            patientId: user.userId,
            totalDamage: Math.round(totalDamage),
            totalWeightLoss: Number(totalWeightLoss.toFixed(2)),
            ...levelInfo,
            recordsCount: records.length,
            rank: this.calculateRank(totalDamage),
        };
    }
    calculateRank(damage) {
        if (damage > 50000)
            return 'Guerreiro de Elite';
        if (damage > 15000)
            return 'Soldado Veterano';
        return 'Recruta';
    }
    calculateLevel(totalDamage) {
        const level = Math.floor(Math.sqrt(totalDamage / 500)) + 1;
        return level;
    }
    calculateProgressToNextLevel(totalDamage) {
        const currentLevel = this.calculateLevel(totalDamage);
        const currentLevelThreshold = Math.pow(currentLevel - 1, 2) * 500;
        const nextLevelThreshold = Math.pow(currentLevel, 2) * 500;
        const progressInLevel = totalDamage - currentLevelThreshold;
        const neededForLevel = nextLevelThreshold - currentLevelThreshold;
        return {
            currentLevel,
            progressPercentage: Math.min(100, Math.round((progressInLevel / neededForLevel) * 100)),
            nextLevelThreshold: Math.round(nextLevelThreshold)
        };
    }
    async createRecord(dto: CreateRecordDto, user: UserContext) {
        const record = await this.repository.create(dto, user.userId, user.tenantId);

        // Calcula o dano clínico avançado usando o DTO completo
        const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId, dto);

        // Atualiza as estatísticas do jogador: suor vira ouro!
        await this.prisma.playerStats.update({
            where: { patientId: user.userId },
            data: {
                totalDamageDealt: { increment: damageDealt },
                currentGold: { increment: damageDealt }, // O dano clínico vira moeda de troca
            }
        });

        return {
            id: record.id,
            damage: damageDealt,
            message: damageDealt > 0
                ? `🔥 ATAQUE CRÍTICO! Você causou ${damageDealt.toLocaleString()} de dano no Boss!`
                : "Registro salvo. Continue focado na missão!"
        };
    }
};
exports.RecordsService = RecordsService;
exports.RecordsService = RecordsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => achievements_service_1.AchievementsService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
    achievements_service_1.AchievementsService])
], RecordsService);
//# sourceMappingURL=records.service.js.map