import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#12102b] text-[#f1f0ff] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-[#221e4d] border border-[#3a3675] text-[#a792ff] flex items-center justify-center mb-3">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold text-white">Página não encontrada</h1>
      <p className="text-sm text-[#9c99c4] mt-1 max-w-sm">
        O endereço acessado não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="mt-5 min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white font-bold inline-flex items-center gap-2 shadow-lg shadow-violet-600/30 hover:brightness-110"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Agendamento
      </Link>
    </div>
  );
}
