"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Lock, Stethoscope } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@clinica.com.br");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Credenciais inválidas");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#12102b] relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Ambient Violet Glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#7c5cff]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#3b9eff]/20 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md bg-[#1a183b]/95 backdrop-blur-xl rounded-3xl border border-[#2f2b63] shadow-2xl shadow-black/40 p-7 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#957bff] to-[#6344ff] text-white flex items-center justify-center mb-3.5 shadow-lg shadow-violet-600/35">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Painel Ortopedia
          </h1>
          <p className="text-sm text-[#9e9bc4] mt-1">
            Gestão de Cotas, Recepção &amp; Integrações
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 flex items-center gap-2 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#a8a5ce] mb-1.5"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[48px] px-4 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#6f6c9a] focus:outline-none focus:ring-2 focus:ring-[#8b6dff] focus:border-[#8b6dff]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[#a8a5ce] mb-1.5"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full min-h-[48px] px-4 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#6f6c9a] focus:outline-none focus:ring-2 focus:ring-[#8b6dff] focus:border-[#8b6dff]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[50px] rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6448ff] border border-white/75 hover:border-white text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Entrar no Painel
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#2b2859] text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#9e9bc4] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Portal do Paciente
          </Link>
        </div>
      </div>
    </div>
  );
}
