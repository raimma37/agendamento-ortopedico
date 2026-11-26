"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  Sliders,
  Trash2,
} from "lucide-react";
import { DAY_OF_WEEK_LABELS, formatDateBR } from "@/lib/normalize";

type ShiftType = "MORNING" | "AFTERNOON" | "FULL_DAY";

interface WeeklyQuotaRow {
  dayOfWeek: number;
  shift: ShiftType;
  maxSlots: number;
  privateReserveSlots: number;
  active: boolean;
}

interface DateExceptionRow {
  id: string;
  date: string;
  shift: ShiftType;
  maxSlots: number;
  privateReserveSlots: number;
  isBlocked: boolean;
  reason: string | null;
}

interface FixedOptionItem {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  isPrivatePriority?: boolean;
}

interface ClinicSettingsData {
  clinicName: string;
  bookingWindowDays: number;
  showRemainingSlots: boolean;
  protocolInstructions: string;
}

const SHIFTS: Array<{ key: ShiftType; label: string }> = [
  { key: "MORNING", label: "Manhã" },
  { key: "AFTERNOON", label: "Tarde" },
  { key: "FULL_DAY", label: "Dia Inteiro" },
];

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

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<"weekly" | "dates" | "options" | "general">("weekly");
  const [toast, setToast] = useState<string | null>(null);

  const [weeklyQuotas, setWeeklyQuotas] = useState<WeeklyQuotaRow[]>([]);
  const [savingWeekly, setSavingWeekly] = useState(false);

  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [exceptions, setExceptions] = useState<DateExceptionRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [exIsBlocked, setExIsBlocked] = useState(false);
  const [exReason, setExReason] = useState("");
  const [exShifts, setExShifts] = useState<
    Record<ShiftType, { enabled: boolean; maxSlots: number; privateReserveSlots: number }>
  >({
    MORNING: { enabled: true, maxSlots: 10, privateReserveSlots: 0 },
    AFTERNOON: { enabled: false, maxSlots: 10, privateReserveSlots: 0 },
    FULL_DAY: { enabled: false, maxSlots: 15, privateReserveSlots: 0 },
  });
  const [savingDate, setSavingDate] = useState(false);

  const [insurances, setInsurances] = useState<FixedOptionItem[]>([]);
  const [visitTypes, setVisitTypes] = useState<FixedOptionItem[]>([]);
  const [kneeOptions, setKneeOptions] = useState<FixedOptionItem[]>([]);
  const [newName, setNewName] = useState({ insurance: "", visitType: "", knee: "" });
  const [newPrivatePriority, setNewPrivatePriority] = useState(false);

  const [settings, setSettings] = useState<ClinicSettingsData>({
    clinicName: "",
    bookingWindowDays: 30,
    showRemainingSlots: true,
    protocolInstructions: "",
  });
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [loading, setLoading] = useState(true);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, oRes, sRes] = await Promise.all([
        fetch("/api/admin/weekly-quotas", { cache: "no-store" }),
        fetch("/api/admin/form-options", { cache: "no-store" }),
        fetch("/api/admin/settings", { cache: "no-store" }),
      ]);
      if (wRes.ok) {
        const wJson = await wRes.json();
        setWeeklyQuotas(wJson.quotas || []);
      }
      if (oRes.ok) {
        const oJson = await oRes.json();
        setInsurances(oJson.insurances || []);
        setVisitTypes(oJson.visitTypes || []);
        setKneeOptions(oJson.kneeOptions || []);
      }
      if (sRes.ok) {
        const sJson = await sRes.json();
        if (sJson.settings) setSettings(sJson.settings);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonthExceptions = useCallback(async () => {
    const mStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}`;
    const res = await fetch(`/api/admin/date-exceptions?month=${mStr}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      setExceptions(json.exceptions || []);
    }
  }, [calMonth]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadMonthExceptions();
  }, [loadMonthExceptions]);

  function getQuota(dow: number, shift: ShiftType): WeeklyQuotaRow {
    return (
      weeklyQuotas.find((q) => q.dayOfWeek === dow && q.shift === shift) || {
        dayOfWeek: dow,
        shift,
        maxSlots: 10,
        privateReserveSlots: 0,
        active: false,
      }
    );
  }

  function updateQuotaLocal(
    dow: number,
    shift: ShiftType,
    patch: Partial<WeeklyQuotaRow>
  ) {
    setWeeklyQuotas((prev) => {
      const exists = prev.some((q) => q.dayOfWeek === dow && q.shift === shift);
      if (!exists) {
        return [
          ...prev,
          {
            dayOfWeek: dow,
            shift,
            maxSlots: 10,
            privateReserveSlots: 0,
            active: false,
            ...patch,
          },
        ];
      }
      return prev.map((q) =>
        q.dayOfWeek === dow && q.shift === shift ? { ...q, ...patch } : q
      );
    });
  }

  function toggleDayActive(dow: number, enable: boolean) {
    if (!enable) {
      for (const s of SHIFTS) updateQuotaLocal(dow, s.key, { active: false });
    } else {
      updateQuotaLocal(dow, "MORNING", { active: true });
    }
  }

  async function saveWeeklyQuotas() {
    setSavingWeekly(true);
    try {
      const res = await fetch("/api/admin/weekly-quotas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotas: weeklyQuotas }),
      });
      if (res.ok) showToast("Grade semanal salva com sucesso!");
    } finally {
      setSavingWeekly(false);
    }
  }

  const exceptionsByDate = useMemo(() => {
    const map = new Map<string, DateExceptionRow[]>();
    for (const ex of exceptions) {
      const list = map.get(ex.date) ?? [];
      list.push(ex);
      map.set(ex.date, list);
    }
    return map;
  }, [exceptions]);

  const calendarCells = useMemo(() => {
    const { year, month } = calMonth;
    const first = new Date(Date.UTC(year, month, 1));
    const startDow = first.getUTCDay();
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ dateStr: null, dayNum: null });
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      cells.push({ dateStr: `${year}-${mStr}-${dStr}`, dayNum: d });
    }
    return cells;
  }, [calMonth]);

  function openDateEditor(dateStr: string) {
    setSelectedDate(dateStr);
    const existing = exceptionsByDate.get(dateStr) ?? [];
    if (existing.length > 0) {
      const blocked = existing.some((e) => e.isBlocked);
      setExIsBlocked(blocked);
      setExReason(existing[0].reason || "");
      setExShifts({
        MORNING: {
          enabled: existing.some((e) => !e.isBlocked && e.shift === "MORNING"),
          maxSlots: existing.find((e) => e.shift === "MORNING")?.maxSlots ?? 10,
          privateReserveSlots:
            existing.find((e) => e.shift === "MORNING")?.privateReserveSlots ?? 0,
        },
        AFTERNOON: {
          enabled: existing.some((e) => !e.isBlocked && e.shift === "AFTERNOON"),
          maxSlots: existing.find((e) => e.shift === "AFTERNOON")?.maxSlots ?? 10,
          privateReserveSlots:
            existing.find((e) => e.shift === "AFTERNOON")?.privateReserveSlots ?? 0,
        },
        FULL_DAY: {
          enabled: existing.some((e) => !e.isBlocked && e.shift === "FULL_DAY"),
          maxSlots: existing.find((e) => e.shift === "FULL_DAY")?.maxSlots ?? 15,
          privateReserveSlots:
            existing.find((e) => e.shift === "FULL_DAY")?.privateReserveSlots ?? 0,
        },
      });
    } else {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const qM = getQuota(dow, "MORNING");
      const qA = getQuota(dow, "AFTERNOON");
      const qF = getQuota(dow, "FULL_DAY");
      setExIsBlocked(false);
      setExReason("");
      setExShifts({
        MORNING: {
          enabled: qM.active,
          maxSlots: qM.maxSlots,
          privateReserveSlots: qM.privateReserveSlots,
        },
        AFTERNOON: {
          enabled: qA.active,
          maxSlots: qA.maxSlots,
          privateReserveSlots: qA.privateReserveSlots,
        },
        FULL_DAY: {
          enabled: qF.active,
          maxSlots: qF.maxSlots,
          privateReserveSlots: qF.privateReserveSlots,
        },
      });
    }
  }

  async function saveDateException() {
    if (!selectedDate) return;
    setSavingDate(true);
    try {
      const shiftsPayload = SHIFTS.filter((s) => exShifts[s.key].enabled).map((s) => ({
        shift: s.key,
        maxSlots: exShifts[s.key].maxSlots,
        privateReserveSlots: exShifts[s.key].privateReserveSlots,
      }));

      const res = await fetch("/api/admin/date-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          isBlocked: exIsBlocked,
          reason: exReason || null,
          shifts: exIsBlocked ? [] : shiftsPayload,
        }),
      });
      if (res.ok) {
        await loadMonthExceptions();
        showToast(`Regra individual salva para ${formatDateBR(selectedDate)}!`);
      }
    } finally {
      setSavingDate(false);
    }
  }

  async function restoreWeeklyForDate() {
    if (!selectedDate) return;
    setSavingDate(true);
    try {
      const res = await fetch(`/api/admin/date-exceptions?date=${selectedDate}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadMonthExceptions();
        showToast(`Padrão semanal restaurado para ${formatDateBR(selectedDate)}.`);
      }
    } finally {
      setSavingDate(false);
    }
  }

  async function createOption(type: "insurance" | "visitType" | "knee") {
    const name = newName[type].trim();
    if (!name) return;
    const res = await fetch("/api/admin/form-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name,
        isPrivatePriority: type === "insurance" ? newPrivatePriority : false,
        active: true,
        sortOrder: 99,
      }),
    });
    if (res.ok) {
      setNewName((p) => ({ ...p, [type]: "" }));
      if (type === "insurance") setNewPrivatePriority(false);
      await loadAll();
      showToast("Opção adicionada com sucesso!");
    } else {
      const j = await res.json();
      showToast(j.error || "Erro ao adicionar opção");
    }
  }

  async function patchOption(
    type: "insurance" | "visitType" | "knee",
    id: string,
    patch: Partial<FixedOptionItem>
  ) {
    const res = await fetch("/api/admin/form-options", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, ...patch }),
    });
    if (res.ok) {
      await loadAll();
      showToast("Opção atualizada!");
    }
  }

  async function deleteOption(type: "insurance" | "visitType" | "knee", id: string) {
    const res = await fetch(`/api/admin/form-options?type=${type}&id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadAll();
      showToast("Opção removida.");
    } else {
      const j = await res.json();
      showToast(j.error || "Não foi possível remover.");
    }
  }

  async function saveGeneralSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingGeneral(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) showToast("Parâmetros gerais salvos!");
    } finally {
      setSavingGeneral(false);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-[#9c99c4]">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-[#8b6dff] mb-2" />
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Configurações
          </h1>
          <p className="text-sm text-[#9c99c4]">
            Cotas semanais, datas individuais, opções fixas e parâmetros do consultório
          </p>
        </div>
        {toast && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white text-sm font-semibold shadow-lg shadow-violet-600/30">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2 border-b border-[#292657] pb-3.5">
        {[
          { id: "weekly", label: "1. Dias da Semana e Quantidades", icon: Sliders },
          { id: "dates", label: "2. Datas Individuais", icon: CalendarIcon },
          { id: "options", label: "3. Opções Fixas do Formulário", icon: ListChecks },
          { id: "general", label: "4. Parâmetros Gerais", icon: Settings2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                active
                  ? "bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white shadow-lg shadow-violet-600/30"
                  : "bg-[#1b183d] border border-[#2f2b63] text-[#b4b1db] hover:text-white hover:border-[#7c5cff]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ================= ABA 1: DIAS DA SEMANA ================= */}
      {tab === "weekly" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#221d52] border border-[#453d91] p-4 text-xs text-[#d6d2ff] flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-[#a792ff] shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Reserva Silenciosa Particular:</strong>{" "}
              Quando configurada (&gt; 0), essas vagas ficam ocultas e reservadas
              exclusivamente para quem selecionar um convênio marcado como{" "}
              <em>Prioridade Silenciosa (Particular)</em>. O portal público nunca exibe
              essa regra.
            </span>
          </div>

          <div className="space-y-3">
            {DAY_OF_WEEK_LABELS.map((dayName, dow) => {
              const anyActive = SHIFTS.some((s) => getQuota(dow, s.key).active);
              return (
                <div
                  key={dow}
                  className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 shadow-lg shadow-black/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-white">{dayName}</div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={anyActive}
                        onChange={(e) => toggleDayActive(dow, e.target.checked)}
                        className="h-4 w-4 rounded accent-[#8b6dff]"
                      />
                      <span className={anyActive ? "text-[#a792ff]" : "text-[#6f6c9e]"}>
                        {anyActive ? "Atende" : "Não atende"}
                      </span>
                    </label>
                  </div>

                  {anyActive && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {SHIFTS.map((s) => {
                        const q = getQuota(dow, s.key);
                        return (
                          <div
                            key={s.key}
                            className={`rounded-xl border p-3.5 transition-all ${
                              q.active
                                ? "border-[#6344ff]/60 bg-[#221e4d]"
                                : "border-[#2a2657] bg-[#141230] opacity-65"
                            }`}
                          >
                            <label className="flex items-center gap-2 text-sm font-bold text-white mb-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.active}
                                onChange={(e) =>
                                  updateQuotaLocal(dow, s.key, {
                                    active: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded accent-[#8b6dff]"
                              />
                              {s.label}
                            </label>

                            {q.active && (
                              <div className="grid grid-cols-2 gap-2.5 text-xs">
                                <div>
                                  <label className="block text-[#9c99c4] mb-1">
                                    Máx. vagas
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={q.maxSlots}
                                    onChange={(e) =>
                                      updateQuotaLocal(dow, s.key, {
                                        maxSlots: Math.max(0, Number(e.target.value)),
                                      })
                                    }
                                    className="w-full h-9 px-2.5 rounded-lg border border-[#3a3675] bg-[#13112d] text-white font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[#b39eff] mb-1">
                                    Reserva Part.
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={q.maxSlots}
                                    value={q.privateReserveSlots}
                                    onChange={(e) =>
                                      updateQuotaLocal(dow, s.key, {
                                        privateReserveSlots: Math.max(
                                          0,
                                          Number(e.target.value)
                                        ),
                                      })
                                    }
                                    className="w-full h-9 px-2.5 rounded-lg border border-[#5c4ab8] bg-[#13112d] text-white font-bold"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingWeekly}
              onClick={saveWeeklyQuotas}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-50"
            >
              {savingWeekly ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Grade Semanal
            </button>
          </div>
        </div>
      )}

      {/* ================= ABA 2: DATAS INDIVIDUAIS ================= */}
      {tab === "dates" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-[#1b183d] rounded-2xl border border-[#2d295e] p-5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() =>
                  setCalMonth((p) =>
                    p.month === 0
                      ? { year: p.year - 1, month: 11 }
                      : { year: p.year, month: p.month - 1 }
                  )
                }
                className="h-9 w-9 rounded-xl border border-[#343069] bg-[#13112d] text-white flex items-center justify-center hover:border-[#8b6dff]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="font-bold text-white">
                {MONTH_NAMES[calMonth.month]} {calMonth.year}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setCalMonth((p) =>
                    p.month === 11
                      ? { year: p.year + 1, month: 0 }
                      : { year: p.year, month: p.month + 1 }
                  )
                }
                className="h-9 w-9 rounded-xl border border-[#343069] bg-[#13112d] text-white flex items-center justify-center hover:border-[#8b6dff]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#7d79ad] mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((c, i) => {
                if (!c.dateStr || !c.dayNum) return <div key={i} className="h-12" />;
                const exList = exceptionsByDate.get(c.dateStr) ?? [];
                const isBlocked = exList.some((e) => e.isBlocked);
                const isCustom = exList.length > 0 && !isBlocked;
                const isSelected = selectedDate === c.dateStr;

                return (
                  <button
                    key={c.dateStr}
                    type="button"
                    onClick={() => openDateEditor(c.dateStr!)}
                    className={`h-12 rounded-xl text-sm font-bold border flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? "bg-gradient-to-br from-[#9274ff] to-[#6344ff] text-white border-transparent shadow-lg shadow-violet-600/35"
                        : isBlocked
                        ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
                        : isCustom
                        ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
                        : "bg-[#141230] text-[#d5d3f5] border-[#2c285c] hover:border-[#8b6dff]"
                    }`}
                  >
                    <span>{c.dayNum}</span>
                    {isBlocked && (
                      <span className="text-[9px] uppercase font-bold">Bloq.</span>
                    )}
                    {isCustom && (
                      <span className="text-[9px] uppercase font-bold">Custom</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[#2b275c] text-xs text-[#9c99c4]">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-rose-500/30 border border-rose-500/50" />
                Bloqueado (feriado/folga)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-400/30 border border-amber-400/50" />
                Personalizado (sobrescreve semana)
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#1b183d] rounded-2xl border border-[#2d295e] p-5 shadow-lg shadow-black/20">
            {!selectedDate ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#7d79ad] py-10">
                <CalendarIcon className="h-10 w-10 mb-2 text-[#6344ff]" />
                <p className="text-sm font-semibold text-white">
                  Clique em qualquer data no calendário
                </p>
                <p className="text-xs mt-1 text-[#9c99c4]">
                  Bloqueie feriados, abra datas extras ou altere a quantidade de vagas
                  individualmente.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#2b275c] pb-3">
                  <div>
                    <h3 className="font-bold text-white">
                      Data: {formatDateBR(selectedDate)}
                    </h3>
                    <p className="text-xs text-[#9c99c4]">
                      Sobrescreve a regra semanal apenas neste dia
                    </p>
                  </div>
                  {exceptionsByDate.has(selectedDate) && (
                    <button
                      type="button"
                      onClick={restoreWeeklyForDate}
                      disabled={savingDate}
                      className="text-xs font-semibold text-[#a792ff] hover:text-rose-300 flex items-center gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar semana
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exIsBlocked}
                    onChange={(e) => setExIsBlocked(e.target.checked)}
                    className="h-4 w-4 rounded accent-rose-500"
                  />
                  <span className="text-sm font-bold text-rose-200">
                    Bloquear esta data (sem atendimento)
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                    Motivo / Observação (interno)
                  </label>
                  <input
                    type="text"
                    value={exReason}
                    onChange={(e) => setExReason(e.target.value)}
                    placeholder="Ex: Feriado, Congresso, Mutirão de sábado..."
                    className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
                  />
                </div>

                {!exIsBlocked && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[#a792ff] uppercase">
                      Turnos e Vagas para esta data
                    </div>
                    {SHIFTS.map((s) => {
                      const cfg = exShifts[s.key];
                      return (
                        <div
                          key={s.key}
                          className="rounded-xl border border-[#2e2a61] bg-[#141230] p-3 space-y-2"
                        >
                          <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cfg.enabled}
                              onChange={(e) =>
                                setExShifts((prev) => ({
                                  ...prev,
                                  [s.key]: { ...prev[s.key], enabled: e.target.checked },
                                }))
                              }
                              className="h-4 w-4 rounded accent-[#8b6dff]"
                            />
                            {s.label}
                          </label>
                          {cfg.enabled && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[#9c99c4] mb-1">
                                  Máx. vagas
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={cfg.maxSlots}
                                  onChange={(e) =>
                                    setExShifts((prev) => ({
                                      ...prev,
                                      [s.key]: {
                                        ...prev[s.key],
                                        maxSlots: Math.max(0, Number(e.target.value)),
                                      },
                                    }))
                                  }
                                  className="w-full h-9 px-2.5 rounded-lg border border-[#3a3675] bg-[#1b183d] text-white font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[#b39eff] mb-1">
                                  Reserva Part.
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={cfg.maxSlots}
                                  value={cfg.privateReserveSlots}
                                  onChange={(e) =>
                                    setExShifts((prev) => ({
                                      ...prev,
                                      [s.key]: {
                                        ...prev[s.key],
                                        privateReserveSlots: Math.max(
                                          0,
                                          Number(e.target.value)
                                        ),
                                      },
                                    }))
                                  }
                                  className="w-full h-9 px-2.5 rounded-lg border border-[#5c4ab8] bg-[#1b183d] text-white font-bold"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  disabled={savingDate}
                  onClick={saveDateException}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-50"
                >
                  {savingDate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Configuração da Data
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ABA 3: OPÇÕES FIXAS DO FORMULÁRIO ================= */}
      {tab === "options" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Convênios */}
          <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 space-y-4 shadow-lg shadow-black/20">
            <div>
              <h3 className="font-bold text-white">Convênios / Particular</h3>
              <p className="text-xs text-[#9c99c4]">
                Opções fixas do portal (flag de prioridade é interna)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName.insurance}
                  onChange={(e) =>
                    setNewName((p) => ({ ...p, insurance: e.target.value }))
                  }
                  placeholder="Novo convênio..."
                  className="flex-1 h-9 px-3 rounded-lg border border-[#322e66] bg-[#13112d] text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => createOption("insurance")}
                  className="h-9 px-3 rounded-lg bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#b39eff] font-medium">
                <input
                  type="checkbox"
                  checked={newPrivatePriority}
                  onChange={(e) => setNewPrivatePriority(e.target.checked)}
                  className="accent-[#8b6dff]"
                />
                Prioridade Silenciosa (Particular)
              </label>
            </div>

            <div className="divide-y divide-[#282454]">
              {insurances.map((opt) => (
                <div key={opt.id} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        opt.active ? "text-white" : "text-[#6f6c9e] line-through"
                      }`}
                    >
                      {opt.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          patchOption("insurance", opt.id, { active: !opt.active })
                        }
                        className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                          opt.active
                            ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/35"
                            : "bg-[#141230] text-[#8d8ab8] border-[#2e2a61]"
                        }`}
                      >
                        {opt.active ? "Ativo" : "Inativo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOption("insurance", opt.id)}
                        className="p-1.5 text-[#7d79ad] hover:text-rose-400"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#b39eff] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(opt.isPrivatePriority)}
                      onChange={(e) =>
                        patchOption("insurance", opt.id, {
                          isPrivatePriority: e.target.checked,
                        })
                      }
                      className="accent-[#8b6dff]"
                    />
                    Prioridade Silenciosa (Particular)
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Tipo de Consulta */}
          <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 space-y-4 shadow-lg shadow-black/20">
            <div>
              <h3 className="font-bold text-white">Tipo de Consulta</h3>
              <p className="text-xs text-[#9c99c4]">Ex: Primeira vez, Retorno</p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newName.visitType}
                onChange={(e) =>
                  setNewName((p) => ({ ...p, visitType: e.target.value }))
                }
                placeholder="Novo tipo..."
                className="flex-1 h-9 px-3 rounded-lg border border-[#322e66] bg-[#13112d] text-white text-sm"
              />
              <button
                type="button"
                onClick={() => createOption("visitType")}
                className="h-9 px-3 rounded-lg bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            <div className="divide-y divide-[#282454]">
              {visitTypes.map((opt) => (
                <div
                  key={opt.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <span
                    className={`text-sm font-semibold ${
                      opt.active ? "text-white" : "text-[#6f6c9e] line-through"
                    }`}
                  >
                    {opt.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchOption("visitType", opt.id, { active: !opt.active })
                      }
                      className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                        opt.active
                          ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/35"
                          : "bg-[#141230] text-[#8d8ab8] border-[#2e2a61]"
                      }`}
                    >
                      {opt.active ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOption("visitType", opt.id)}
                      className="p-1.5 text-[#7d79ad] hover:text-rose-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Joelho Avaliado */}
          <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 space-y-4 shadow-lg shadow-black/20">
            <div>
              <h3 className="font-bold text-white">Joelho Avaliado</h3>
              <p className="text-xs text-[#9c99c4]">
                Ex: Joelho Direito, Joelho Esquerdo, Ambos
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newName.knee}
                onChange={(e) => setNewName((p) => ({ ...p, knee: e.target.value }))}
                placeholder="Nova opção..."
                className="flex-1 h-9 px-3 rounded-lg border border-[#322e66] bg-[#13112d] text-white text-sm"
              />
              <button
                type="button"
                onClick={() => createOption("knee")}
                className="h-9 px-3 rounded-lg bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            <div className="divide-y divide-[#282454]">
              {kneeOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <span
                    className={`text-sm font-semibold ${
                      opt.active ? "text-white" : "text-[#6f6c9e] line-through"
                    }`}
                  >
                    {opt.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        patchOption("knee", opt.id, { active: !opt.active })
                      }
                      className={`text-[11px] font-bold px-2 py-1 rounded-md border ${
                        opt.active
                          ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/35"
                          : "bg-[#141230] text-[#8d8ab8] border-[#2e2a61]"
                      }`}
                    >
                      {opt.active ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOption("knee", opt.id)}
                      className="p-1.5 text-[#7d79ad] hover:text-rose-400"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= ABA 4: PARÂMETROS GERAIS ================= */}
      {tab === "general" && (
        <form
          onSubmit={saveGeneralSettings}
          className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-6 max-w-2xl space-y-5 shadow-lg shadow-black/20"
        >
          <div>
            <label className="block text-sm font-bold text-white mb-1.5">
              Nome do Consultório / Médico
            </label>
            <input
              type="text"
              required
              value={settings.clinicName}
              onChange={(e) =>
                setSettings((p) => ({ ...p, clinicName: e.target.value }))
              }
              className="w-full h-11 px-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
            />
            <p className="text-xs text-[#9c99c4] mt-1">
              Exibido no portal público do paciente e no cabeçalho dos relatórios
              impressos.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-1.5">
              Janela de agendamento (próximos X dias)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              required
              value={settings.bookingWindowDays}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  bookingWindowDays: Math.max(1, Number(e.target.value)),
                }))
              }
              className="w-36 h-11 px-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm font-bold"
            />
          </div>

          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#141230] border border-[#2e2a61] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showRemainingSlots}
              onChange={(e) =>
                setSettings((p) => ({ ...p, showRemainingSlots: e.target.checked }))
              }
              className="h-4 w-4 rounded accent-[#8b6dff]"
            />
            <span className="text-sm text-[#e3e1fa] font-medium">
              Exibir quantidade de vagas restantes no portal (ex: &quot;Restam 4
              vagas&quot;). Se desmarcado, exibe apenas &quot;Disponível&quot;.
            </span>
          </label>

          <div>
            <label className="block text-sm font-bold text-white mb-1.5">
              Orientações exibidas na tela de Protocolo
            </label>
            <textarea
              rows={4}
              required
              value={settings.protocolInstructions}
              onChange={(e) =>
                setSettings((p) => ({ ...p, protocolInstructions: e.target.value }))
              }
              className="w-full p-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingGeneral}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 disabled:opacity-50"
          >
            {savingGeneral ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Parâmetros Gerais
          </button>
        </form>
      )}
    </div>
  );
}
