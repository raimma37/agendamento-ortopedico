"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  Filter,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  Square,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import { addDaysISO, getTodayISO } from "@/lib/normalize";

interface ReportRow {
  order: number;
  id: string;
  protocol: string;
  patientName: string;
  whatsappDisplay: string;
  date: string;
  dateBR: string;
  shift: string;
  shiftLabel: string;
  location: string | null;
  insurance: string;
  visitType: string;
  kneeOption: string;
  status: string;
  statusLabel: string;
  checkedInAt: string | null;
  notes: string;
}

interface ReportSummary {
  total: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  completed: number;
  canceled: number;
  noShow: number;
  confirmationRate: number;
  attendanceRate: number;
  cancellationRate: number;
  byInsurance: Record<string, number>;
  byLocation: Record<string, number>;
  byVisitType: Record<string, number>;
  byKneeOption: Record<string, number>;
  byShift: Record<string, number>;
  byStatus: Record<string, number>;
  byDate: Array<{ date: string; dateBR: string; count: number }>;
}

interface ReportData {
  clinicName: string;
  generatedAt: string;
  filters: {
    startDate: string;
    endDate: string;
    startDateBR: string;
    endDateBR: string;
    shift: string;
    shiftLabel: string;
    locationLabel: string;
    insuranceLabel: string;
    visitTypeLabel: string;
    kneeOptionLabel: string;
    statusLabel: string;
    search: string;
    hideCanceled: boolean;
  };
  summary: ReportSummary;
  insurances: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  visitTypes: Array<{ id: string; name: string }>;
  kneeOptions: Array<{ id: string; name: string }>;
  rows: ReportRow[];
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-400/15 text-amber-300 border-amber-400/35",
  CONFIRMED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/35",
  CHECKED_IN: "bg-sky-400/15 text-sky-300 border-sky-400/35",
  COMPLETED: "bg-violet-400/20 text-violet-200 border-violet-400/40",
  CANCELED: "bg-rose-500/15 text-rose-300 border-rose-500/35",
  NO_SHOW: "bg-slate-400/15 text-slate-300 border-slate-400/35",
};

function computeStatsFromRows(rows: ReportRow[]): ReportSummary {
  const byInsurance: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const byVisitType: Record<string, number> = {};
  const byKneeOption: Record<string, number> = {};
  const byShift: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byDateMap = new Map<string, { dateBR: string; count: number }>();

  let confirmed = 0;
  let pending = 0;
  let checkedIn = 0;
  let completed = 0;
  let canceled = 0;
  let noShow = 0;

  for (const r of rows) {
    const loc = r.location || "Não especificado";
    byInsurance[r.insurance] = (byInsurance[r.insurance] || 0) + 1;
    byLocation[loc] = (byLocation[loc] || 0) + 1;
    byVisitType[r.visitType] = (byVisitType[r.visitType] || 0) + 1;
    byKneeOption[r.kneeOption] = (byKneeOption[r.kneeOption] || 0) + 1;
    byShift[r.shiftLabel] = (byShift[r.shiftLabel] || 0) + 1;
    byStatus[r.statusLabel] = (byStatus[r.statusLabel] || 0) + 1;

    const existingDate = byDateMap.get(r.date);
    if (existingDate) {
      existingDate.count++;
    } else {
      byDateMap.set(r.date, { dateBR: r.dateBR, count: 1 });
    }

    if (
      r.status === "CONFIRMED" ||
      r.status === "CHECKED_IN" ||
      r.status === "COMPLETED"
    ) {
      confirmed++;
    }
    if (r.status === "PENDING") pending++;
    if (r.status === "CHECKED_IN") checkedIn++;
    if (r.status === "COMPLETED") completed++;
    if (r.status === "CANCELED") canceled++;
    if (r.status === "NO_SHOW") noShow++;
  }

  const total = rows.length;
  return {
    total,
    confirmed,
    pending,
    checkedIn,
    completed,
    canceled,
    noShow,
    confirmationRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
    attendanceRate: total > 0 ? Math.round(((checkedIn + completed) / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round(((canceled + noShow) / total) * 100) : 0,
    byInsurance,
    byLocation,
    byVisitType,
    byKneeOption,
    byShift,
    byStatus,
    byDate: Array.from(byDateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, info]) => ({ date, dateBR: info.dateBR, count: info.count })),
  };
}

