"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Sun,
  Sunset,
  UserCheck,
} from "lucide-react";
import { formatDateBR, maskBrazilianPhone } from "@/lib/normalize";
import { downloadAppointmentReceiptPdf } from "@/lib/receipt-pdf";

interface LocationInfo {
  id: string;
  name: string;
  address: string | null;
}

interface ShiftAvailability {
  shift: "MORNING" | "AFTERNOON" | "FULL_DAY";
  shiftLabel: string;
  available: boolean;
  remainingSlots: number | null;
  location: LocationInfo | null;
  allowedInsuranceIds: string[];
  allowedInsuranceNames: string[];
}

interface DayAvailability {
  date: string;
  available: boolean;
  shifts: ShiftAvailability[];
}

interface FixedOption {
  id: string;
  name: string;
  sortOrder: number;
}

interface BootstrapData {
  settings: {
    clinicName: string;
    bookingWindowDays: number;
    showRemainingSlots: boolean;
    protocolInstructions: string;
  };
  options: {
    insurances: FixedOption[];
    visitTypes: FixedOption[];
    kneeOptions: FixedOption[];
    locations: Array<LocationInfo & { sortOrder: number }>;
  };
  availability: DayAvailability[];
}

interface BookedAppointment {
  id: string;
  protocol: string;
  patientName: string;
  whatsapp: string;
  whatsappDisplay: string;
  date: string;
  dateBR: string;
  shift: "MORNING" | "AFTERNOON" | "FULL_DAY";
  shiftLabel: string;
  location: string | null;
  locationAddress: string | null;
  insurance: string;
  visitType: string;
  kneeOption: string;
  status: string;
  statusLabel: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
    dt.getUTCDay()
  ];
}

