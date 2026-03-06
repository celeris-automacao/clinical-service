"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
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
    console.log('✅ Seed finalizado com sucesso!');
    console.log('⚔️  Gerando o Boss da Semana...');
    const boss = await prisma.bossBattle.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {
            currentHp: 1,
            isActive: true,
        },
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            tenantId: tenantId,
            name: 'Sedentarismo Voraz',
            maxHp: 100000,
            currentHp: 10,
            isActive: true,
        },
    });
    console.log(`✅ Boss ${boss.name} pronto para a batalha! HP: ${boss.currentHp}`);
    await prisma.dailyTask.createMany({
        data: [
            {
                tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
                patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: 'Beber 2L de Água',
                xpReward: 200,
                taskType: 'diet'
            },
            {
                tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
                patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: '30min de Caminhada',
                xpReward: 200,
                taskType: 'diet'
            },
            {
                tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
                patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: 'Registrar Refeição Saudável',
                xpReward: 200,
                taskType: 'diet'
            },
            {
                tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
                patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: 'Meditação ou Respiração',
                description: 'Realizar 5 min de respiração guiada',
                xpReward: 150,
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
        where: { id: '00000000-0000-0000-0000-000000000002' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000002',
            tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
            title: 'Medalha de Teste Unitário',
            description: 'Parabéns por validar o sistema de Loot!',
            requiredDamage: 1,
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
                dueDate: today,
            },
            {
                tenantId: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
                patientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                title: '30min de Caminhada',
                xpReward: 250,
                taskType: 'workout',
                dueDate: today,
            },
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
//# sourceMappingURL=seed.js.map