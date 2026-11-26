"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  active: boolean;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

interface WebhookLogItem {
  id: string;
  event: string;
  statusCode: number | null;
  responseBody: string | null;
  success: boolean;
  createdAt: string;
  webhook: { name: string; url: string };
}

const ALL_EVENTS = [
  { id: "appointment.created", label: "appointment.created" },
  { id: "appointment.confirmed", label: "appointment.confirmed" },
  { id: "appointment.canceled", label: "appointment.canceled" },
];

export default function AdminIntegrationsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Nova API Key
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Novo Webhook
  const [whName, setWhName] = useState("Webhook n8n");
  const [whUrl, setWhUrl] = useState("");
  const [whSecret, setWhSecret] = useState("meu-segredo-hmac-n8n");
  const [whEvents, setWhEvents] = useState<string[]>([
    "appointment.created",
    "appointment.confirmed",
    "appointment.canceled",
  ]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, wRes] = await Promise.all([
        fetch("/api/admin/api-keys", { cache: "no-store" }),
        fetch("/api/admin/webhooks", { cache: "no-store" }),
      ]);
      if (kRes.ok) {
        const kj = await kRes.json();
        setKeys(kj.keys || []);
      }
      if (wRes.ok) {
        const wj = await wRes.json();
        setWebhooks(wj.webhooks || []);
        setLogs(wj.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setCreatedRawKey(json.rawKey);
      setNewKeyName("");
      await loadData();
    }
  }

  async function handleRevokeKey(id: string) {
    await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!whUrl.trim() || whEvents.length === 0) return;
    const res = await fetch("/api/admin/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: whName.trim() || "Webhook n8n",
        url: whUrl.trim(),
        secret: whSecret.trim(),
        events: whEvents,
        active: true,
      }),
    });
    if (res.ok) {
      setWhUrl("");
      await loadData();
    }
  }

  async function handleDeleteWebhook(id: string) {
    await fetch(`/api/admin/webhooks?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleResendLog(logId: string) {
    setResendingId(logId);
    try {
      await fetch("/api/admin/webhooks/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      await loadData();
    } finally {
      setResendingId(null);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-teal-600 mb-2" />
        Carregando integrações...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrações & API</h1>
          <p className="text-sm text-slate-500">
            API Keys, Webhooks HMAC de saída, Templates n8n (.json) e exemplos prontos
          </p>
        </div>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ExternalLink className="h-4 w-4" />
          OpenAPI Spec (/api/docs)
        </a>
      </div>

      {/* 1. TEMPLATES PRONTOS N8N */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">
            Templates Prontos de Fluxos n8n (.json)
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          Baixe os arquivos abaixo e importe diretamente no seu n8n (Menu &gt; Import
          from File). Basta preencher sua <code>x-api-key</code> e a URL da Evolution
          API / WhatsApp Cloud API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="font-bold text-slate-900">
                Fluxo 1 — Lembrete Automático Diário (Cron)
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Schedule Trigger (08:00) &rarr; busca agendamentos <code>PENDING</code> de
                amanhã via <code>GET /api/v1/appointments</code> &rarr; envia lembrete no
                WhatsApp pedindo 1 para CONFIRMAR ou 2 para CANCELAR.
              </p>
            </div>
            <a
              href="/api/admin/n8n-templates/fluxo-lembrete-cron.json"
              download
              className="h-10 px-4 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar fluxo-lembrete-cron.json
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="font-bold text-slate-900">
                Fluxo 2 — Resposta do Paciente (Confirmar / Cancelar)
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Webhook WhatsApp &rarr; normaliza telefone E.164 &rarr; consulta{" "}
                <code>/by-phone/&#123;whatsapp&#125;</code> &rarr; Switch: 1 confirma, 2
                cancela e devolve a vaga automaticamente.
              </p>
            </div>
            <a
              href="/api/admin/n8n-templates/fluxo-resposta-whatsapp.json"
              download
              className="h-10 px-4 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar fluxo-resposta-whatsapp.json
            </a>
          </div>
        </div>
      </section>

      {/* 2. GERENCIADOR DE API KEYS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">API Keys (n8n / REST)</h2>
        </div>

        <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave (ex: n8n Produção)"
            className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 text-sm"
          />
          <button
            type="submit"
            className="h-10 px-5 rounded-xl bg-teal-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Gerar Nova API Key
          </button>
        </form>

        {createdRawKey && (
          <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-2">
            <div className="text-xs font-bold text-amber-900 uppercase">
              Copie agora — esta chave não será exibida novamente!
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono break-all">
                {createdRawKey}
              </code>
              <button
                type="button"
                onClick={() => copyText(createdRawKey)}
                className="h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? "Copiada" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">Prefixo</th>
                <th className="py-2 pr-3">Último Uso</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
                    Nenhuma API Key gerada ainda.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">{k.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">
                      {k.prefix}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString("pt-BR")
                        : "Nunca usada"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          k.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {k.active ? "Ativa" : "Revogada"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {k.active && (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. WEBHOOKS DE SAÍDA + LOGS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Webhooks de Saída (HMAC-SHA256)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar logs
          </button>
        </div>

        <form
          onSubmit={handleCreateWebhook}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
        >
          <input
            type="text"
            value={whName}
            onChange={(e) => setWhName(e.target.value)}
            placeholder="Nome do Webhook"
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
          />
          <input
            type="url"
            required
            value={whUrl}
            onChange={(e) => setWhUrl(e.target.value)}
            placeholder="https://seu-n8n.com/webhook/..."
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
          />
          <input
            type="text"
            required
            value={whSecret}
            onChange={(e) => setWhSecret(e.target.value)}
            placeholder="Webhook Secret (HMAC)"
            className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
          />

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            {ALL_EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-1.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={whEvents.includes(ev.id)}
                  onChange={(e) =>
                    setWhEvents((prev) =>
                      e.target.checked
                        ? [...prev, ev.id]
                        : prev.filter((x) => x !== ev.id)
                    )
                  }
                />
                <code>{ev.label}</code>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-teal-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Adicionar Webhook
          </button>
        </form>

        {/* Lista de Webhooks configurados */}
        {webhooks.length > 0 && (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{wh.name}</div>
                  <div className="font-mono text-slate-600 break-all">{wh.url}</div>
                  <div className="text-slate-500 mt-0.5">
                    Eventos: {wh.events.join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteWebhook(wh.id)}
                  className="text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 font-semibold self-start sm:self-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Log de Webhooks */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            Últimos Disparos (Log de Webhooks)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Data/Hora</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2">HTTP</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-400">
                      Nenhum disparo registrado ainda.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">{l.event}</td>
                      <td className="px-3 py-2 max-w-xs truncate text-slate-600">
                        {l.webhook.url}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            l.success
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {l.statusCode ?? "ERR"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={resendingId === l.id}
                          onClick={() => handleResendLog(l.id)}
                          className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          Reenviar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. EXEMPLOS PRONTOS CURL & JSON */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">
            Exemplos Prontos para n8n (cURL & JSON)
          </h2>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <div className="font-bold text-slate-800 mb-1">
              1. Listar agendamentos pendentes de uma data
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-3.5 overflow-x-auto">
{`curl -X GET "${origin}/api/v1/appointments?date=2026-11-26&status=PENDING" \\
  -H "x-api-key: SUA_API_KEY"`}
            </pre>
          </div>

          <div>
            <div className="font-bold text-slate-800 mb-1">
              2. Buscar próximo agendamento ativo por WhatsApp (E.164)
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-3.5 overflow-x-auto">
{`curl -X GET "${origin}/api/v1/appointments/by-phone/5591999999999" \\
  -H "x-api-key: SUA_API_KEY"`}
            </pre>
          </div>

          <div>
            <div className="font-bold text-slate-800 mb-1">
              3. Confirmar ou Cancelar (devolvendo a vaga automaticamente)
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-3.5 overflow-x-auto">
{`# Confirmar
curl -X PATCH "${origin}/api/v1/appointments/{id}/confirm" \\
  -H "x-api-key: SUA_API_KEY"

# Cancelar e devolver vaga
curl -X PATCH "${origin}/api/v1/appointments/{id}/cancel" \\
  -H "x-api-key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "Paciente respondeu 2 no WhatsApp"}'`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