export default function PublicBookingFlow() {
  const [loading, setLoading] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [insuranceId, setInsuranceId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<
    "MORNING" | "AFTERNOON" | "FULL_DAY" | ""
  >("");

  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
  );

  const [patientName, setPatientName] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [visitTypeId, setVisitTypeId] = useState("");
  const [kneeOptionId, setKneeOptionId] = useState("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    duplicate: boolean;
    message?: string;
    appointment: BookedAppointment;
  } | null>(null);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  function handleDownloadPdf() {
    if (!result || !data) return;
    downloadAppointmentReceiptPdf({
      clinicName: data.settings.clinicName,
      protocol: result.appointment.protocol,
      patientName: result.appointment.patientName,
      whatsappDisplay: result.appointment.whatsappDisplay,
      dateBR: result.appointment.dateBR,
      weekdayLabel: getWeekdayLabel(result.appointment.date),
      shiftLabel: result.appointment.shiftLabel,
      location: result.appointment.location,
      locationAddress: result.appointment.locationAddress,
      insurance: result.appointment.insurance,
      visitType: result.appointment.visitType,
      kneeOption: result.appointment.kneeOption,
      statusLabel: result.appointment.statusLabel,
      protocolInstructions: data.settings.protocolInstructions,
    });
    setPdfDownloaded(true);
    setTimeout(() => setPdfDownloaded(false), 3000);
  }

  async function fetchBootstrap(filterInsuranceId?: string, initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setLoadingAvailability(true);
    }
    setLoadError(null);
    try {
      const qs = filterInsuranceId
        ? `?insuranceId=${encodeURIComponent(filterInsuranceId)}`
        : "";
      const res = await fetch(`/api/public/bootstrap${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar agenda disponível.");
      const json: BootstrapData = await res.json();
      setData(json);

      const firstAvail = json.availability.find((d) => d.available);
      if (firstAvail) {
        const [y, m] = firstAvail.date.split("-").map(Number);
        setCalendarMonth({ year: y, month: m - 1 });
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao conectar com o servidor."
      );
    } finally {
      setLoading(false);
      setLoadingAvailability(false);
    }
  }

  useEffect(() => {
    void fetchBootstrap(undefined, true);
  }, []);

  const selectedInsuranceObj = useMemo(() => {
    if (!data || !insuranceId) return null;
    return data.options.insurances.find((i) => i.id === insuranceId) ?? null;
  }, [data, insuranceId]);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    if (data) {
      for (const d of data.availability) map.set(d.date, d);
    }
    return map;
  }, [data]);

  const availableDaysList = useMemo(() => {
    if (!data) return [];
    return data.availability.filter((d) => d.available);
  }, [data]);

  const selectedDayInfo = selectedDate ? availabilityMap.get(selectedDate) : undefined;
  const selectedShiftInfo = useMemo(() => {
    if (!selectedDayInfo || !selectedShift) return null;
    return selectedDayInfo.shifts.find((s) => s.shift === selectedShift) ?? null;
  }, [selectedDayInfo, selectedShift]);

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startDow = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ dateStr: null, dayNum: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      cells.push({ dateStr: `${year}-${mStr}-${dStr}`, dayNum: day });
    }
    return cells;
  }, [calendarMonth]);

  function handleSelectInsurance(nextInsId: string) {
    setInsuranceId(nextInsId);
    setSelectedDate("");
    setSelectedShift("");
    setSubmitError(null);
    void fetchBootstrap(nextInsId, false);
  }

  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    const info = availabilityMap.get(dateStr);
    const openShifts = info?.shifts.filter((s) => s.available) ?? [];
    if (openShifts.length === 1) {
      setSelectedShift(openShifts[0].shift);
    } else {
      setSelectedShift("");
    }
    setSubmitError(null);
  }

  function prevMonth() {
    setCalendarMonth((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }

  function nextMonth() {
    setCalendarMonth((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (patientName.trim().length < 3) {
      setSubmitError("Informe o nome completo do paciente.");
      return;
    }
    const digits = whatsappInput.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      setSubmitError("Informe um número de WhatsApp válido com DDD.");
      return;
    }
    if (!insuranceId) {
      setSubmitError("Selecione o convênio ou Particular.");
      return;
    }
    if (!visitTypeId) {
      setSubmitError("Selecione o tipo de consulta.");
      return;
    }
    if (!kneeOptionId) {
      setSubmitError("Selecione qual joelho será avaliado.");
      return;
    }
    if (!lgpdAccepted) {
      setSubmitError("Aceite a Política de Privacidade (LGPD) para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          whatsapp: whatsappInput,
          date: selectedDate,
          shift: selectedShift,
          insuranceId,
          visitTypeId,
          kneeOptionId,
          lgpdAccepted,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Não foi possível concluir o agendamento.");
        if (res.status === 409) void fetchBootstrap(insuranceId, false);
        return;
      }

      setResult({
        duplicate: Boolean(json.duplicate),
        message: json.message,
        appointment: json.appointment,
      });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetBooking() {
    setStep(1);
    setInsuranceId("");
    setSelectedDate("");
    setSelectedShift("");
    setPatientName("");
    setWhatsappInput("");
    setVisitTypeId("");
    setKneeOptionId("");
    setLgpdAccepted(false);
    setSubmitError(null);
    setResult(null);
    void fetchBootstrap(undefined, false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#12102b]">
        <Loader2 className="h-9 w-9 animate-spin text-[#8b6dff] mb-3" />
        <p className="text-[#c7c4eb] font-medium text-base">
          Carregando agenda disponível...
        </p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#12102b] text-center">
        <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
        <h1 className="text-lg font-bold text-white mb-1">
          Não foi possível carregar a agenda
        </h1>
        <p className="text-sm text-[#9c99c4] mb-5 max-w-sm">
          {loadError || "Tente novamente em alguns instantes."}
        </p>
        <button
          type="button"
          onClick={() => void fetchBootstrap(insuranceId || undefined, true)}
          className="min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border border-white/75 hover:border-white text-white font-bold shadow-lg shadow-violet-600/30 transition-all"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#12102b] text-[#f1f0ff] flex flex-col overflow-x-hidden relative">
      {/* Subtle Ambient Glow */}
      <div className="pointer-events-none fixed -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#7c5cff]/20 blur-[110px]" />

      {/* Cabeçalho compacto Mobile-First */}
      <header className="bg-[#171536]/90 backdrop-blur-lg border-b border-[#2a2759] sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#9c82ff] to-[#6344ff] text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/30">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                {data.settings.clinicName}
              </h1>
              <p className="text-xs text-[#9c99c4] truncate">
                Agendamento online • Ordem de chegada
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="text-xs font-semibold text-[#d5d3f5] hover:text-white flex items-center gap-1 shrink-0 py-2 px-2.5 rounded-xl bg-[#211e47] border border-white/35 hover:border-white/85 transition-colors"
            title="Acesso Administrativo"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>

        {/* Barra de Progresso */}
        <div className="max-w-xl mx-auto px-4 pb-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9c99c4] mb-1.5">
            <span>Passo {step} de 3</span>
            <span className="text-[#b39eff]">
              {step === 1 && "Convênio, Data e Local"}
              {step === 2 && "Dados do Paciente"}
              {step === 3 && "Comprovante"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s <= step
                    ? "bg-gradient-to-r from-[#957bff] to-[#4ea8ff]"
                    : "bg-[#2a2759]"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 flex-1 max-w-xl w-full mx-auto px-4 pt-5 pb-28 sm:pb-10">
        {/* ================= PASSO 1: CONVÊNIO, DATA E TURNO ================= */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Aviso de Ordem de Chegada */}
            <div className="rounded-2xl bg-gradient-to-r from-[#241f54] to-[#1d2252] border border-[#3e3785] p-3.5 flex items-start gap-3 shadow-lg shadow-black/20">
              <div className="h-9 w-9 rounded-xl bg-[#8b6dff]/20 border border-[#8b6dff]/40 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-[#b39eff]" />
              </div>
              <div className="text-sm leading-snug">
                <p className="font-bold text-white">Atendimento por ordem de chegada</p>
                <p className="text-[#b5b2db] text-xs mt-0.5">
                  Selecione seu convênio ou Particular abaixo para ver os dias, turnos e
                  locais de atendimento disponíveis.
                </p>
              </div>
            </div>

            {/* 1. Seleção de Convênio / Particular (Zero indicação de prioridade) */}
            <section className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 shadow-xl shadow-black/25 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  1. Selecione seu convênio ou Particular *
                </h2>
                <p className="text-xs text-[#9c99c4] mt-0.5">
                  A agenda e os locais de atendimento serão exibidos conforme sua opção.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.options.insurances.map((opt) => {
                  const active = insuranceId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectInsurance(opt.id)}
                      className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-sm font-bold transition-all text-center ${
                        active
                          ? "border-white/85 bg-gradient-to-br from-[#8f71ff] to-[#6344ff] text-white shadow-lg shadow-violet-600/30"
                          : "border-white/30 bg-[#141230] text-[#d5d3f5] hover:border-white/80"
                      }`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Datas e Turnos filtrados pelo Convênio escolhido */}
            {!insuranceId ? (
              <div className="rounded-2xl bg-[#1b183d]/70 border border-dashed border-[#363173] p-6 text-center">
                <CalendarIcon className="h-8 w-8 text-[#7c78a8] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#c7c4eb]">
                  Escolha um convênio acima para carregar o calendário
                </p>
                <p className="text-xs text-[#8d8ab8] mt-1">
                  Cada dia e turno pode atender em um local e convênio específico.
                </p>
              </div>
            ) : loadingAvailability ? (
              <div className="rounded-2xl bg-[#1b183d] border border-[#2d295e] p-8 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#8b6dff] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#c7c4eb]">
                  Buscando datas disponíveis para{" "}
                  <strong className="text-white">{selectedInsuranceObj?.name}</strong>...
                </p>
              </div>
            ) : availableDaysList.length === 0 ? (
              <div className="rounded-2xl bg-[#1b183d] border border-[#2d295e] p-6 text-center">
                <CalendarIcon className="h-9 w-9 text-[#7c78a8] mx-auto mb-2" />
                <h2 className="font-bold text-white">
                  Sem vagas disponíveis para {selectedInsuranceObj?.name}
                </h2>
                <p className="text-sm text-[#9c99c4] mt-1">
                  Não há datas abertas para este convênio nos próximos{" "}
                  {data.settings.bookingWindowDays} dias. Tente novamente mais tarde ou
                  selecione outra opção.
                </p>
              </div>
            ) : (
              <>
                {/* Atalho rápido: Próximas datas */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#8d8ab8] mb-2">
                    2. Próximas datas para {selectedInsuranceObj?.name}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {availableDaysList.slice(0, 6).map((d) => {
                      const active = selectedDate === d.date;
                      const [, m, day] = d.date.split("-");
                      const openShifts = d.shifts.filter((s) => s.available);
                      const locNames = Array.from(
                        new Set(
                          openShifts
                            .map((s) => s.location?.name)
                            .filter((n): n is string => Boolean(n))
                        )
                      );
                      const locBadge =
                        locNames.length === 1
                          ? locNames[0]
                          : locNames.length > 1
                          ? `${locNames.length} locais`
                          : null;

                      return (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => handleSelectDate(d.date)}
                          className={`min-h-[64px] min-w-[92px] max-w-[140px] px-3 py-2 rounded-2xl border text-center shrink-0 transition-all ${
                            active
                              ? "bg-gradient-to-br from-[#957bff] to-[#6344ff] border-white/85 text-white shadow-lg shadow-violet-600/35"
                              : "bg-[#1b183d] border-white/30 text-[#e3e1fa] hover:border-white/80"
                          }`}
                        >
                          <div
                            className={`text-[11px] font-medium ${
                              active ? "text-violet-100" : "text-[#8d8ab8]"
                            }`}
                          >
                            {getWeekdayLabel(d.date).slice(0, 3)}
                          </div>
                          <div className="text-sm font-extrabold">
                            {day}/{m}
                          </div>
                          {locBadge && (
                            <div
                              className={`text-[10px] truncate mt-1 font-semibold flex items-center justify-center gap-0.5 ${
                                active ? "text-white" : "text-[#7dd3fc]"
                              }`}
                              title={locNames.join(" / ")}
                            >
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{locBadge}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Calendário Mensal Responsivo */}
                <section className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 shadow-xl shadow-black/25">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={prevMonth}
                      aria-label="Mês anterior"
                      className="h-11 w-11 rounded-xl border border-white/35 bg-[#141230] flex items-center justify-center text-white hover:border-white/85 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-base font-bold text-white">
                      {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                    </h2>
                    <button
                      type="button"
                      onClick={nextMonth}
                      aria-label="Próximo mês"
                      className="h-11 w-11 rounded-xl border border-white/35 bg-[#141230] flex items-center justify-center text-white hover:border-white/85 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1.5">
                    {WEEKDAY_SHORT.map((w) => (
                      <div
                        key={w}
                        className="text-center text-xs font-semibold text-[#7d79ad] py-1"
                      >
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarCells.map((cell, idx) => {
                      if (!cell.dateStr || !cell.dayNum) {
                        return <div key={`empty-${idx}`} className="h-12" />;
                      }
                      const dayInfo = availabilityMap.get(cell.dateStr);
                      const isAvailable = Boolean(dayInfo?.available);
                      const isSelected = selectedDate === cell.dateStr;

                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handleSelectDate(cell.dateStr!)}
                          className={`h-12 rounded-xl text-sm font-bold flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-gradient-to-br from-[#957bff] to-[#6344ff] text-white border border-white/85 shadow-lg shadow-violet-600/40 ring-2 ring-[#b39eff]/50"
                              : isAvailable
                              ? "bg-[#242052] text-white hover:bg-[#2f2a69] border border-white/35 hover:border-white/80"
                              : "text-[#4b4775] bg-transparent cursor-not-allowed"
                          }`}
                        >
                          <span>{cell.dayNum}</span>
                          {isAvailable && !isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4ea8ff] mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Seleção de Turno + Local */}
                {selectedDate && selectedDayInfo && (
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-bold text-white">
                      3. Escolha o turno para {formatDateBR(selectedDate)} (
                      {getWeekdayLabel(selectedDate)})
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      {selectedDayInfo.shifts
                        .filter((s) => s.available)
                        .map((s) => {
                          const isSelected = selectedShift === s.shift;
                          const Icon =
                            s.shift === "MORNING"
                              ? Sun
                              : s.shift === "AFTERNOON"
                              ? Sunset
                              : CalendarIcon;
                          return (
                            <button
                              key={s.shift}
                              type="button"
                              onClick={() => setSelectedShift(s.shift)}
                              className={`min-h-[72px] w-full px-4 py-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                                isSelected
                                  ? "border-white/85 bg-gradient-to-r from-[#2c2569] to-[#232059] shadow-lg shadow-violet-700/25"
                                  : "border-white/30 bg-[#1b183d] hover:border-white/80"
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? "bg-gradient-to-br from-[#957bff] to-[#6344ff] text-white shadow-md"
                                      : "bg-[#141230] text-[#a792ff] border border-[#2f2b63]"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white text-base">
                                    {s.shift === "FULL_DAY"
                                      ? s.shiftLabel
                                      : `Turno da ${s.shiftLabel}`}
                                  </div>
                                  {s.location ? (
                                    <div className="mt-1.5 rounded-lg bg-[#4ea8ff]/12 border border-[#4ea8ff]/35 px-2.5 py-1.5 space-y-0.5">
                                      <div className="text-xs font-bold text-[#7dd3fc] flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{s.location.name}</span>
                                      </div>
                                      {s.location.address && (
                                        <div className="text-[11px] text-[#c7c4eb] leading-snug">
                                          {s.location.address}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-[#9c99c4]">
                                        Atendimento por ordem de chegada
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-[#9c99c4] mt-0.5">
                                      Atendimento por ordem de chegada
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                                    isSelected
                                      ? "bg-gradient-to-r from-[#4ea8ff] to-[#2d7cf6] text-white"
                                      : "bg-emerald-400/15 text-emerald-300 border border-emerald-400/35"
                                  }`}
                                >
                                  {data.settings.showRemainingSlots &&
                                  s.remainingSlots !== null
                                    ? s.remainingSlots === 1
                                      ? "1 vaga"
                                      : `${s.remainingSlots} vagas`
                                    : "Disponível"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    {/* Destaque do Local confirmado para a data e turno escolhidos */}
                    {selectedShiftInfo?.location && (
                      <div className="rounded-2xl bg-gradient-to-r from-[#1a2c54] to-[#1e2054] border border-[#4ea8ff]/50 p-4 flex items-start gap-3 shadow-lg shadow-black/25">
                        <div className="h-10 w-10 rounded-xl bg-[#4ea8ff]/20 border border-[#4ea8ff]/40 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-[#7dd3fc]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7dd3fc]">
                            Local de Atendimento Selecionado
                          </div>
                          <div className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                            {selectedShiftInfo.location.name}
                          </div>
                          {selectedShiftInfo.location.address && (
                            <div className="text-xs text-[#d5d3f5] mt-0.5">
                              {selectedShiftInfo.location.address}
                            </div>
                          )}
                          <div className="text-[11px] text-[#9c99c4] mt-1">
                            {formatDateBR(selectedDate)} ({getWeekdayLabel(selectedDate)}) •{" "}
                            {selectedShiftInfo.shiftLabel}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {/* Barra de ação fixa no rodapé (Mobile) */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#171536]/95 backdrop-blur-lg border-t border-[#2a2759] p-3 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-20">
              <div className="max-w-xl mx-auto">
                <button
                  type="button"
                  disabled={!insuranceId || !selectedDate || !selectedShift}
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-[#9274ff] to-[#6344ff] border border-white/75 hover:border-white text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Continuar para seus dados
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= PASSO 2: DADOS DO PACIENTE ================= */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Resumo da escolha do Passo 1 */}
            <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-[#957bff] shrink-0" />
                    <span className="font-bold text-white">
                      {formatDateBR(selectedDate)} ({getWeekdayLabel(selectedDate)})
                    </span>
                    <span className="text-[#9c99c4]">
                      • {selectedShiftInfo?.shiftLabel || selectedShift}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#252154] text-[#d5d3f5] font-semibold border border-[#3a3578]">
                      {selectedInsuranceObj?.name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-[#252154] border border-white/40 hover:border-white shrink-0 transition-colors"
                >
                  Alterar
                </button>
              </div>

              {selectedShiftInfo?.location && (
                <div className="rounded-xl bg-[#4ea8ff]/12 border border-[#4ea8ff]/40 px-3.5 py-2.5 flex items-start gap-2.5">
                  <Building2 className="h-4 w-4 text-[#7dd3fc] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#7dd3fc]">
                      Local de Atendimento
                    </div>
                    <div className="text-sm font-bold text-white leading-snug">
                      {selectedShiftInfo.location.name}
                    </div>
                    {selectedShiftInfo.location.address && (
                      <div className="text-xs text-[#c7c4eb] mt-0.5">
                        {selectedShiftInfo.location.address}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3.5 flex items-start gap-2.5 text-sm text-rose-200">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 sm:p-5 space-y-5 shadow-xl shadow-black/25">
              {/* Nome Completo */}
              <div>
                <label
                  htmlFor="patientName"
                  className="block text-sm font-bold text-white mb-1.5"
                >
                  Nome completo do paciente *
                </label>
                <input
                  id="patientName"
                  type="text"
                  autoComplete="name"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ex: Maria Aparecida da Silva"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#343069] bg-[#13112d] text-white placeholder-[#6f6c9a] text-base focus:outline-none focus:ring-2 focus:ring-[#8b6dff] focus:border-[#8b6dff]"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label
                  htmlFor="whatsapp"
                  className="block text-sm font-bold text-white mb-1.5"
                >
                  Telefone para contato (de preferência WhatsApp) *
                </label>
                <input
                  id="whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  value={whatsappInput}
                  onChange={(e) => setWhatsappInput(maskBrazilianPhone(e.target.value))}
                  placeholder="(91) 99999-9999"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#343069] bg-[#13112d] text-white placeholder-[#6f6c9a] text-base focus:outline-none focus:ring-2 focus:ring-[#8b6dff] focus:border-[#8b6dff]"
                />
                <p className="text-xs text-[#9c99c4] mt-1">
                  Enviaremos o lembrete e a confirmação da consulta por este número.
                </p>
              </div>

              {/* Tipo de Consulta */}
              <div>
                <span className="block text-sm font-bold text-white mb-2">
                  Tipo de consulta *
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {data.options.visitTypes.map((vt) => {
                    const active = visitTypeId === vt.id;
                    return (
                      <button
                        key={vt.id}
                        type="button"
                        onClick={() => setVisitTypeId(vt.id)}
                        className={`min-h-[52px] px-3 py-3 rounded-xl border text-sm font-bold transition-all ${
                          active
                            ? "border-white/85 bg-gradient-to-r from-[#8f71ff]/25 to-[#4ea8ff]/20 text-white shadow-sm"
                            : "border-white/30 bg-[#141230] text-[#b4b1db] hover:border-white/80 hover:text-white"
                        }`}
                      >
                        {vt.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Joelho Avaliado */}
              <div>
                <span className="block text-sm font-bold text-white mb-2">
                  Qual joelho será avaliado? *
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {data.options.kneeOptions.map((ko) => {
                    const active = kneeOptionId === ko.id;
                    return (
                      <button
                        key={ko.id}
                        type="button"
                        onClick={() => setKneeOptionId(ko.id)}
                        className={`min-h-[52px] px-3 py-3 rounded-xl border text-sm font-bold transition-all ${
                          active
                            ? "border-white/85 bg-gradient-to-r from-[#8f71ff]/25 to-[#4ea8ff]/20 text-white shadow-sm"
                            : "border-white/30 bg-[#141230] text-[#b4b1db] hover:border-white/80 hover:text-white"
                        }`}
                      >
                        {ko.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aceite LGPD */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141230] border border-[#2e2a61] cursor-pointer">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded accent-[#8b6dff] shrink-0"
                />
                <span className="text-xs text-[#b4b1db] leading-relaxed">
                  Concordo com a{" "}
                  <strong className="text-white">
                    Política de Privacidade (LGPD)
                  </strong>{" "}
                  e autorizo o uso dos meus dados para confirmação do agendamento e
                  envio de lembretes via WhatsApp.
                </span>
              </label>
            </div>

            {/* Botões de Ação Fixos no Mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#171536]/95 backdrop-blur-lg border-t border-[#2a2759] p-3 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-20">
              <div className="max-w-xl mx-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[52px] px-4 rounded-xl border border-white/40 bg-[#1b183d] text-[#d5d3f5] font-semibold flex items-center justify-center gap-1.5 hover:border-white hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[52px] rounded-xl bg-gradient-to-r from-[#9274ff] to-[#6344ff] border border-white/75 hover:border-white text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Confirmando vaga...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5" />
                      Confirmar Agendamento
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ================= PASSO 3: COMPROVANTE / PROTOCOLO ================= */}
        {step === 3 && result && (
          <div className="space-y-4">
            {result.duplicate && (
              <div className="rounded-2xl bg-amber-400/15 border border-amber-400/40 p-4 flex items-start gap-3 text-sm text-amber-100">
                <Info className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Agendamento já existente</p>
                  <p className="text-xs text-amber-200/90 mt-0.5">
                    Encontramos um agendamento ativo para este paciente nesta data.
                    Abaixo está o seu comprovante com o protocolo já registrado.
                  </p>
                </div>
              </div>
            )}

            {/* Cartão Comprovante otimizado para print no celular */}
            <div className="bg-[#1b183d] rounded-3xl border border-[#343069] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="bg-gradient-to-br from-[#957bff] via-[#6e52ff] to-[#3b82f6] text-white px-5 py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2.5">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-extrabold">
                  {result.duplicate
                    ? "Protocolo Encontrado"
                    : "Agendamento Realizado!"}
                </h2>
                <p className="text-xs text-violet-100 mt-1">
                  Baixe o comprovante em PDF ou tire um print desta tela para apresentar
                  na recepção
                </p>

                <div className="mt-4 inline-block bg-[#12102b]/90 border border-white/20 text-white rounded-2xl px-6 py-2.5 shadow-lg">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#b39eff]">
                    Protocolo
                  </div>
                  <div className="text-2xl font-black tracking-widest">
                    {result.appointment.protocol}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3.5 text-sm">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#2b275c]">
                  <div>
                    <div className="text-xs text-[#8d8ab8]">Data</div>
                    <div className="font-bold text-white text-base">
                      {result.appointment.dateBR}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8d8ab8]">Turno</div>
                    <div className="font-bold text-white text-base">
                      {result.appointment.shiftLabel}
                    </div>
                  </div>
                </div>

                {result.appointment.location && (
                  <div className="rounded-xl bg-[#4ea8ff]/10 border border-[#4ea8ff]/35 p-3.5 flex items-start gap-2.5">
                    <Building2 className="h-5 w-5 text-[#7dd3fc] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-[#7dd3fc]">
                        Local de Atendimento
                      </div>
                      <div className="font-bold text-white text-base leading-snug">
                        {result.appointment.location}
                      </div>
                      {result.appointment.locationAddress && (
                        <div className="text-xs text-[#c7c4eb] mt-0.5">
                          {result.appointment.locationAddress}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 pb-3 border-b border-[#2b275c]">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8d8ab8]">Paciente</span>
                    <span className="font-semibold text-white text-right">
                      {result.appointment.patientName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8d8ab8]">WhatsApp</span>
                    <span className="font-semibold text-white text-right">
                      {result.appointment.whatsappDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8d8ab8]">Convênio</span>
                    <span className="font-semibold text-white text-right">
                      {result.appointment.insurance}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8d8ab8]">Tipo</span>
                    <span className="font-semibold text-white text-right">
                      {result.appointment.visitType}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#8d8ab8]">Avaliação</span>
                    <span className="font-semibold text-white text-right">
                      {result.appointment.kneeOption}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/30 p-3.5 flex items-start gap-2.5">
                  <MessageCircle className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-100 leading-relaxed">
                    <strong>Confirmação via WhatsApp:</strong> Você receberá uma
                    mensagem no WhatsApp informado antes da consulta para confirmar
                    sua presença.
                  </div>
                </div>

                <div className="rounded-xl bg-[#141230] border border-[#2e2a61] p-3.5 flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-[#a792ff] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#c7c4eb] leading-relaxed">
                    <strong className="block text-white mb-0.5">
                      Orientações do Consultório
                    </strong>
                    {data.settings.protocolInstructions}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-[#9274ff] via-[#6e52ff] to-[#3b82f6] border border-white/80 hover:border-white text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-violet-600/35 hover:brightness-110 transition-all"
              >
                {pdfDownloaded ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Comprovante PDF baixado!
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Baixar Comprovante em PDF
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetBooking}
                className="w-full min-h-[50px] rounded-xl border border-white/40 bg-[#1b183d] text-white font-semibold hover:border-white transition-colors"
              >
                Fazer outro agendamento
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
