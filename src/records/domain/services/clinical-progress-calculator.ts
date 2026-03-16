import { Injectable } from '@nestjs/common';

@Injectable()
export class ClinicalProgressCalculator {
  calculateDamageFromLatestRecords(records: Array<any>): number {
    if (records.length < 2) {
      return 0;
    }

    const current = records[0];
    const previous = records[1];

    const weightDiff = Number(previous.weight) - Number(current.weight);
    const weightDamage = weightDiff > 0 ? weightDiff * 7700 : 0;

    const currentMuscle = current.skeletalMuscleMass == null ? null : Number(current.skeletalMuscleMass);
    const previousMuscle = previous.skeletalMuscleMass == null ? null : Number(previous.skeletalMuscleMass);
    const muscleDiff =
      currentMuscle != null && previousMuscle != null ? currentMuscle - previousMuscle : 0;
    const muscleDamage = muscleDiff > 0 ? muscleDiff * 10000 : 0;

    const currentFat = current.bodyFatMass == null ? null : Number(current.bodyFatMass);
    const previousFat = previous.bodyFatMass == null ? null : Number(previous.bodyFatMass);
    const fatDiff = currentFat != null && previousFat != null ? previousFat - currentFat : 0;
    const fatDamage = fatDiff > 0 ? fatDiff * 5000 : 0;

    return Math.round(weightDamage + muscleDamage + fatDamage);
  }

  calculateStats(records: Array<any>) {
    let totalDamage = 0;
    let totalWeightLoss = 0;

    for (let i = 1; i < records.length; i++) {
      const weightDiff = Number(records[i - 1].weight) - Number(records[i].weight);
      if (weightDiff > 0) {
        totalWeightLoss += weightDiff;
        totalDamage += weightDiff * 7700;
      }
    }

    return {
      totalDamage: Math.round(totalDamage),
      totalWeightLoss: Number(totalWeightLoss.toFixed(2)),
      ...this.calculateProgressToNextLevel(totalDamage),
      rank: this.calculateRank(totalDamage),
    };
  }

  generateClinicalBossName(): string {
    const titles = ['Lorde da', 'Colosso do', 'Espectro da', 'Sombra da', 'Tirano da', 'Vulto do'];
    const enemies = [
      'Gordura Visceral',
      'Sedentarismo Estagnado',
      'Acomodação Crônica',
      'Desidratação Celular',
      'Inflamação Sistêmica',
      'Sarcopenia Latente',
    ];
    const adjectives = [
      'Persistente',
      'Tóxico(a)',
      'Invisível',
      'Debilitante',
      'Stubborn (Teimoso)',
      'Inflamatório(a)',
    ];

    const title = titles[Math.floor(Math.random() * titles.length)];
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

    return `${title} ${enemy} ${adjective}`;
  }

  private calculateRank(damage: number) {
    if (damage > 50000) {
      return 'Guerreiro de Elite';
    }
    if (damage > 15000) {
      return 'Soldado Veterano';
    }
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
      nextLevelThreshold: Math.round(nextLevelThreshold),
    };
  }
}
