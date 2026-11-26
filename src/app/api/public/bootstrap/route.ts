import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDaysISO, getTodayISO } from "@/lib/normalize";
import { getAvailabilityRange } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * Retorna configurações públicas da clínica, opções fixas ativas (SEM isPrivatePriority!)
 * e disponibilidade para a janela de agendamento configurada.
 */
export async function GET() {
  try {
    const [settings, insurances, visitTypes, kneeOptions] = await Promise.all([
      prisma.clinicSettings.findUnique({ where: { id: 1 } }),
      prisma.insuranceOption.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        // NUNCA expor isPrivatePriority em rotas públicas
        select: { id: true, name: true, sortOrder: true },
      }),
      prisma.visitTypeOption.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, sortOrder: true },
      }),
      prisma.kneeOption.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, sortOrder: true },
      }),
    ]);

    const clinicSettings = settings ?? {
      clinicName: "Clínica Ortopédica — Especialidade em Joelho",
      bookingWindowDays: 30,
      showRemainingSlots: true,
      protocolInstructions:
        "Atendimento por ordem de chegada dentro do turno escolhido.",
    };

    const today = getTodayISO();
    const endDate = addDaysISO(today, clinicSettings.bookingWindowDays);

    const availability = await getAvailabilityRange(today, endDate, {
      forPublicPortal: true,
      showRemainingSlots: clinicSettings.showRemainingSlots,
    });

    return NextResponse.json({
      settings: {
        clinicName: clinicSettings.clinicName,
        bookingWindowDays: clinicSettings.bookingWindowDays,
        showRemainingSlots: clinicSettings.showRemainingSlots,
        protocolInstructions: clinicSettings.protocolInstructions,
      },
      options: {
        insurances,
        visitTypes,
        kneeOptions,
      },
      availability,
    });
  } catch (err) {
    console.error("[public/bootstrap]", err);
    return NextResponse.json(
      { error: "Erro ao carregar dados do agendamento" },
      { status: 500 }
    );
  }
}
