"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { getTodayISO } from "@/lib/normalize";

interface DashboardResponse {
  date: string;
  dateBR: string;
  stats: {
    totalSlots: number;
    activeBooked: number;
    remainingSlots: number;
    confirmed: number;
    pending: number;
    canceled: number;
    checkedIn: number;
    completed: number;
  };
  quotas: Array<{
    shift: string;
    shiftLabel: string;
    maxSlots: number;
    privateReserveSlots: number;
    booked: number;
    source: string;
    location: { id: string; name: string; address: string | null } | null;
    allowedInsurances: Array<{ id: string; name: string }>;
  }>;
  appointments: Array<{
    id: string;
    protocol: string;
    patientName: string;
    whatsapp: string;
    whatsappDisplay: string;
    date: string;
    dateBR: string;
    shift: string;
    shiftLabel: string;
    location: { id: string; name: string; address: string | null } | null;
    insurance: { id: string; name: string; isPrivatePriority: boolean };
    visitType: { id: string; name: string };
    kneeOption: { id: string; name: string };
    status: string;
    statusLabel: string;
    confirmedVia: string | null;
    checkedInAt: string | null;
    notes: string | null;
  }>;
  filters: {
    insurances: Array<{ id: string; name: string }>;
    visitTypes: Array<{ id: string; name: string }>;
    kneeOptions: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
  };
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  CONFIRMED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  CHECKED_IN: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  COMPLETED: "bg-violet-400/20 text-violet-200 border-violet-400/40",
  CANCELED: "bg-rose-500/15 text-rose-300 border-rose-500/35",
  NO_SHOW: "bg-slate-400/15 text-slate-300 border-slate-400/30",
};

