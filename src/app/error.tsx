"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#12102b] text-[#f1f0ff] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-white">Algo deu errado</h1>
      <p className="text-sm text-[#9c99c4] mt-1 max-w-sm">
        Ocorreu um erro inesperado ao carregar esta página. Tente novamente em
        instantes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white font-bold inline-flex items-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110"
      >
        <RotateCcw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
