import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Definição da data para as tarefas
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Zera o horário para facilitar a busca por "hoje"

  console.log('🏢 Criando a Clínica (Tenant)...');
  const tenant = await prisma.tenant.upsert({
    where: { id: 'c56a4180-65aa-42ec-a945-5fd21dec0538' },
    update: {},
    create: {
      id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
      name: 'Clínica HealthQuest Central',
    },
  });

  console.log('👤 Criando o Paciente/Herói...');
  const patient = await prisma.patient.upsert({
    where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    update: {},
    create: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Guerreiro de Saúde',
      tenantId: tenant.id, // Vínculo obrigatório com a clínica
    },
  });

  console.log('⚔️  Gerando o Boss da Semana...');
  const boss = await prisma.bossBattle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      currentHp: 10,
      isActive: true,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Sedentarismo Voraz',
      maxHp: 100000,
      currentHp: 10,
      isActive: true,
    },
  });

  console.log(`✅ Boss ${boss.name} pronto! HP: ${boss.currentHp}`);

  console.log('📅 Criando tarefas diárias...');
  // Consolidamos a criação das tarefas em um único bloco
  await prisma.dailyTask.createMany({
    data: [
      {
        tenantId: tenant.id,
        patientId: patient.id,
        title: 'Beber 2L de Água',
        xpReward: 200,
        taskType: 'water',
        dueDate: today,
      },
      {
        tenantId: tenant.id,
        patientId: patient.id,
        title: '30min de Caminhada',
        xpReward: 250,
        taskType: 'workout',
        dueDate: today,
      },
      {
        tenantId: tenant.id,
        patientId: patient.id,
        title: 'Registrar Refeição Saudável',
        xpReward: 200,
        taskType: 'diet',
        dueDate: today,
      },
    ],
    skipDuplicates: true,
  });

  console.log('🎁 Criando recompensas...');
  await prisma.reward.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000002',
        tenantId: tenant.id,
        title: 'Medalha de Teste Unitário',
        description: 'Parabéns por validar o sistema de Loot!',
        requiredDamage: 1,
        badgeIcon: 'test-tube',
      },
      {
        tenantId: tenant.id,
        title: 'Cupom 15% Suplementos',
        requiredDamage: 5000,
        badgeIcon: 'ticket',
      },
    ],
    skipDuplicates: true,
  });

  console.log('📊 Inicializando estatísticas do herói...');
  await prisma.playerStats.upsert({
    where: { patientId: patient.id },
    update: {},
    create: {
      patientId: patient.id,
      tenantId: tenant.id,
      currentXp: 0,
      currentLevel: 1,
      totalDamageDealt: 0,
      currentGold: 0
    },
  });

  console.log('✅ Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });