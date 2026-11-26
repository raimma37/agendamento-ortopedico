"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2, Printer } from "lucide-react";
import { getTodayISO } from "@/lib/normalize";

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
    hideCanceled: boolean;
  };
  summary: {
    total: number;
    confirmed: number;
    pending: number;
    canceled: number;
    byInsurance: Record<string, number>;
    byVisitType: Record<string, number>;
  };
  insurances: Array<{ id: string; name: string }>;
  rows: Array<{
    order: number;
    id: string;
    protocol: string;
    patientName: string;
    whatsappDisplay: string;
    dateBR: string;
    shiftLabel: string;
    insurance: string;
    visitType: string;
    kneeOption: string;
    status: string;
    statusLabel: string;
    checkedInAt: string | null;
    notes: string;
  }>;
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const today = getTodayISO();

  const [startDate, setStartDate] = useState(searchParams.get("startDate") || today);
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") || searchParams.get("startDate") || today
  );
  const [shift, setShift] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [status, setStatus] = useState("");
  const [hideCanceled, setHideCanceled] = useState(true);
  const [landscape, setLandscape] = useState(false);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams({
      startDate,
      endDate,
      hideCanceled: String(hideCanceled),
    });
    if (shift) p.set("shift", shift);
    if (insuranceId) p.set("insuranceId", insuranceId);
    if (status) p.set("status", status);
    return p.toString();
  }, [startDate, endDate, shift, insuranceId, status, hideCanceled]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?${buildQuery()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  function handleExportCsv() {
    window.location.href = `/api/admin/reports?${buildQuery()}&format=csv`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className={`space-y-5 max-w-7xl mx-auto ${landscape ? "print-landscape" : ""}`}>
      {/* Barra de Filtros e Botões (Oculta na Impressão) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Relatórios & Impressão Diária
            </h1>
            <p className="text-sm text-slate-500">
              Layout A4 de alto contraste pronto para prancheta da recepção e médico
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Exportar CSV / Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-4 rounded-xl bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-2 text-sm font-semibold shadow-xs"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar PDF (A4)
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Data final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Turno
            </label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="">Todos</option>
              <option value="MORNING">Manhã</option>
              <option value="AFTERNOON">Tarde</option>
              <option value="FULL_DAY">Dia Inteiro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Convênio / Particular
            </label>
            <select
              value={insuranceId}
              onChange={(e) => setInsuranceId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="">Todos</option>
              {report?.insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm bg-white"
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

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hideCanceled}
                onChange={(e) => setHideCanceled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              Ocultar cancelados
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={landscape}
                onChange={(e) => setLandscape(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              A4 Paisagem
            </label>
          </div>
        </div>
      </div>

      {/* Folha de Impressão A4 */}
      {loading && !report ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
          Gerando visualização de impressão...
        </div>
      ) : report ? (
        <div className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-xs print:border-0 print:rounded-none print:shadow-none print:p-0">
          {/* Cabeçalho do Relatório */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                {report.clinicName}
              </h2>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">
                Lista de Atendimento Diário — Ordem de Chegada
              </p>
            </div>
            <div className="text-xs text-slate-800 sm:text-right space-y-0.5">
              <div>
                <strong>Período:</strong>{" "}
                {report.filters.startDateBR === report.filters.endDateBR
                  ? report.filters.startDateBR
                  : `${report.filters.startDateBR} a ${report.filters.endDateBR}`}
              </div>
              <div>
                <strong>Turno:</strong> {report.filters.shiftLabel}
              </div>
              <div>
                <strong>Emitido em:</strong>{" "}
                {new Date(report.generatedAt).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>

          {/* Resumo Numérico */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
            <div className="border border-slate-900 rounded-lg p-2.5">
              <div className="text-slate-600 uppercase font-semibold">Total Listado</div>
              <div className="text-lg font-black text-slate-950">{report.summary.total}</div>
            </div>
            <div className="border border-slate-900 rounded-lg p-2.5">
              <div className="text-slate-600 uppercase font-semibold">Confirmados</div>
              <div className="text-lg font-black text-slate-950">{report.summary.confirmed}</div>
            </div>
            <div className="border border-slate-900 rounded-lg p-2.5">
              <div className="text-slate-600 uppercase font-semibold">Pendentes</div>
              <div className="text-lg font-black text-slate-950">{report.summary.pending}</div>
            </div>
            <div className="border border-slate-900 rounded-lg p-2.5">
              <div className="text-slate-600 uppercase font-semibold">Tipo de Consulta</div>
              <div className="font-bold text-slate-950 mt-0.5">
                {Object.entries(report.summary.byVisitType)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" | ") || "—"}
              </div>
            </div>
          </div>

          {/* Resumo por Convênio / Particular */}
          <div className="border border-slate-400 rounded-lg px-3 py-2 mb-4 text-xs text-slate-900">
            <strong>Resumo por Convênio: </strong>
            {Object.entries(report.summary.byInsurance).length > 0
              ? Object.entries(report.summary.byInsurance)
                  .map(([k, v]) => `${k} (${v})`)
                  .join("  •  ")
              : "Nenhum registro"}
          </div>

          {/* Tabela de Impressão (Prancheta da Recepção/Médico) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-900">
              <thead>
                <tr className="bg-slate-100 text-slate-950">
                  <th className="border border-slate-900 px-2 py-2 text-center w-8">#</th>
                  <th className="border border-slate-900 px-2 py-2 text-left">Protocolo</th>
                  {report.filters.startDate !== report.filters.endDate && (
                    <th className="border border-slate-900 px-2 py-2 text-left">Data</th>
                  )}
                  <th className="border border-slate-900 px-2 py-2 text-left">
                    Nome do Paciente
                  </th>
                  <th className="border border-slate-900 px-2 py-2 text-left">WhatsApp</th>
                  <th className="border border-slate-900 px-2 py-2 text-left">Convênio</th>
                  <th className="border border-slate-900 px-2 py-2 text-left">Tipo</th>
                  <th className="border border-slate-900 px-2 py-2 text-left">Joelho</th>
                  <th className="border border-slate-900 px-2 py-2 text-left">Status</th>
                  <th className="border border-slate-900 px-2 py-2 text-left w-36">
                    Chegada / Obs.
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={report.filters.startDate !== report.filters.endDate ? 10 : 9}
                      className="border border-slate-900 px-3 py-6 text-center text-slate-600"
                    >
                      Nenhum agendamento para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.id} className="break-inside-avoid">
                      <td className="border border-slate-900 px-2 py-2.5 text-center font-bold">
                        {row.order}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5 font-mono font-bold whitespace-nowrap">
                        {row.protocol}
                      </td>
                      {report.filters.startDate !== report.filters.endDate && (
                        <td className="border border-slate-900 px-2 py-2.5 whitespace-nowrap">
                          {row.dateBR}
                        </td>
                      )}
                      <td className="border border-slate-900 px-2 py-2.5 font-semibold">
                        {row.patientName}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5 whitespace-nowrap">
                        {row.whatsappDisplay}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5">
                        {row.insurance}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5">
                        {row.visitType}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5">
                        {row.kneeOption}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5 whitespace-nowrap">
                        {row.statusLabel}
                      </td>
                      <td className="border border-slate-900 px-2 py-2.5">
                        {row.checkedInAt
                          ? new Date(row.checkedInAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                        {row.notes ? ` ${row.notes}` : ""}
                      </td>
                    </tr>
                  ))
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
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
