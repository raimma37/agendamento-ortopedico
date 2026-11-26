"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Search, Users } from "lucide-react";

interface PatientItem {
  key: string;
  patientName: string;
  whatsapp: string;
  whatsappDisplay: string;
  totalAppointments: number;
  completedCount: number;
  canceledCount: number;
  lastDateBR: string;
  history: Array<{
    id: string;
    protocol: string;
    dateBR: string;
    shiftLabel: string;
    location: string | null;
    insurance: string;
    visitType: string;
    kneeOption: string;
    status: string;
    statusLabel: string;
  }>;
}

export default function AdminPatientsPage() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`/api/admin/patients${qs}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setPatients(json.patients || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPatients(), 250);
    return () => clearTimeout(timer);
  }, [loadPatients]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Base de Pacientes
          </h1>
          <p className="text-sm text-[#9c99c4]">
            Histórico completo agrupado por paciente (nome normalizado)
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-[#7c78a8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou WhatsApp..."
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#322e66] bg-[#1b183d] text-white placeholder-[#7673a3] text-sm focus:outline-none focus:ring-2 focus:ring-[#8b6dff]"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-10 text-center text-[#9c99c4]">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#8b6dff]" />
          Carregando pacientes...
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-10 text-center text-[#8d8ab8]">
          <Users className="h-8 w-8 mx-auto mb-2 text-[#5c588a]" />
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => {
            const expanded = expandedKey === p.key;
            return (
              <div
                key={p.key}
                className="bg-[#1b183d] rounded-2xl border border-[#2d295e] overflow-hidden shadow-lg shadow-black/20"
              >
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : p.key)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#231f4d]/70 transition-colors"
                >
                  <div>
                    <div className="font-bold text-white">{p.patientName}</div>
                    <div className="text-xs text-[#9c99c4] mt-0.5">
                      WhatsApp: {p.whatsappDisplay} • Último agendamento: {p.lastDateBR}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-bold text-[#c7c4eb]">
                        {p.totalAppointments}{" "}
                        {p.totalAppointments === 1 ? "agendamento" : "agendamentos"}
                      </div>
                      <div className="text-[11px] text-[#8d8ab8]">
                        {p.completedCount} atendido(s) • {p.canceledCount} cancelado(s)
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-5 w-5 text-[#957bff]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[#8d8ab8]" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-[#2b275c] bg-[#141230] px-5 py-3 overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#8d8ab8] uppercase">
                        <tr>
                          <th className="py-2 pr-3">Protocolo</th>
                          <th className="py-2 pr-3">Data</th>
                          <th className="py-2 pr-3">Turno</th>
                          <th className="py-2 pr-3">Local</th>
                          <th className="py-2 pr-3">Convênio</th>
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Joelho</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252250] text-[#e3e1fa]">
                        {p.history.map((h) => (
                          <tr key={h.id}>
                            <td className="py-2 pr-3 font-mono font-bold text-[#a792ff]">
                              {h.protocol}
                            </td>
                            <td className="py-2 pr-3">{h.dateBR}</td>
                            <td className="py-2 pr-3">{h.shiftLabel}</td>
                            <td className="py-2 pr-3 text-[#7dd3fc]">{h.location || "—"}</td>
                            <td className="py-2 pr-3">{h.insurance}</td>
                            <td className="py-2 pr-3">{h.visitType}</td>
                            <td className="py-2 pr-3">{h.kneeOption}</td>
                            <td className="py-2 font-semibold">{h.statusLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
