import { NextResponse, type NextRequest } from "next/server";
import { verifyApiKeyRequest } from "@/lib/auth";
import { getAvailabilityRange } from "@/lib/availability";
import { addDaysISO, getTodayISO } from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate") || getTodayISO();
  const endDate = sp.get("endDate") || addDaysISO(startDate, 14);
  const insuranceId = sp.get("insuranceId") || undefined;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    endDate < startDate
  ) {
    return NextResponse.json(
      { error: "Informe startDate e endDate válidos no formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const availability = await getAvailabilityRange(startDate, endDate, {
    forPublicPortal: false,
    showRemainingSlots: true,
    insuranceId,
  });

  return NextResponse.json({
    startDate,
    endDate,
    days: availability,
  });
}