function RadialRing({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  return (
    <div className="relative h-14 w-14 flex items-center justify-center shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="4.5"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold text-white">
        {safe}%
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [date, setDate] = useState(getTodayISO());
  const [shift, setShift] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [visitTypeId, setVisitTypeId] = useState("");
  const [kneeOptionId, setKneeOptionId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (shift) params.set("shift", shift);
      if (insuranceId) params.set("insuranceId", insuranceId);
      if (visitTypeId) params.set("visitTypeId", visitTypeId);
      if (kneeOptionId) params.set("kneeOptionId", kneeOptionId);
      if (locationId) params.set("locationId", locationId);
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [date, shift, insuranceId, visitTypeId, kneeOptionId, locationId, status, search]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function updateStatus(id: string, nextStatus: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await loadDashboard();
      }
    } finally {
      setBusyId(null);
    }
  }

  const totalBase = data?.stats.totalSlots || 1;
  const activeBase = data?.stats.activeBooked || 1;
  const totalAll = (data?.stats.activeBooked || 0) + (data?.stats.canceled || 0) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[#9c99c4] mt-0.5">
            Controle de vagas por turno e fila por ordem de chegada •{" "}
            <span className="text-white font-semibold">{data?.dateBR || date}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#1c1940] border border-[#312d66] rounded-xl px-3.5 py-2">
            <Calendar className="h-4 w-4 text-[#957bff]" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm font-semibold text-white focus:outline-none bg-transparent"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="h-10 px-3.5 rounded-xl border border-[#312d66] bg-[#1c1940] text-[#d5d3f5] hover:border-[#8b6dff] flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>

          <Link
            href={`/admin/relatorios?startDate=${date}&endDate=${date}`}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white hover:brightness-110 flex items-center gap-2 text-sm font-bold shadow-lg shadow-violet-600/30 transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimir Lista do Dia
          </Link>
        </div>
      </div>

      {/* 4 Signature Vibrant Gradient KPI Cards (Inspired by Reference) */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Violet/Indigo — Agendados / Total de Vagas */}
          <div className="rounded-2xl bg-gradient-to-br from-[#8c7aff] via-[#6e58ff] to-[#4a3aff] p-5 text-white shadow-xl shadow-indigo-950/50 flex flex-col justify-between min-h-[132px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/95">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span>Agendados no Dia</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-4">
              <div>
                <div className="text-3xl font-black leading-none">
                  {String(data.stats.activeBooked).padStart(2, "0")}
                </div>
                <div className="text-xs text-white/80 mt-1.5 font-medium">
                  de {data.stats.totalSlots} vagas ({data.stats.remainingSlots} livres)
                </div>
              </div>
              <RadialRing percent={(data.stats.activeBooked / totalBase) * 100} />
            </div>
          </div>

          {/* Card 2: Sky/Cyan Blue — Confirmados */}
          <div className="rounded-2xl bg-gradient-to-br from-[#7dd3fc] via-[#4ea8ff] to-[#2d7cf6] p-5 text-white shadow-xl shadow-indigo-950/50 flex flex-col justify-between min-h-[132px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/95">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span>Confirmados</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-4">
              <div>
                <div className="text-3xl font-black leading-none">
                  {String(data.stats.confirmed).padStart(2, "0")}
                </div>
                <div className="text-xs text-white/85 mt-1.5 font-medium">
                  WhatsApp / Recepção
                </div>
              </div>
              <RadialRing
                percent={
                  data.stats.activeBooked > 0
                    ? (data.stats.confirmed / activeBase) * 100
                    : 0
                }
              />
            </div>
          </div>

          {/* Card 3: Pink/Magenta — Pendentes */}
          <div className="rounded-2xl bg-gradient-to-br from-[#ff8cc6] via-[#f857a6] to-[#e02d76] p-5 text-white shadow-xl shadow-indigo-950/50 flex flex-col justify-between min-h-[132px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/95">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <span>Pendentes</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-4">
              <div>
                <div className="text-3xl font-black leading-none">
                  {String(data.stats.pending).padStart(2, "0")}
                </div>
                <div className="text-xs text-white/85 mt-1.5 font-medium">
                  Aguardando confirmação
                </div>
              </div>
              <RadialRing
                percent={
                  data.stats.activeBooked > 0
                    ? (data.stats.pending / activeBase) * 100
                    : 0
                }
              />
            </div>
          </div>

          {/* Card 4: Coral/Red — Cancelados */}
          <div className="rounded-2xl bg-gradient-to-br from-[#ff9a76] via-[#ff6259] to-[#e63946] p-5 text-white shadow-xl shadow-indigo-950/50 flex flex-col justify-between min-h-[132px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/95">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <XCircle className="h-3.5 w-3.5" />
              </div>
              <span>Cancelados</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-4">
              <div>
                <div className="text-3xl font-black leading-none">
                  {String(data.stats.canceled).padStart(2, "0")}
                </div>
                <div className="text-xs text-white/85 mt-1.5 font-medium">
                  Vagas devolvidas à agenda
                </div>
              </div>
              <RadialRing percent={(data.stats.canceled / totalAll) * 100} />
            </div>
          </div>
        </div>
      )}

      {/* Cotas por Turno do Dia */}
      {data && data.quotas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.quotas.map((q) => {
            const pct = q.maxSlots > 0 ? Math.min(100, (q.booked / q.maxSlots) * 100) : 0;
            return (
              <div
                key={q.shift}
                className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 shadow-lg shadow-black/20"
              >
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#957bff]" />
                    {q.shiftLabel}
                  </span>
                  <span className="text-xs font-bold text-[#c7c4eb]">
                    {q.booked} / {q.maxSlots} vagas
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#12102b] overflow-hidden border border-[#2a2659]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 100
                        ? "bg-gradient-to-r from-[#ff6259] to-[#e63946]"
                        : "bg-gradient-to-r from-[#8f71ff] to-[#3b9eff]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-[#8d8ab8]">
                  <span>
                    {q.source === "EXCEPTION" ? "Regra individual" : "Grade semanal"}
                  </span>
                  {q.privateReserveSlots > 0 && (
                    <span className="text-[#a792ff] font-semibold">
                      Reserva Part.: {q.privateReserveSlots}
                    </span>
                  )}
                </div>
                {(q.location || q.allowedInsurances.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-[#2b275c] space-y-1 text-[11px]">
                    {q.location && (
                      <div className="text-[#7dd3fc] font-semibold flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {q.location.name}
                      </div>
                    )}
                    {q.allowedInsurances.length > 0 && (
                      <div className="text-[#c7c4eb]">
                        Convênios:{" "}
                        <span className="text-white font-semibold">
                          {q.allowedInsurances.map((i) => i.name).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros da Lista de Atendimento */}
      <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-4 space-y-3 shadow-lg shadow-black/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-[#7c78a8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, WhatsApp ou protocolo..."
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#7673a3] text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6dff]"
            />
          </div>

          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
          >
            <option value="">Todos os turnos</option>
            <option value="MORNING">Manhã</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="FULL_DAY">Dia Inteiro</option>
          </select>

          <select
            value={insuranceId}
            onChange={(e) => setInsuranceId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
          >
            <option value="">Todos convênios</option>
            {data?.filters.insurances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>

          <select
            value={visitTypeId}
            onChange={(e) => setVisitTypeId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
          >
            <option value="">Tipo de consulta</option>
            {data?.filters.visitTypes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#322e66] bg-[#13112d] text-white text-sm"
          >
            <option value="">Todos status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="CHECKED_IN">Chegou</option>
            <option value="COMPLETED">Atendido</option>
            <option value="CANCELED">Cancelado</option>
            <option value="NO_SHOW">Faltou</option>
          </select>
        </div>

        {/* Filtro rápido de Joelho e Local */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#8d8ab8] font-semibold">Joelho:</span>
            <button
              type="button"
              onClick={() => setKneeOptionId("")}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                kneeOptionId === ""
                  ? "bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white border-transparent shadow-sm"
                  : "bg-[#13112d] text-[#a8a5ce] border-[#312d66] hover:border-[#8b6dff]"
              }`}
            >
              Todos
            </button>
            {data?.filters.kneeOptions.map((ko) => (
              <button
                key={ko.id}
                type="button"
                onClick={() => setKneeOptionId(ko.id)}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                  kneeOptionId === ko.id
                    ? "bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white border-transparent shadow-sm"
                    : "bg-[#13112d] text-[#a8a5ce] border-[#312d66] hover:border-[#8b6dff]"
                }`}
              >
                {ko.name}
              </button>
            ))}
          </div>

          {data && data.filters.locations.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#8d8ab8] font-semibold">Local:</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[#322e66] bg-[#13112d] text-white text-xs"
              >
                <option value="">Todos os locais</option>
                {data.filters.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Atendimento */}
      <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] overflow-hidden shadow-xl shadow-black/25">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#151233] border-b border-[#2b275c] text-[11px] uppercase tracking-wider text-[#8d8ab8]">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Protocolo</th>
                <th className="px-4 py-3.5 font-semibold">Paciente</th>
                <th className="px-4 py-3.5 font-semibold">Turno / Local</th>
                <th className="px-4 py-3.5 font-semibold">Convênio</th>
                <th className="px-4 py-3.5 font-semibold">Consulta / Joelho</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282454]">
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#9c99c4]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#8b6dff]" />
                    Carregando lista do dia...
                  </td>
                </tr>
              ) : data && data.appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#8d8ab8]">
                    Nenhum agendamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                data?.appointments.map((apt) => (
                  <tr
                    key={apt.id}
                    className="hover:bg-[#231f4d]/70 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-[#a792ff] whitespace-nowrap">
                      {apt.protocol}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{apt.patientName}</div>
                      <div className="text-xs text-[#8d8ab8]">{apt.whatsappDisplay}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-medium text-[#d8d6f5]">{apt.shiftLabel}</span>
                      {apt.location && (
                        <div className="text-[11px] text-[#7dd3fc] flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {apt.location.name}
                        </div>
                      )}
                      {apt.checkedInAt && (
                        <div className="text-[11px] text-sky-300 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Chegou{" "}
                          {new Date(apt.checkedInAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold text-white">
                        {apt.insurance.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-[#e3e1fa] font-medium">
                        {apt.visitType.name}
                      </div>
                      <div className="text-xs text-[#8d8ab8]">{apt.kneeOption.name}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          STATUS_BADGE[apt.status] ||
                          "bg-slate-500/20 text-slate-200 border-slate-500/30"
                        }`}
                      >
                        {apt.statusLabel}
                      </span>
                      {apt.confirmedVia === "WHATSAPP_API" && (
                        <div className="text-[10px] text-emerald-300 mt-0.5">
                          via WhatsApp
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {apt.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={busyId === apt.id}
                            onClick={() => updateStatus(apt.id, "CONFIRMED")}
                            title="Confirmar consulta"
                            className="p-2 rounded-lg text-emerald-300 hover:bg-emerald-500/20 border border-transparent hover:border-emerald-400/40"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {(apt.status === "PENDING" || apt.status === "CONFIRMED") && (
                          <button
                            type="button"
                            disabled={busyId === apt.id}
                            onClick={() => updateStatus(apt.id, "CHECKED_IN")}
                            title="Registrar Chegada (Check-in)"
                            className="p-2 rounded-lg text-sky-300 hover:bg-sky-500/20 border border-transparent hover:border-sky-400/40"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        {(apt.status === "CONFIRMED" ||
                          apt.status === "CHECKED_IN") && (
                          <button
                            type="button"
                            disabled={busyId === apt.id}
                            onClick={() => updateStatus(apt.id, "COMPLETED")}
                            title="Marcar como Atendido"
                            className="p-2 rounded-lg text-violet-300 hover:bg-violet-500/20 border border-transparent hover:border-violet-400/40"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {apt.status !== "CANCELED" && apt.status !== "COMPLETED" && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === apt.id}
                              onClick={() => updateStatus(apt.id, "NO_SHOW")}
                              title="Marcar Falta"
                              className="p-2 rounded-lg text-slate-300 hover:bg-slate-500/20 border border-transparent hover:border-slate-400/40"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === apt.id}
                              onClick={() => updateStatus(apt.id, "CANCELED")}
                              title="Cancelar e devolver vaga"
                              className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/20 border border-transparent hover:border-rose-400/40"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
