import { NextResponse, type NextRequest } from "next/server";
import { createAppointmentSchema } from "@/lib/validations";
import { bookAppointmentWithPriority } from "@/lib/booking-queue";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  formatDateBR,
  formatDateISO,
  formatWhatsappDisplay,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

function maskWhatsappDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length >= 6) {
    return `(${local.slice(0, 2)}) *****-${local.slice(-4)}`;
  }
  return "****";
}

function serializePublicAppointment(
  apt: {
    id: string;
    protocol: string;
    patientName: string;
    whatsapp: string;
    date: Date;
    shift: "MORNING" | "AFTERNOON" | "FULL_DAY";
    status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELED" | "NO_SHOW";
    insurance: { name: string };
    visitType: { name: string };
    kneeOption: { name: string };
    createdAt: Date;
  },
  options: { maskPhone?: boolean } = {}
) {
  const dateISO = formatDateISO(apt.date);
  const last4 = apt.whatsapp.slice(-4);
  return {
    id: apt.id,
    protocol: apt.protocol,
    patientName: apt.patientName,
    whatsapp: options.maskPhone ? `***${last4}` : apt.whatsapp,
    whatsappDisplay: options.maskPhone
      ? maskWhatsappDisplay(apt.whatsapp)
      : formatWhatsappDisplay(apt.whatsapp),
    date: dateISO,
    dateBR: formatDateBR(dateISO),
    shift: apt.shift,
    shiftLabel: SHIFT_LABELS[apt.shift],
    insurance: apt.insurance.name,
    visitType: apt.visitType.name,
    kneeOption: apt.kneeOption.name,
    status: apt.status,
    statusLabel: STATUS_LABELS[apt.status],
    createdAt: apt.createdAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`public-book:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações. Aguarde alguns segundos e tente novamente." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message || "Dados inválidos",
          issues: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const result = await bookAppointmentWithPriority(parsed.data);

    if (result.outcome === "CREATED") {
      return NextResponse.json(
        {
          duplicate: false,
          appointment: serializePublicAppointment(result.appointment),
        },
        { status: 201 }
      );
    }

    if (result.outcome === "DUPLICATE") {
      return NextResponse.json(
        {
          duplicate: true,
          message: result.message,
          appointment: serializePublicAppointment(result.appointment, {
            maskPhone: true,
          }),
        },
        { status: 200 }
      );
    }

    if (result.outcome === "FULL") {
      // Mensagem neutra e padronizada — nunca revela prioridade silenciosa
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (err) {
    console.error("[public/appointments POST]", err);
    return NextResponse.json(
      { error: "Não foi possível concluir o agendamento. Tente novamente." },
      { status: 500 }
    );
  }
}