function StatDistributionCard({
  title,
  icon: Icon,
  entries,
  total,
  barClass,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  entries: Record<string, number>;
  total: number;
  barClass: string;
}) {
  const sorted = Object.entries(entries).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 shadow-lg shadow-black/20 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Icon className="h-4 w-4 text-[#957bff]" />
          <span>{title}</span>
        </div>
        <span className="text-[11px] font-semibold text-[#8d8ab8]">
          {sorted.length} {sorted.length === 1 ? "categoria" : "categorias"}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-xs text-[#7d79ad] py-4 text-center">
          Sem dados para o filtro atual.
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {sorted.map(([label, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-[#e3e1fa] font-medium truncate">{label}</span>
                  <span className="font-bold text-white whitespace-nowrap">
                    {count}{" "}
                    <span className="text-[#9c99c4] font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#12102b] border border-[#2a2659] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barClass} transition-all`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const today = getTodayISO();

  const [startDate, setStartDate] = useState(searchParams.get("startDate") || today);
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") || searchParams.get("startDate") || today
  );
  const [shift, setShift] = useState("");
  const [locationId, setLocationId] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [visitTypeId, setVisitTypeId] = useState("");
  const [kneeOptionId, setKneeOptionId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [hideCanceled, setHideCanceled] = useState(true);
  const [includeStatsInPrint, setIncludeStatsInPrint] = useState(true);
  const [landscape, setLandscape] = useState(false);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Seleção para impressão/exportação seletiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSelectedOnly, setPreviewSelectedOnly] = useState(false);

  const buildFilterQuery = useCallback(() => {
    const p = new URLSearchParams({
      startDate,
      endDate,
      hideCanceled: String(hideCanceled),
    });
    if (shift) p.set("shift", shift);
    if (locationId) p.set("locationId", locationId);
    if (insuranceId) p.set("insuranceId", insuranceId);
    if (visitTypeId) p.set("visitTypeId", visitTypeId);
    if (kneeOptionId) p.set("kneeOptionId", kneeOptionId);
    if (status) p.set("status", status);
    if (search.trim()) p.set("search", search.trim());
    return p;
  }, [
    startDate,
    endDate,
    shift,
    locationId,
    insuranceId,
    visitTypeId,
    kneeOptionId,
    status,
    search,
    hideCanceled,
  ]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?${buildFilterQuery().toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json: ReportData = await res.json();
        setReport(json);
        // Mantém selecionados apenas IDs ainda presentes no filtro atual (sem recriar Set se nada mudou)
        const validIds = new Set(json.rows.map((r) => r.id));
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          let changed = false;
          const next = new Set<string>();
          for (const id of prev) {
            if (validIds.has(id)) {
              next.add(id);
            } else {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [buildFilterQuery]);

  useEffect(() => {
    const timer = setTimeout(() => void loadReport(), 180);
    return () => clearTimeout(timer);
  }, [loadReport]);

  const hasSelection = selectedIds.size > 0;

  // Linhas efetivas para estatísticas e impressão (selecionadas ou todas filtradas)
  const effectiveRows = useMemo(() => {
    if (!report) return [];
    if (!hasSelection) return report.rows;
    return report.rows.filter((r) => selectedIds.has(r.id));
  }, [report, hasSelection, selectedIds]);

  // Estatísticas recalculadas em tempo real para o conjunto ativo (selecionado ou filtrado)
  const activeStats = useMemo(
    () => computeStatsFromRows(effectiveRows),
    [effectiveRows]
  );

  const displayedScreenRows = useMemo(() => {
    if (!report) return [];
    if (previewSelectedOnly && hasSelection) {
      return report.rows.filter((r) => selectedIds.has(r.id));
    }
    return report.rows;
  }, [report, previewSelectedOnly, hasSelection, selectedIds]);

  const printOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    effectiveRows.forEach((r, idx) => map.set(r.id, idx + 1));
    return map;
  }, [effectiveRows]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    if (!report) return;
    setSelectedIds(new Set(report.rows.map((r) => r.id)));
  }

  function selectByStatus(targetStatuses: string[]) {
    if (!report) return;
    setSelectedIds(
      new Set(
        report.rows
          .filter((r) => targetStatuses.includes(r.status))
          .map((r) => r.id)
      )
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setPreviewSelectedOnly(false);
  }

  function applyDatePreset(preset: "today" | "last7" | "thisMonth" | "next30") {
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "last7") {
      setStartDate(addDaysISO(today, -6));
      setEndDate(today);
    } else if (preset === "thisMonth") {
      const [y, m] = today.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      setStartDate(`${y}-${String(m).padStart(2, "0")}-01`);
      setEndDate(`${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    } else if (preset === "next30") {
      setStartDate(today);
      setEndDate(addDaysISO(today, 30));
    }
  }

  function resetAllFilters() {
    setStartDate(today);
    setEndDate(today);
    setShift("");
    setLocationId("");
    setInsuranceId("");
    setVisitTypeId("");
    setKneeOptionId("");
    setStatus("");
    setSearch("");
    setHideCanceled(true);
    clearSelection();
  }

  function handleExportCsv() {
    const p = buildFilterQuery();
    if (hasSelection) {
      p.set("ids", Array.from(selectedIds).join(","));
    }
    p.set("format", "csv");
    window.location.href = `/api/admin/reports?${p.toString()}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${landscape ? "print-landscape" : ""}`}>
      {/* ================= ÁREA INTERATIVA (OCULTA NA IMPRESSÃO) ================= */}
      <div className="print:hidden space-y-5">
        {/* Cabeçalho + Ações Principais */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Relatórios &amp; Estatísticas
            </h1>
            <p className="text-sm text-[#9c99c4]">
              Filtre dados coletados, acompanhe estatísticas em tempo real e selecione
              exatamente o que deseja imprimir em A4
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-10 px-4 rounded-xl border border-white/40 bg-[#1b183d] text-[#e3e1fa] hover:border-white flex items-center gap-2 text-sm font-semibold transition-colors"
            >
              <Download className="h-4 w-4 text-[#957bff]" />
              {hasSelection
                ? `Exportar CSV (${selectedIds.size} selec.)`
                : "Exportar CSV / Excel"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border border-white/75 hover:border-white text-white hover:brightness-110 flex items-center gap-2 text-sm font-bold shadow-lg shadow-violet-600/30 transition-all"
            >
              <Printer className="h-4 w-4" />
              {hasSelection
                ? `Imprimir Selecionados (${selectedIds.size})`
                : `Imprimir / PDF A4 (${report?.rows.length ?? 0})`}
            </button>
          </div>
        </div>

        {/* Painel de Filtros Avançados */}
        <section className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 sm:p-5 space-y-4 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2b275c]">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Filter className="h-4 w-4 text-[#957bff]" />
              Filtros dos Dados Coletados
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyDatePreset("today")}
                className="px-2.5 py-1 rounded-lg bg-[#13112d] border border-white/30 hover:border-white/80 text-xs font-semibold text-[#d5d3f5] hover:text-white transition-colors"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("last7")}
                className="px-2.5 py-1 rounded-lg bg-[#13112d] border border-white/30 hover:border-white/80 text-xs font-semibold text-[#d5d3f5] hover:text-white transition-colors"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("thisMonth")}
                className="px-2.5 py-1 rounded-lg bg-[#13112d] border border-white/30 hover:border-white/80 text-xs font-semibold text-[#d5d3f5] hover:text-white transition-colors"
              >
                Este mês
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("next30")}
                className="px-2.5 py-1 rounded-lg bg-[#13112d] border border-white/30 hover:border-white/80 text-xs font-semibold text-[#d5d3f5] hover:text-white transition-colors"
              >
                Próximos 30 dias
              </button>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-lg bg-[#252154] border border-white/35 hover:border-white text-xs font-semibold text-[#c7c4eb] hover:text-white inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Busca livre */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Buscar paciente, WhatsApp ou protocolo
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-[#7c78a8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ex: Maria, 91999..., AGD-1234"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#7673a3] text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6dff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Data final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Local de atendimento
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos os locais</option>
                <option value="NONE">Não especificado</option>
                {report?.locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Convênio / Particular
              </label>
              <select
                value={insuranceId}
                onChange={(e) => setInsuranceId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos os convênios</option>
                {report?.insurances?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Tipo de consulta
              </label>
              <select
                value={visitTypeId}
                onChange={(e) => setVisitTypeId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos os tipos</option>
                {report?.visitTypes?.map((vt) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Joelho avaliado
              </label>
              <select
                value={kneeOptionId}
                onChange={(e) => setKneeOptionId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos</option>
                {report?.kneeOptions?.map((ko) => (
                  <option key={ko.id} value={ko.id}>
                    {ko.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Turno
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos os turnos</option>
                <option value="MORNING">Manhã</option>
                <option value="AFTERNOON">Tarde</option>
                <option value="FULL_DAY">Dia Inteiro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
              >
                <option value="">Todos (conforme opção)</option>
                <option value="PENDING">Pendente</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="CHECKED_IN">Chegou</option>
                <option value="COMPLETED">Atendido</option>
                <option value="CANCELED">Cancelado</option>
                <option value="NO_SHOW">Faltou</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[#d5d3f5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideCanceled}
                  onChange={(e) => setHideCanceled(e.target.checked)}
                  className="h-4 w-4 rounded border-[#3d387a] accent-[#8b6dff]"
                />
                Ocultar cancelados
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#d5d3f5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStatsInPrint}
                  onChange={(e) => setIncludeStatsInPrint(e.target.checked)}
                  className="h-4 w-4 rounded border-[#3d387a] accent-[#8b6dff]"
                />
                Incluir estatísticas no relatório impresso
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#d5d3f5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={landscape}
                  onChange={(e) => setLandscape(e.target.checked)}
                  className="h-4 w-4 rounded border-[#3d387a] accent-[#8b6dff]"
                />
                A4 Paisagem
              </label>
            </div>
          </div>
        </section>

        {/* Painel de Estatísticas dos Dados Coletados */}
        {report && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#957bff]" />
                <h2 className="text-lg font-extrabold text-white">
                  Estatísticas dos Dados Coletados
                </h2>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${hasSelection
                  ? "bg-[#6344ff]/25 text-white border-white/60"
                  : "bg-[#1b183d] text-[#c7c4eb] border-[#343069]"
                  }`}
              >
                {hasSelection
                  ? `Calculado sobre ${selectedIds.size} de ${report.rows.length} selecionados`
                  : `Calculado sobre ${report.rows.length} registros filtrados`}
              </span>
            </div>

            {/* 4 Cards KPI de Estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-[#8c7aff] via-[#6e58ff] to-[#4a3aff] p-4 text-white shadow-lg shadow-indigo-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                  <Users className="h-4 w-4" />
                  Total no Relatório
                </div>
                <div className="text-3xl font-black mt-2">{activeStats.total}</div>
                <div className="text-xs text-white/80 mt-1">
                  {activeStats.byDate.length}{" "}
                  {activeStats.byDate.length === 1 ? "dia com movimento" : "dias com movimento"}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-[#7dd3fc] via-[#4ea8ff] to-[#2d7cf6] p-4 text-white shadow-lg shadow-indigo-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmados / Atendidos
                </div>
                <div className="text-3xl font-black mt-2">
                  {activeStats.confirmed}{" "}
                  <span className="text-base font-bold text-white/85">
                    ({activeStats.confirmationRate}%)
                  </span>
                </div>
                <div className="text-xs text-white/85 mt-1">
                  Comparecimento: {activeStats.checkedIn + activeStats.completed} (
                  {activeStats.attendanceRate}%)
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-[#ff8cc6] via-[#f857a6] to-[#e02d76] p-4 text-white shadow-lg shadow-indigo-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                  <Clock className="h-4 w-4" />
                  Pendentes
                </div>
                <div className="text-3xl font-black mt-2">
                  {activeStats.pending}{" "}
                  <span className="text-base font-bold text-white/85">
                    (
                    {activeStats.total > 0
                      ? Math.round((activeStats.pending / activeStats.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="text-xs text-white/85 mt-1">
                  Aguardando confirmação do paciente
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-[#ff9a76] via-[#ff6259] to-[#e63946] p-4 text-white shadow-lg shadow-indigo-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                  <XCircle className="h-4 w-4" />
                  Cancelados / Faltas
                </div>
                <div className="text-3xl font-black mt-2">
                  {activeStats.canceled + activeStats.noShow}{" "}
                  <span className="text-base font-bold text-white/85">
                    ({activeStats.cancellationRate}%)
                  </span>
                </div>
                <div className="text-xs text-white/85 mt-1">
                  {activeStats.canceled} cancelado(s) • {activeStats.noShow} falta(s)
                </div>
              </div>
            </div>

            {/* Distribuição por Categorias Coletadas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatDistributionCard
                title="Por Convênio / Particular"
                icon={Stethoscope}
                entries={activeStats.byInsurance}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#8f71ff] to-[#6344ff]"
              />
              <StatDistributionCard
                title="Por Local de Atendimento"
                icon={Building2}
                entries={activeStats.byLocation}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#7dd3fc] to-[#2d7cf6]"
              />
              <StatDistributionCard
                title="Por Tipo de Consulta"
                icon={Activity}
                entries={activeStats.byVisitType}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#34d399] to-[#059669]"
              />
              <StatDistributionCard
                title="Por Joelho Avaliado"
                icon={BarChart3}
                entries={activeStats.byKneeOption}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#f472b6] to-[#db2777]"
              />
              <StatDistributionCard
                title="Por Turno"
                icon={Calendar}
                entries={activeStats.byShift}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#fbbf24] to-[#d97706]"
              />
              <StatDistributionCard
                title="Por Status"
                icon={CheckCircle2}
                entries={activeStats.byStatus}
                total={activeStats.total}
                barClass="bg-gradient-to-r from-[#a78bfa] to-[#38bdf8]"
              />
            </div>
          </section>
        )}

        {/* Barra de Seleção para Impressão Seletiva */}
        {report && report.rows.length > 0 && (
          <div className="bg-[#1b183d] rounded-2xl border border-[#3a3578] p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <CheckSquare className="h-4 w-4 text-[#7dd3fc] shrink-0" />
              <span className="text-[#e3e1fa]">
                {hasSelection ? (
                  <>
                    <strong className="text-white">{selectedIds.size}</strong> de{" "}
                    {report.rows.length} agendamento(s) selecionado(s) —{" "}
                    <span className="text-[#7dd3fc] font-semibold">
                      somente os selecionados serão impressos
                    </span>
                  </>
                ) : (
                  <>
                    Marque as caixas na lista abaixo para imprimir apenas selecionados (sem
                    marcação, imprime todos os{" "}
                    <strong className="text-white">{report.rows.length}</strong> filtrados).
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 py-1.5 rounded-lg bg-[#13112d] border border-white/35 hover:border-white text-xs font-semibold text-white transition-colors"
              >
                Selecionar todos ({report.rows.length})
              </button>
              <button
                type="button"
                onClick={() => selectByStatus(["CONFIRMED", "CHECKED_IN", "COMPLETED"])}
                className="px-3 py-1.5 rounded-lg bg-[#13112d] border border-white/30 hover:border-white text-xs font-semibold text-emerald-300 transition-colors"
              >
                Só Confirmados
              </button>
              <button
                type="button"
                onClick={() => selectByStatus(["PENDING"])}
                className="px-3 py-1.5 rounded-lg bg-[#13112d] border border-white/30 hover:border-white text-xs font-semibold text-amber-300 transition-colors"
              >
                Só Pendentes
              </button>
              {hasSelection && (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewSelectedOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${previewSelectedOnly
                      ? "bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border-white/80 text-white"
                      : "bg-[#13112d] border-white/35 text-[#d5d3f5] hover:border-white"
                      }`}
                  >
                    {previewSelectedOnly ? "Mostrando só selecionados" : "Ver só selecionados"}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-white/35 hover:border-white text-xs font-semibold text-rose-200 transition-colors"
                  >
                    Limpar seleção
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= PRÉVIA DO RELATÓRIO (MIDNIGHT INDIGO NA TELA / A4 P&B NA IMPRESSÃO) ================= */}
      {loading && !report ? (
        <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-10 text-center text-[#9c99c4]">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#8b6dff]" />
          Gerando visualização de relatório e estatísticas...
        </div>
      ) : report ? (
        <div className="bg-[#1b183d] text-[#f1f0ff] rounded-2xl border border-[#2d295e] p-5 sm:p-7 shadow-xl shadow-black/30 print:bg-white print:text-slate-950 print:border-0 print:rounded-none print:shadow-none print:p-0">
          {/* Cabeçalho do Relatório */}
          <div className="border-b border-[#2e2a61] print:border-b-2 print:border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white print:text-slate-950 uppercase tracking-tight">
                {report.clinicName}
              </h2>
              <p className="text-sm font-semibold text-[#a792ff] print:text-slate-800 mt-0.5">
                Relatório de Atendimentos &amp; Estatísticas — Ordem de Chegada
              </p>
              {hasSelection && (
                <p className="inline-flex items-center mt-2 px-3 py-1 rounded-full bg-[#6344ff]/25 border border-white/40 text-xs font-bold text-white print:bg-transparent print:border-0 print:p-0 print:mt-1 print:text-slate-900">
                  Seleção Personalizada: {selectedIds.size} de {report.rows.length}{" "}
                  registro(s) selecionado(s)
                </p>
              )}
            </div>
            <div className="text-xs text-[#c7c4eb] print:text-slate-800 sm:text-right space-y-0.5 bg-[#141230] border border-[#2d295e] rounded-xl px-3.5 py-2.5 print:bg-transparent print:border-0 print:p-0">
              <div>
                <strong className="text-white print:text-slate-950">Período:</strong>{" "}
                {report.filters.startDateBR === report.filters.endDateBR
                  ? report.filters.startDateBR
                  : `${report.filters.startDateBR} a ${report.filters.endDateBR}`}
              </div>
              <div>
                <strong className="text-white print:text-slate-950">Turno:</strong>{" "}
                {report.filters.shiftLabel} |{" "}
                <strong className="text-white print:text-slate-950">Local:</strong>{" "}
                {report.filters.locationLabel}
              </div>
              <div>
                <strong className="text-white print:text-slate-950">Convênio:</strong>{" "}
                {report.filters.insuranceLabel} |{" "}
                <strong className="text-white print:text-slate-950">Tipo:</strong>{" "}
                {report.filters.visitTypeLabel}
              </div>
              <div>
                <strong className="text-white print:text-slate-950">Emitido em:</strong>{" "}
                {new Date(report.generatedAt).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>

          {/* Bloco de Estatísticas do Relatório (também incluso na impressão A4) */}
          <div className={includeStatsInPrint ? "" : "print:hidden"}>
            {/* Resumo Numérico */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3 text-xs">
              <div className="bg-[#141230] border border-[#343069] rounded-xl p-3 print:bg-white print:border-slate-900 print:rounded-lg print:p-2.5">
                <div className="text-[#9c99c4] print:text-slate-600 uppercase font-semibold">
                  Total Listado
                </div>
                <div className="text-xl font-black text-white print:text-slate-950 mt-0.5">
                  {activeStats.total}
                </div>
              </div>
              <div className="bg-[#141230] border border-[#343069] rounded-xl p-3 print:bg-white print:border-slate-900 print:rounded-lg print:p-2.5">
                <div className="text-[#7dd3fc] print:text-slate-600 uppercase font-semibold">
                  Confirmados
                </div>
                <div className="text-xl font-black text-white print:text-slate-950 mt-0.5">
                  {activeStats.confirmed}{" "}
                  <span className="text-xs font-bold text-[#7dd3fc] print:text-slate-700">
                    ({activeStats.confirmationRate}%)
                  </span>
                </div>
              </div>
              <div className="bg-[#141230] border border-[#343069] rounded-xl p-3 print:bg-white print:border-slate-900 print:rounded-lg print:p-2.5">
                <div className="text-amber-300 print:text-slate-600 uppercase font-semibold">
                  Pendentes
                </div>
                <div className="text-xl font-black text-white print:text-slate-950 mt-0.5">
                  {activeStats.pending}
                </div>
              </div>
              <div className="bg-[#141230] border border-[#343069] rounded-xl p-3 print:bg-white print:border-slate-900 print:rounded-lg print:p-2.5">
                <div className="text-rose-300 print:text-slate-600 uppercase font-semibold">
                  Cancelados / Faltas
                </div>
                <div className="text-xl font-black text-white print:text-slate-950 mt-0.5">
                  {activeStats.canceled + activeStats.noShow}{" "}
                  <span className="text-xs font-bold text-rose-300 print:text-slate-700">
                    ({activeStats.cancellationRate}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Resumo Estatístico Detalhado por Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 text-xs text-[#e3e1fa] print:text-slate-900">
              <div className="bg-[#141230] border border-[#2e2a61] rounded-xl px-3.5 py-2.5 print:bg-white print:border-slate-400 print:rounded-lg print:px-3 print:py-2">
                <strong className="text-[#a792ff] print:text-slate-950">Convênios: </strong>
                {Object.entries(activeStats.byInsurance).length > 0
                  ? Object.entries(activeStats.byInsurance)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const pct =
                        activeStats.total > 0
                          ? Math.round((v / activeStats.total) * 100)
                          : 0;
                      return `${k}: ${v} (${pct}%)`;
                    })
                    .join("  •  ")
                  : "Nenhum"}
              </div>
              <div className="bg-[#141230] border border-[#2e2a61] rounded-xl px-3.5 py-2.5 print:bg-white print:border-slate-400 print:rounded-lg print:px-3 print:py-2">
                <strong className="text-[#7dd3fc] print:text-slate-950">Locais: </strong>
                {Object.entries(activeStats.byLocation).length > 0
                  ? Object.entries(activeStats.byLocation)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const pct =
                        activeStats.total > 0
                          ? Math.round((v / activeStats.total) * 100)
                          : 0;
                      return `${k}: ${v} (${pct}%)`;
                    })
                    .join("  •  ")
                  : "Nenhum"}
              </div>
              <div className="bg-[#141230] border border-[#2e2a61] rounded-xl px-3.5 py-2.5 print:bg-white print:border-slate-400 print:rounded-lg print:px-3 print:py-2">
                <strong className="text-emerald-300 print:text-slate-950">
                  Tipo de Consulta:{" "}
                </strong>
                {Object.entries(activeStats.byVisitType).length > 0
                  ? Object.entries(activeStats.byVisitType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const pct =
                        activeStats.total > 0
                          ? Math.round((v / activeStats.total) * 100)
                          : 0;
                      return `${k}: ${v} (${pct}%)`;
                    })
                    .join("  •  ")
                  : "Nenhum"}
              </div>
              <div className="bg-[#141230] border border-[#2e2a61] rounded-xl px-3.5 py-2.5 print:bg-white print:border-slate-400 print:rounded-lg print:px-3 print:py-2">
                <strong className="text-pink-300 print:text-slate-950">
                  Joelho Avaliado:{" "}
                </strong>
                {Object.entries(activeStats.byKneeOption).length > 0
                  ? Object.entries(activeStats.byKneeOption)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const pct =
                        activeStats.total > 0
                          ? Math.round((v / activeStats.total) * 100)
                          : 0;
                      return `${k}: ${v} (${pct}%)`;
                    })
                    .join("  •  ")
                  : "Nenhum"}
              </div>
            </div>
          </div>

          {/* Tabela de Impressão + Seleção */}
          <div className="overflow-x-auto rounded-xl border border-[#2d295e] bg-[#141230]/70 print:rounded-none print:border-0 print:bg-transparent">
            <table className="w-full text-xs text-left border-collapse print:border print:border-slate-900">
              <thead>
                <tr className="bg-[#151233] border-b border-[#2b275c] text-[11px] uppercase tracking-wider text-[#9c99c4] print:bg-slate-100 print:text-slate-950 print:border-slate-900">
                  <th className="px-3 py-3 text-center w-10 print:hidden">
                    <button
                      type="button"
                      onClick={() =>
                        selectedIds.size === report.rows.length
                          ? clearSelection()
                          : selectAllFiltered()
                      }
                      title="Selecionar/desmarcar todos"
                      className="inline-flex items-center justify-center text-[#c7c4eb] hover:text-white"
                    >
                      {report.rows.length > 0 &&
                        selectedIds.size === report.rows.length ? (
                        <CheckSquare className="h-4 w-4 text-[#957bff]" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center w-8 print:border print:border-slate-900 print:px-2 print:py-2">
                    #
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Protocolo
                  </th>
                  {report.filters.startDate !== report.filters.endDate && (
                    <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                      Data
                    </th>
                  )}
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Nome do Paciente
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    WhatsApp
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Local
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Convênio
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Tipo
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Joelho
                  </th>
                  <th className="px-3 py-3 font-semibold print:border print:border-slate-900 print:px-2 print:py-2">
                    Status
                  </th>
                  <th className="px-3 py-3 font-semibold w-32 print:border print:border-slate-900 print:px-2 print:py-2">
                    Chegada / Obs.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282454] print:divide-slate-900">
                {displayedScreenRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={report.filters.startDate !== report.filters.endDate ? 12 : 11}
                      className="px-4 py-8 text-center text-[#8d8ab8] print:border print:border-slate-900 print:text-slate-600"
                    >
                      Nenhum agendamento para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayedScreenRows.map((row) => {
                    const isChecked = selectedIds.has(row.id);
                    const hiddenInPrint = hasSelection && !isChecked;
                    const displayOrder = printOrderMap.get(row.id) ?? row.order;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggleRow(row.id)}
                        className={`break-inside-avoid cursor-pointer transition-colors ${
                          hiddenInPrint
                            ? "print:hidden opacity-45 hover:opacity-80 bg-[#141230]/40"
                            : isChecked
                            ? "bg-[#2a2363]/85 hover:bg-[#322a75] print:bg-transparent"
                            : "hover:bg-[#231f4d]/70 print:bg-transparent"
                          }`}
                      >
                        <td
                          className="px-3 py-3 text-center print:hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Selecionar ${row.patientName}`}
                            className="h-4 w-4 accent-[#8b6dff] cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-[#c7c4eb] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          <span className="print:hidden">{row.order}</span>
                          <span className="hidden print:inline">{displayOrder}</span>
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-[#a792ff] whitespace-nowrap print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.protocol}
                        </td>
                        {report.filters.startDate !== report.filters.endDate && (
                          <td className="px-3 py-3 whitespace-nowrap text-[#d5d3f5] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                            {row.dateBR}
                          </td>
                        )}
                        <td className="px-3 py-3 font-semibold text-white print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.patientName}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-[#c7c4eb] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.whatsappDisplay}
                        </td>
                        <td className="px-3 py-3 text-[#7dd3fc] font-medium print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.location || "—"}
                        </td>
                        <td className="px-3 py-3 font-semibold text-white print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.insurance}
                        </td>
                        <td className="px-3 py-3 text-[#e3e1fa] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.visitType}
                        </td>
                        <td className="px-3 py-3 text-[#c7c4eb] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.kneeOption}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap print:border print:border-slate-900 print:px-2 print:py-2.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border print:border-0 print:bg-transparent print:text-slate-950 print:p-0 ${
                              STATUS_BADGE[row.status] ||
                              "bg-slate-500/20 text-slate-200 border-slate-500/30"
                            }`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#c7c4eb] print:border print:border-slate-900 print:px-2 print:py-2.5 print:text-slate-950">
                          {row.checkedInAt
                            ? new Date(row.checkedInAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : ""}
                          {row.notes ? ` ${row.notes}` : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#8b6dff]" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
