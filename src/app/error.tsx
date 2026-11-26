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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Algo deu errado</h1>
      <p className="text-sm text-slate-600 mt-1 max-w-sm">
        Ocorreu um erro inesperado ao carregar esta página. Tente novamente em
        instantes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 min-h-[46px] px-5 rounded-xl bg-teal-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-teal-700"
      >
        <RotateCcw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
