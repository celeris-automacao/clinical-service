import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // O ID da clínica que você usou no teste do Insomnia
  const tenantId = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
  const patientId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  const today = new Date();
  today.setHours(0, 0, 0, 0);


  console.log('👤 Criando o Paciente/Herói...');
  await prisma.patient.upsert({
    where: { id: patientId },
    update: { name: 'Guerreiro de Saúde' },
    create: {
      id: patientId,
      tenantId: tenantId,
      name: 'Guerreiro de Saúde',
    },
  });

  // ... restante do seu código de seed (Boss, Tasks, etc) ...
  console.log('✅ Seed finalizado com sucesso!');

  console.log('⚔️  Gerando o Boss da Semana...');

  const boss = await prisma.bossBattle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' }, // ID fixo para evitar duplicidade no seed
    update: {
      currentHp: 1, // <--- ADICIONE ISSO AQUI PARA FORÇAR A ATUALIZAÇÃO
      isActive: true,
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenantId,
      name: 'Sedentarismo Voraz',
      maxHp: 100000,     // 100.000 de vida inicial
      currentHp: 10, // Vida atual cheia
      isActive: true,
    },
  });

  console.log(`✅ Boss ${boss.name} pronto para a batalha! HP: ${boss.currentHp}`);

  await prisma.dailyTask.createMany({
    data: [
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // ID do Paciente é obrigatório [cite: 229]
        title: 'Beber 2L de Água',
        xpReward: 200, // Nome correto conforme o schema [cite: 233]
        taskType: 'diet' // Opcional, mas recomendado pelo SQL [cite: 232]
      },
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // ID do Paciente é obrigatório [cite: 229]
        title: '30min de Caminhada',
        xpReward: 200, // Nome correto conforme o schema [cite: 233]
        taskType: 'diet' // Opcional, mas recomendado pelo SQL [cite: 232]
      },
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // ID do Paciente é obrigatório [cite: 229]
        title: 'Registrar Refeição Saudável',
        xpReward: 200, // Nome correto conforme o schema [cite: 233]
        taskType: 'diet' // Opcional, mas recomendado pelo SQL [cite: 232]
      },
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        title: 'Meditação ou Respiração',
        description: 'Realizar 5 min de respiração guiada',
        xpReward: 150, // Nome correto [cite: 233]
        taskType: 'education'
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Tarefas diárias iniciais criadas.');
  await prisma.reward.createMany({
    data: [
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        title: 'Medalha de Recruta',
        requiredDamage: 1000,
        badgeIcon: 'shield'
      },
      {
        tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        title: 'Cupom 15% Suplementos',
        requiredDamage: 5000,
        badgeIcon: 'ticket'
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Recompensas iniciais criadas.');

  await prisma.reward.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' }, // ID Fixo para facilitar o teste
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
      title: 'Medalha de Teste Unitário',
      description: 'Parabéns por validar o sistema de Loot!',
      requiredDamage: 1, // Dano mínimo para liberar
      badgeIcon: 'test-tube',
    },
  });

  await prisma.dailyTask.createMany({
  data: [
    {
      tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
      patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      title: 'Beber 2L de Água',
      xpReward: 200,
      taskType: 'water',
      dueDate: today, // Garante que apareça no "today"
    },
    {
      tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
      patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      title: '30min de Caminhada',
      xpReward: 250,
      taskType: 'workout',
      dueDate: today,
    },
    // ... adicione para as outras tarefas
  ],
  skipDuplicates: true,
});


}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });