"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Sun,
  Sunset,
  UserCheck,
} from "lucide-react";
import { formatDateBR, maskBrazilianPhone } from "@/lib/normalize";

interface ShiftAvailability {
  shift: "MORNING" | "AFTERNOON" | "FULL_DAY";
  shiftLabel: string;
  available: boolean;
  remainingSlots: number | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<
    "MORNING" | "AFTERNOON" | "FULL_DAY" | ""
  >("");

  // Mês exibido no calendário
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(
    () => {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
  );

  // Passo 2 - Dados do paciente
  const [patientName, setPatientName] = useState("");
  const [whatsappInput, setWhatsappInput] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [visitTypeId, setVisitTypeId] = useState("");
  const [kneeOptionId, setKneeOptionId] = useState("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Passo 3 - Comprovante
  const [result, setResult] = useState<{
    duplicate: boolean;
    message?: string;
    appointment: BookedAppointment;
  } | null>(null);

  async function fetchBootstrap() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/public/bootstrap", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar agenda disponível.");
      const json: BootstrapData = await res.json();
      setData(json);

      // Seleciona automaticamente o mês da primeira data disponível
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
    }
  }

  useEffect(() => {
    void fetchBootstrap();
  }, []);

  const availabilityMap = useMemo(() => {
    const map = new Map<string, DayAvailability>();
    if (data) {
      for (const d of data.availability) {
        map.set(d.date, d);
      }
    }
    return map;
  }, [data]);

  const availableDaysList = useMemo(() => {
    if (!data) return [];
    return data.availability.filter((d) => d.available);
  }, [data]);

  const selectedDayInfo = selectedDate ? availabilityMap.get(selectedDate) : undefined;

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startDow = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startDow; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      cells.push({ dateStr: `${year}-${mStr}-${dStr}`, dayNum: day });
    }
    return cells;
  }, [calendarMonth]);

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
        if (res.status === 409) {
          // Recarrega disponibilidade caso o turno tenha lotado
          void fetchBootstrap();
        }
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
    setSelectedDate("");
    setSelectedShift("");
    setPatientName("");
    setWhatsappInput("");
    setInsuranceId("");
    setVisitTypeId("");
    setKneeOptionId("");
    setLgpdAccepted(false);
    setSubmitError(null);
    setResult(null);
    void fetchBootstrap();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-9 w-9 animate-spin text-teal-600 mb-3" />
        <p className="text-slate-600 font-medium text-base">
          Carregando datas disponíveis...
        </p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
        <h1 className="text-lg font-semibold text-slate-900 mb-1">
          Não foi possível carregar a agenda
        </h1>
        <p className="text-sm text-slate-600 mb-5 max-w-sm">
          {loadError || "Tente novamente em alguns instantes."}
        </p>
        <button
          type="button"
          onClick={fetchBootstrap}
          className="min-h-[48px] px-6 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      {/* Cabeçalho compacto Mobile-First */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-tight">
                {data.settings.clinicName}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                Agendamento online • Ordem de chegada
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="text-xs font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1 shrink-0 py-2 px-2 rounded-lg"
            title="Acesso Administrativo"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>

        {/* Barra de Progresso (Passo 1 de 3, 2 de 3, 3 de 3) */}
        <div className="max-w-xl mx-auto px-4 pb-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span>Passo {step} de 3</span>
            <span className="text-teal-700">
              {step === 1 && "Data e Turno"}
              {step === 2 && "Dados do Paciente"}
              {step === 3 && "Comprovante"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-colors ${
                  s <= step ? "bg-teal-600" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-5 pb-28 sm:pb-10">
        {/* ================= PASSO 1: DATA E TURNO ================= */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Aviso de Ordem de Chegada */}
            <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3.5 flex items-start gap-3">
              <Clock className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-sm text-teal-950 leading-snug">
                <p className="font-semibold">Atendimento por ordem de chegada</p>
                <p className="text-teal-800 text-xs mt-0.5">
                  Não há horário marcado. Escolha o dia e o turno desejados para
                  garantir sua vaga.
                </p>
              </div>
            </div>

            {availableDaysList.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
                <CalendarIcon className="h-9 w-9 text-slate-400 mx-auto mb-2" />
                <h2 className="font-semibold text-slate-900">
                  Sem vagas disponíveis no momento
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Todas as vagas para os próximos {data.settings.bookingWindowDays}{" "}
                  dias foram preenchidas. Tente novamente mais tarde.
                </p>
              </div>
            ) : (
              <>
                {/* Atalho rápido: Próximas datas disponíveis */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Próximas datas disponíveis
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {availableDaysList.slice(0, 6).map((d) => {
                      const active = selectedDate === d.date;
                      const [, m, day] = d.date.split("-");
                      return (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => handleSelectDate(d.date)}
                          className={`min-h-[56px] min-w-[78px] px-3 py-2 rounded-xl border text-center shrink-0 transition-all ${
                            active
                              ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-800 hover:border-teal-400"
                          }`}
                        >
                          <div
                            className={`text-[11px] font-medium ${
                              active ? "text-teal-100" : "text-slate-500"
                            }`}
                          >
                            {getWeekdayLabel(d.date).slice(0, 3)}
                          </div>
                          <div className="text-sm font-bold">
                            {day}/{m}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Calendário Mensal Responsivo */}
                <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={prevMonth}
                      aria-label="Mês anterior"
                      className="h-11 w-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h2 className="text-base font-bold text-slate-900">
                      {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                    </h2>
                    <button
                      type="button"
                      onClick={nextMonth}
                      aria-label="Próximo mês"
                      className="h-11 w-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1.5">
                    {WEEKDAY_SHORT.map((w) => (
                      <div
                        key={w}
                        className="text-center text-xs font-semibold text-slate-400 py-1"
                      >
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
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
                          className={`h-12 rounded-xl text-sm font-semibold flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-teal-600 text-white shadow-sm ring-2 ring-teal-300"
                              : isAvailable
                              ? "bg-teal-50/70 text-teal-900 hover:bg-teal-100 border border-teal-200"
                              : "text-slate-300 bg-transparent cursor-not-allowed"
                          }`}
                        >
                          <span>{cell.dayNum}</span>
                          {isAvailable && !isSelected && (
                            <span className="h-1 w-1 rounded-full bg-teal-600 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Seleção de Turno */}
                {selectedDate && selectedDayInfo && (
                  <section className="space-y-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Escolha o turno para {formatDateBR(selectedDate)} (
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
                              className={`min-h-[64px] w-full px-4 py-3.5 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all ${
                                isSelected
                                  ? "border-teal-600 bg-teal-50/80 shadow-xs"
                                  : "border-slate-200 bg-white hover:border-teal-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-teal-600 text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-base">
                                    Turno da {s.shiftLabel}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Atendimento por ordem de chegada
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                    isSelected
                                      ? "bg-teal-600 text-white"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
                  </section>
                )}
              </>
            )}

            {/* Barra de ação fixa no rodapé (Mobile) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 p-3 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-20">
              <div className="max-w-xl mx-auto">
                <button
                  type="button"
                  disabled={!selectedDate || !selectedShift}
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full min-h-[52px] rounded-xl bg-teal-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <CalendarIcon className="h-5 w-5 text-teal-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-slate-900">
                    {formatDateBR(selectedDate)}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    •{" "}
                    {selectedDayInfo?.shifts.find((s) => s.shift === selectedShift)
                      ?.shiftLabel || selectedShift}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-teal-700 hover:underline px-2 py-1"
              >
                Alterar
              </button>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5 shadow-xs">
              {/* Nome Completo */}
              <div>
                <label
                  htmlFor="patientName"
                  className="block text-sm font-bold text-slate-800 mb-1.5"
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
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label
                  htmlFor="whatsapp"
                  className="block text-sm font-bold text-slate-800 mb-1.5"
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
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enviaremos o lembrete e a confirmação da consulta por este número.
                </p>
              </div>

              {/* Convênio / Particular (Opções fixas — zero indicação de prioridade) */}
              <div>
                <label
                  htmlFor="insuranceId"
                  className="block text-sm font-bold text-slate-800 mb-1.5"
                >
                  Convênio ou Particular *
                </label>
                <select
                  id="insuranceId"
                  required
                  value={insuranceId}
                  onChange={(e) => setInsuranceId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Selecione uma opção...</option>
                  {data.options.insurances.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Consulta (Cards grandes clicáveis) */}
              <div>
                <span className="block text-sm font-bold text-slate-800 mb-2">
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
                        className={`min-h-[52px] px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900 shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {vt.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Qual joelho será avaliado (Cards grandes clicáveis) */}
              <div>
                <span className="block text-sm font-bold text-slate-800 mb-2">
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
                        className={`min-h-[52px] px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900 shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {ko.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aceite LGPD */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Concordo com a{" "}
                  <strong className="text-slate-800">
                    Política de Privacidade (LGPD)
                  </strong>{" "}
                  e autorizo o uso dos meus dados para confirmação do agendamento e
                  envio de lembretes via WhatsApp.
                </span>
              </label>
            </div>

            {/* Botões de Ação Fixos no Mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 p-3 sm:static sm:bg-transparent sm:border-0 sm:p-0 z-20">
              <div className="max-w-xl mx-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[52px] px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[52px] rounded-xl bg-teal-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-sm hover:bg-teal-700 disabled:opacity-50"
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
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3 text-sm text-amber-900">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Agendamento já existente</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Encontramos um agendamento ativo para este paciente nesta data.
                    Abaixo está o seu comprovante com o protocolo já registrado.
                  </p>
                </div>
              </div>
            )}

            {/* Cartão Comprovante otimizado para print no celular */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-teal-600 text-white px-5 py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-2.5">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold">
                  {result.duplicate
                    ? "Protocolo Encontrado"
                    : "Agendamento Realizado!"}
                </h2>
                <p className="text-xs text-teal-100 mt-1">
                  Tire um print desta tela para apresentar na recepção
                </p>

                <div className="mt-4 inline-block bg-white text-teal-900 rounded-2xl px-6 py-2.5 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-teal-600">
                    Protocolo
                  </div>
                  <div className="text-2xl font-black tracking-widest">
                    {result.appointment.protocol}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-3.5 text-sm">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500">Data</div>
                    <div className="font-bold text-slate-900 text-base">
                      {result.appointment.dateBR}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Turno</div>
                    <div className="font-bold text-slate-900 text-base">
                      {result.appointment.shiftLabel}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pb-3 border-b border-slate-100">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Paciente</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {result.appointment.patientName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">WhatsApp</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {result.appointment.whatsappDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Convênio</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {result.appointment.insurance}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Tipo</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {result.appointment.visitType}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Avaliação</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {result.appointment.kneeOption}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-start gap-2.5">
                  <MessageCircle className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 leading-relaxed">
                    <strong>Confirmação via WhatsApp:</strong> Você receberá uma
                    mensagem no WhatsApp informado antes da consulta para confirmar
                    sua presença.
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <strong className="block text-slate-900 mb-0.5">
                      Orientações do Consultório
                    </strong>
                    {data.settings.protocolInstructions}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetBooking}
              className="w-full min-h-[50px] rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50"
            >
              Fazer outro agendamento
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
