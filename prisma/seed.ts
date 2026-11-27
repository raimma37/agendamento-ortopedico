import { PrismaClient, Shift } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log(">> Executando seed inicial do Sistema de Agendamento Ortopédico...");

  // 1. Superadmin padrão (fixo, irrevogável e indestrutível)
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@clinica.com.br").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Superadmin";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { isSystemSuperAdmin: true },
  });

  if (!existingSuperAdmin) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingByEmail) {
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          role: "SUPERADMIN",
          isSystemSuperAdmin: true,
          active: true,
        },
      });
      console.log(`   - Conta padrão promovida a SUPERADMIN: ${existingByEmail.email}`);
    } else {
      await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "SUPERADMIN",
          isSystemSuperAdmin: true,
          permissions: [],
          active: true,
        },
      });
      console.log(`   - SUPERADMIN criado: ${adminEmail}`);
    }
  } else {
    console.log(`   - SUPERADMIN já configurado: ${existingSuperAdmin.email}`);
  }

  // 2. ClinicSettings
  await prisma.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      clinicName: "Clínica Ortopédica — Especialidade em Joelho",
      bookingWindowDays: 30,
      showRemainingSlots: true,
      protocolInstructions:
        "Atendimento por ordem de chegada dentro do turno escolhido. Chegue com 15 minutos de antecedência levando documento com foto, carteirinha do convênio (se aplicável) e exames recentes do joelho.",
    },
  });
  console.log("   - ClinicSettings configurado.");

  // 3. WeeklyQuota (Seg a Sex: Manhã 12 vagas + Tarde 10 vagas; Sáb e Dom inativos por padrão)
  const shifts: Shift[] = [Shift.MORNING, Shift.AFTERNOON, Shift.FULL_DAY];
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    for (const shift of shifts) {
      let active = false;
      let maxSlots = 10;
      let privateReserveSlots = 0;

      if (isWeekday && shift === Shift.MORNING) {
        active = true;
        maxSlots = 12;
        privateReserveSlots = 2;
      } else if (isWeekday && shift === Shift.AFTERNOON) {
        active = true;
        maxSlots = 10;
        privateReserveSlots = 1;
      }

      await prisma.weeklyQuota.upsert({
        where: { dayOfWeek_shift: { dayOfWeek, shift } },
        update: {},
        create: {
          dayOfWeek,
          shift,
          maxSlots,
          privateReserveSlots,
          active,
        },
      });
    }
  }
  console.log("   - Grade semanal padrão (Seg–Sex Manhã/Tarde) configurada.");

  // 4. InsuranceOption (Particular com isPrivatePriority: true)
  const insurances = [
    { name: "Particular", isPrivatePriority: true, sortOrder: 1, active: true },
    { name: "Unimed", isPrivatePriority: false, sortOrder: 2, active: true },
    { name: "Bradesco Saúde", isPrivatePriority: false, sortOrder: 3, active: true },
    { name: "SulAmérica", isPrivatePriority: false, sortOrder: 4, active: true },
    { name: "Amil", isPrivatePriority: false, sortOrder: 5, active: true },
  ];

  for (const ins of insurances) {
    await prisma.insuranceOption.upsert({
      where: { name: ins.name },
      update: {},
      create: ins,
    });
  }
  console.log("   - Convênios/Particular configurados (Particular com prioridade silenciosa).");

  // 5. VisitTypeOption
  const visitTypes = [
    { name: "Primeira vez", sortOrder: 1, active: true },
    { name: "Retorno", sortOrder: 2, active: true },
  ];

  for (const vt of visitTypes) {
    await prisma.visitTypeOption.upsert({
      where: { name: vt.name },
      update: {},
      create: vt,
    });
  }
  console.log("   - Tipos de consulta configurados.");

  // 6. KneeOption
  const kneeOptions = [
    { name: "Joelho Direito", sortOrder: 1, active: true },
    { name: "Joelho Esquerdo", sortOrder: 2, active: true },
    { name: "Ambos os Joelhos", sortOrder: 3, active: false },
  ];

  for (const ko of kneeOptions) {
    await prisma.kneeOption.upsert({
      where: { name: ko.name },
      update: {},
      create: ko,
    });
  }
  console.log("   - Opções de joelho configuradas.");

  // 7. LocationOption (Locais de atendimento)
  const locations = [
    {
      name: "Clínica Particular",
      address: null,
      sortOrder: 1,
      active: true,
    },
    {
      name: "Hospital Porto Dias",
      address: null,
      sortOrder: 2,
      active: true,
    },
  ];

  for (const loc of locations) {
    await prisma.locationOption.upsert({
      where: { name: loc.name },
      update: {},
      create: loc,
    });
  }
  console.log("   - Locais de atendimento configurados.");

  console.log(">> Seed finalizado com sucesso!");
}

main()
  .catch((err) => {
    console.error("Erro ao executar seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
