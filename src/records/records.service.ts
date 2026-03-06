// src/records/records.service.ts
import { Inject, Injectable, forwardRef, BadRequestException } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UserContext } from '../common/decorators/get-user.decorator';
import { AchievementsService } from '../achievements/achievements.service';
import { IRecordsRepository } from './repositories/interfaces/records.repository.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecordsService {
  constructor(
    @Inject('IRecordsRepository')
    private readonly repository: IRecordsRepository,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AchievementsService))
    private readonly achievementsService: AchievementsService
  ) { }

  /**
   * Orquestra a criação do registro, cálculo de dano avançado e economia de pontos
   */
  async createRecord(dto: CreateRecordDto, user: UserContext) {
    // 1. Salva o registro clínico no banco via Repository
    const newRecord = await this.repository.create(dto, user.userId, user.tenantId);

    // 2. Processa o dano clínico avançado (Peso + Músculo + Gordura)
    const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId, dto);

    // 3. Atualiza as estatísticas do jogador (O dano vira Gold spendável)
    await this.prisma.playerStats.update({
      where: { patientId: user.userId },
      data: {
        totalDamageDealt: { increment: damageDealt },
        currentGold: { increment: damageDealt },
      }
    });

    // 4. Verifica conquistas baseadas no novo estado
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

  /**
   * Lógica Central: Transforma evolução clínica em Dano de RPG
   */
  private async calculateAndApplyDamage(userId: string, tenantId: string, dto: CreateRecordDto): Promise<number> {
    // Busca os dois últimos registros para comparação histórica
    const records = await this.repository.findLastTwo(userId);
    if (records.length < 2) return 0;

    const current = records[0];
    const previous = records[1];

    // --- CÁLCULO DE MULTIPLICADORES CLÍNICOS ---

    // 1. Perda de Peso (1kg = 7.700 pts)
    const weightDiff = Number(previous.weight) - Number(current.weight);
    const weightDamage = weightDiff > 0 ? weightDiff * 7700 : 0;

    // 2. Ganho de Massa Muscular (1kg = 10.000 pts) - Recompensa maior pelo esforço
    const muscleDiff = Number(current.skeletalMuscleMass) - Number(previous.skeletalMuscleMass);
    const muscleDamage = muscleDiff > 0 ? muscleDiff * 10000 : 0;

    // 3. Redução de Massa de Gordura (1kg = 5.000 pts)
    const fatDiff = Number(previous.bodyFatMass) - Number(current.bodyFatMass);
    const fatDamage = fatDiff > 0 ? fatDiff * 5000 : 0;

    const totalDamage = Math.round(weightDamage + muscleDamage + fatDamage);

    if (totalDamage > 0) {
      // 1. Busca o Boss atual para saber o HP exato
      const boss = await this.prisma.bossBattle.findFirst({
        where: { tenantId, isActive: true }
      });

      if (boss) {
        const newHp = Number(boss.currentHp) - totalDamage;

        if (newHp <= 0) {
          // --- LÓGICA DE VITÓRIA ---
          await this.handleBossVictory(boss.id, tenantId);
        } else {
          // Dano normal
          await this.prisma.bossBattle.update({
            where: { id: boss.id },
            data: { currentHp: newHp }
          });
        }
      }
    }

    return totalDamage;
  }

  /**
   * Calcula estatísticas consolidadas e Rank
   */
  async getStats(user: UserContext) {
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

  async getEvolution(user: UserContext) {
    const records = await this.repository.findAllByPatient(user.userId, user.tenantId);
    return records.map(r => ({
      recordedAt: r.recordedAt,
      weight: Number(r.weight),
      skeletalMuscleMass: r.skeletalMuscleMass ? Number(r.skeletalMuscleMass) : null,
      bodyFatMass: r.bodyFatMass ? Number(r.bodyFatMass) : null,
    }));
  }

  private calculateRank(damage: number) {
    if (damage > 50000) return 'Guerreiro de Elite';
    if (damage > 15000) return 'Soldado Veterano';
    return 'Recruta';
  }

  private calculateLevel(totalDamage: number) {
    return Math.floor(Math.sqrt(totalDamage / 500)) + 1;
  }

  private calculateProgressToNextLevel(totalDamage: number) {
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

  public async handleBossVictory(bossId: string, tenantId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Busca os dados originais do Boss antes de encerrar
      const oldBoss = await tx.bossBattle.findUnique({ where: { id: bossId } });
      if (!oldBoss) return;

      // 2. Finaliza o Boss atual
      await tx.bossBattle.update({
        where: { id: bossId },
        data: { isActive: false, currentHp: 0, defeatedAt: new Date() }
      });

      // 3. Recompensa Coletiva
      await tx.playerStats.updateMany({
        where: { tenantId },
        data: { currentGold: { increment: 5000 } }
      });

      // 4. Renascimento: Gera o próximo vilão com HP escalonado (+15%)
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

  private generateClinicalBossName(): string {
    const titulos = ['Lorde da', 'Colosso do', 'Espectro da', 'Sombra da', 'Tirano da', 'Vulto do'];
    const inimigos = ['Gordura Visceral', 'Sedentarismo Estagnado', 'Acomodação Crônica', 'Desidratação Celular', 'Inflamação Sistêmica', 'Sarcopenia Latente'];
    const adjetivos = ['Persistente', 'Tóxico(a)', 'Invisível', 'Debilitante', 'Stubborn (Teimoso)', 'Inflamatório(a)'];

    const t = titulos[Math.floor(Math.random() * titulos.length)];
    const i = inimigos[Math.floor(Math.random() * inimigos.length)];
    const s = adjetivos[Math.floor(Math.random() * adjetivos.length)];

    return `${t} ${i} ${s}`;
  }


}