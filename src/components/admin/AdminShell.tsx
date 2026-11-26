"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  LogOut,
  Menu,
  Printer,
  Settings,
  Stethoscope,
  Users,
  Webhook,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard do Dia", icon: CalendarDays },
  { href: "/admin/pacientes", label: "Base de Pacientes", icon: Users },
  { href: "/admin/relatorios", label: "Relatórios & Impressão", icon: Printer },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { href: "/admin/integracoes", label: "Integrações & API", icon: Webhook },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }
        const json = await res.json();
        setUser(json.user);
        setChecking(false);
      })
      .catch(() => {
        if (active) router.replace("/admin/login");
      });

    return () => {
      active = false;
    };
  }, [isLoginPage, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Topbar Mobile (oculta na impressão) */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm">
            Painel Ortopedia
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="h-10 w-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700"
          aria-label="Abrir menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (oculta na impressão) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transform transition-transform lg:static lg:translate-x-0 print:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate">
              Agenda Ortopedia
            </div>
            <div className="text-xs text-slate-400 truncate">
              {user?.name || "Administração"}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Abrir Portal do Paciente
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-red-300 hover:bg-red-950/50 hover:text-red-200"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Área de Conteúdo */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 print:p-0">
        {children}
      </main>
    </div>
  );
}
