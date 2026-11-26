"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
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
  };
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CHECKED_IN: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-teal-50 text-teal-800 border-teal-200",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  NO_SHOW: "bg-slate-100 text-slate-700 border-slate-300",
};

export default function AdminDashboardPage() {
  const [date, setDate] = useState(getTodayISO());
  const [shift, setShift] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [visitTypeId, setVisitTypeId] = useState("");
  const [kneeOptionId, setKneeOptionId] = useState("");
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
  }, [date, shift, insuranceId, visitTypeId, kneeOptionId, status, search]);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard do Dia</h1>
          <p className="text-sm text-slate-500">
            Controle de vagas por turno e fila por ordem de chegada
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm font-semibold text-slate-800 focus:outline-none bg-transparent"
            />
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-sm font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>

          <Link
            href={`/admin/relatorios?startDate=${date}&endDate=${date}`}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 text-sm font-semibold shadow-xs"
          >
            <Printer className="h-4 w-4" />
            Imprimir Lista do Dia
          </Link>
        </div>
      </div>

      {/* Cards de Métricas */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase">
              Total de Vagas
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {data.stats.totalSlots}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Restam {data.stats.remainingSlots}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-teal-600 uppercase">
              Agendados
            </div>
            <div className="text-2xl font-black text-teal-700 mt-1">
              {data.stats.activeBooked}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Ativos no dia
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-emerald-600 uppercase">
              Confirmados
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {data.stats.confirmed}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              WhatsApp / Recepção
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-amber-600 uppercase">
              Pendentes
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {data.stats.pending}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Aguardando confirmação
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
            <div className="text-xs font-semibold text-red-600 uppercase">
              Cancelados
            </div>
            <div className="text-2xl font-black text-red-700 mt-1">
              {data.stats.canceled}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Vagas devolvidas
            </div>
          </div>
        </div>
      )}

      {/* Cotas por Turno do Dia */}
      {data && data.quotas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.quotas.map((q) => {
            const pct = q.maxSlots > 0 ? Math.min(100, (q.booked / q.maxSlots) * 100) : 0;
            return (
              <div
                key={q.shift}
                className="bg-white rounded-xl border border-slate-200 p-3.5"
              >
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-bold text-slate-800">{q.shiftLabel}</span>
                  <span className="text-xs font-semibold text-slate-600">
                    {q.booked} / {q.maxSlots} vagas
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct >= 100 ? "bg-red-500" : "bg-teal-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                  <span>
                    {q.source === "EXCEPTION" ? "Regra individual" : "Grade semanal"}
                  </span>
                  {q.privateReserveSlots > 0 && (
                    <span className="text-indigo-600 font-medium">
                      Reserva Particular: {q.privateReserveSlots}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros da Lista de Atendimento */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, WhatsApp ou protocolo..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">Todos os turnos</option>
            <option value="MORNING">Manhã</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="FULL_DAY">Dia Inteiro</option>
          </select>

          <select
            value={insuranceId}
            onChange={(e) => setInsuranceId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
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
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
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
            className="h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
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

        {/* Filtro extra de Joelho */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Joelho:</span>
          <button
            type="button"
            onClick={() => setKneeOptionId("")}
            className={`px-2.5 py-1 rounded-lg border ${
              kneeOptionId === ""
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            Todos
          </button>
          {data?.filters.kneeOptions.map((ko) => (
            <button
              key={ko.id}
              type="button"
              onClick={() => setKneeOptionId(ko.id)}
              className={`px-2.5 py-1 rounded-lg border ${
                kneeOptionId === ko.id
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {ko.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Atendimento */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Protocolo</th>
                <th className="px-4 py-3 font-semibold">Paciente</th>
                <th className="px-4 py-3 font-semibold">Turno</th>
                <th className="px-4 py-3 font-semibold">Convênio</th>
                <th className="px-4 py-3 font-semibold">Consulta / Joelho</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
                    Carregando lista do dia...
                  </td>
                </tr>
              ) : data && data.appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Nenhum agendamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                data?.appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {apt.protocol}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {apt.patientName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {apt.whatsappDisplay}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-700">
                        {apt.shiftLabel}
                      </span>
                      {apt.checkedInAt && (
                        <div className="text-[11px] text-blue-700 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Chegou{" "}
                          {new Date(apt.checkedInAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800">
                        {apt.insurance.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800 font-medium">
                        {apt.visitType.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {apt.kneeOption.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          STATUS_BADGE[apt.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {apt.statusLabel}
                      </span>
                      {apt.confirmedVia === "WHATSAPP_API" && (
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          via WhatsApp
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {apt.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={busyId === apt.id}
                            onClick={() => updateStatus(apt.id, "CONFIRMED")}
                            title="Confirmar consulta"
                            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
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
                            className="p-2 rounded-lg text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200"
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
                            className="p-2 rounded-lg text-teal-700 hover:bg-teal-50 border border-transparent hover:border-teal-200"
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
                              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-300"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === apt.id}
                              onClick={() => updateStatus(apt.id, "CANCELED")}
                              title="Cancelar e devolver vaga"
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
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
