import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center mb-3">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="text-sm text-slate-600 mt-1 max-w-sm">
        O endereço acessado não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="mt-5 min-h-[46px] px-5 rounded-xl bg-teal-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-teal-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Agendamento
      </Link>
    </div>
  );
}
