import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('Criando a clinica (Tenant)...');
  const tenant = await prisma.tenant.upsert({
    where: { id: 'c56a4180-65aa-42ec-a945-5fd21dec0538' },
    update: {},
    create: {
      id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
      name: 'Clinica HealthQuest Central',
    },
  });

  console.log('Criando o paciente...');
  const patient = await prisma.patient.upsert({
    where: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    update: {},
    create: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Guerreiro de Saude',
      tenantId: tenant.id,
    },
  });

  console.log('Gerando o boss inicial...');
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

  console.log(`Boss ${boss.name} pronto! HP: ${boss.currentHp}`);

  console.log('Criando templates de tarefa...');
  const waterTemplate = await prisma.taskTemplate.upsert({
    where: { id: '10000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      title: 'Beber 2L de Agua',
      description: 'Meta diaria de hidratacao',
      taskType: 'water',
      xpReward: 200,
      createdByUserId: '11111111-1111-1111-1111-111111111111',
    },
  });

  const workoutTemplate = await prisma.taskTemplate.upsert({
    where: { id: '10000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      title: '30min de Caminhada',
      description: 'Atividade aerobica leve',
      taskType: 'workout',
      xpReward: 250,
      createdByUserId: '11111111-1111-1111-1111-111111111111',
    },
  });

  const dietTemplate = await prisma.taskTemplate.upsert({
    where: { id: '10000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000003',
      tenantId: tenant.id,
      title: 'Registrar Refeicao Saudavel',
      description: 'Enviar uma refeicao dentro do plano alimentar',
      taskType: 'diet',
      xpReward: 200,
      createdByUserId: '11111111-1111-1111-1111-111111111111',
    },
  });

  console.log('Atribuindo tarefas ao paciente...');
  await prisma.taskAssignment.createMany({
    data: [
      {
        id: '20000000-0000-0000-0000-000000000001',
        tenantId: tenant.id,
        templateId: waterTemplate.id,
        patientId: patient.id,
        dueDate: today,
        status: 'pending',
        assignedByUserId: '11111111-1111-1111-1111-111111111111',
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        tenantId: tenant.id,
        templateId: workoutTemplate.id,
        patientId: patient.id,
        dueDate: today,
        status: 'pending',
        assignedByUserId: '11111111-1111-1111-1111-111111111111',
      },
      {
        id: '20000000-0000-0000-0000-000000000003',
        tenantId: tenant.id,
        templateId: dietTemplate.id,
        patientId: patient.id,
        dueDate: today,
        status: 'pending',
        assignedByUserId: '11111111-1111-1111-1111-111111111111',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Criando recompensas...');
  await prisma.reward.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000002',
        tenantId: tenant.id,
        title: 'Medalha de Teste Unitario',
        description: 'Parabens por validar o sistema de loot!',
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

  console.log('Inicializando estatisticas do paciente...');
  await prisma.playerStats.upsert({
    where: { patientId: patient.id },
    update: {},
    create: {
      patientId: patient.id,
      tenantId: tenant.id,
      currentXp: 0,
      currentLevel: 1,
      totalDamageDealt: 0,
      currentGold: 0,
    },
  });

  console.log('Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
