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
const achievements_service_1 = require("../achievements/achievements.service");
const prisma_service_1 = require("../prisma/prisma.service");
let RecordsService = class RecordsService {
    constructor(repository, prisma, achievementsService) {
        this.repository = repository;
        this.prisma = prisma;
        this.achievementsService = achievementsService;
    }
    async createRecord(dto, user) {
        const newRecord = await this.repository.create(dto, user.userId, user.tenantId);
        const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId, dto);
        await this.prisma.playerStats.upsert({
            where: { patientId: user.userId },
            update: {
                totalDamageDealt: { increment: damageDealt },
                currentGold: { increment: damageDealt },
            },
            create: {
                patientId: user.userId,
                tenantId: user.tenantId,
                totalDamageDealt: damageDealt,
                currentGold: damageDealt,
                currentLevel: 1,
                currentXp: 0
            }
        });
        const stats = await this.getStats(user);
        await this.achievementsService.checkLevelAchievements(user.userId, user.tenantId, stats.currentLevel);
        return {
            ...newRecord,
            damage: damageDealt,
            message: damageDealt > 0
                ? `🔥 ATAQUE CRÍTICO! Você causou ${damageDealt.toLocaleString()} de dano no Boss!`
                : "Registro salvo. Continue focado na sua evolução!",
        };
    }
    async calculateAndApplyDamage(userId, tenantId, dto) {
        const records = await this.repository.findLastTwo(userId);
        if (records.length < 2)
            return 0;
        const current = records[0];
        const previous = records[1];
        const weightDiff = Number(previous.weight) - Number(current.weight);
        const weightDamage = weightDiff > 0 ? weightDiff * 7700 : 0;
        const muscleDiff = Number(current.skeletalMuscleMass) - Number(previous.skeletalMuscleMass);
        const muscleDamage = muscleDiff > 0 ? muscleDiff * 10000 : 0;
        const fatDiff = Number(previous.bodyFatMass) - Number(current.bodyFatMass);
        const fatDamage = fatDiff > 0 ? fatDiff * 5000 : 0;
        const totalDamage = Math.round(weightDamage + muscleDamage + fatDamage);
        if (totalDamage > 0) {
            const boss = await this.prisma.bossBattle.findFirst({
                where: { tenantId, isActive: true }
            });
            if (boss) {
                const newHp = Number(boss.currentHp) - totalDamage;
                if (newHp <= 0) {
                    await this.handleBossVictory(boss.id, tenantId);
                }
                else {
                    await this.prisma.bossBattle.update({
                        where: { id: boss.id },
                        data: { currentHp: newHp }
                    });
                }
            }
        }
        return totalDamage;
    }
    async getStats(user) {
        const records = await this.repository.findAllByPatient(user.userId, user.tenantId);
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
    async getEvolution(user) {
        const records = await this.repository.findAllByPatient(user.userId, user.tenantId);
        return records.map(r => ({
            recordedAt: r.recordedAt,
            weight: Number(r.weight),
            skeletalMuscleMass: r.skeletalMuscleMass ? Number(r.skeletalMuscleMass) : null,
            bodyFatMass: r.bodyFatMass ? Number(r.bodyFatMass) : null,
        }));
    }
    calculateRank(damage) {
        if (damage > 50000)
            return 'Guerreiro de Elite';
        if (damage > 15000)
            return 'Soldado Veterano';
        return 'Recruta';
    }
    calculateLevel(totalDamage) {
        return Math.floor(Math.sqrt(totalDamage / 500)) + 1;
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
    async handleBossVictory(bossId, tenantId) {
        return await this.prisma.$transaction(async (tx) => {
            const oldBoss = await tx.bossBattle.findUnique({ where: { id: bossId } });
            if (!oldBoss)
                return;
            await tx.bossBattle.update({
                where: { id: bossId },
                data: { isActive: false, currentHp: 0, defeatedAt: new Date() }
            });
            await tx.playerStats.updateMany({
                where: { tenantId },
                data: { currentGold: { increment: 5000 } }
            });
            const nextName = this.generateClinicalBossName();
            const nextMaxHp = Math.round(Number(oldBoss.maxHp) * 1.15);
            await tx.bossBattle.create({
                data: {
                    name: nextName,
                    maxHp: nextMaxHp,
                    currentHp: nextMaxHp,
                    tenantId,
                    isActive: true,
                }
            });
            this.achievementsService.emitGlobalVictory(tenantId, `🏆 VITÓRIA! O "${nextName}" surgiu!`);
        });
    }
    generateClinicalBossName() {
        const titulos = ['Lorde da', 'Colosso do', 'Espectro da', 'Sombra da', 'Tirano da', 'Vulto do'];
        const inimigos = ['Gordura Visceral', 'Sedentarismo Estagnado', 'Acomodação Crônica', 'Desidratação Celular', 'Inflamação Sistêmica', 'Sarcopenia Latente'];
        const adjetivos = ['Persistente', 'Tóxico(a)', 'Invisível', 'Debilitante', 'Stubborn (Teimoso)', 'Inflamatório(a)'];
        const t = titulos[Math.floor(Math.random() * titulos.length)];
        const i = inimigos[Math.floor(Math.random() * inimigos.length)];
        const s = adjetivos[Math.floor(Math.random() * adjetivos.length)];
        return `${t} ${i} ${s}`;
    }
};
exports.RecordsService = RecordsService;
exports.RecordsService = RecordsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('IRecordsRepository')),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => achievements_service_1.AchievementsService))),
    __metadata("design:paramtypes", [Object, prisma_service_1.PrismaService,
        achievements_service_1.AchievementsService])
], RecordsService);
//# sourceMappingURL=records.service.js.map