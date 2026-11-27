"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Crown,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Printer,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Webhook,
  X,
} from "lucide-react";
import {
  getFirstAllowedAdminRoute,
  getRequiredModuleForPath,
  hasModuleAccess,
  isSuperAdminUser,
  type AdminModule,
} from "@/lib/permissions";

interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  isSystemSuperAdmin: boolean;
  permissions: AdminModule[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: AdminModule;
  superAdminOnly?: boolean;
}

const MENU_PRIMARY: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: CalendarDays, module: "dashboard" },
  { href: "/admin/pacientes", label: "Pacientes", icon: Users, module: "patients" },
  {
    href: "/admin/relatorios",
    label: "Relatórios & Estatísticas",
    icon: Printer,
    module: "reports",
  },
];

const MENU_MANAGE: NavItem[] = [
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: Settings,
    module: "settings",
  },
  {
    href: "/admin/integracoes",
    label: "Integrações & API",
    icon: Webhook,
    module: "integrations",
  },
  {
    href: "/admin/usuarios",
    label: "Usuários & Permissões",
    icon: ShieldCheck,
    superAdminOnly: true,
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
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

  // Redireciona automaticamente caso o usuário acesse rota de um módulo sem permissão
  const requiredModule = getRequiredModuleForPath(pathname);
  const isSuper = isSuperAdminUser(user);
  const hasCurrentRouteAccess =
    !requiredModule ||
    (requiredModule === "users"
      ? isSuper
      : hasModuleAccess(user, requiredModule));

  useEffect(() => {
    if (checking || isLoginPage || !user || hasCurrentRouteAccess) return;
    const fallback = getFirstAllowedAdminRoute(user);
    if (fallback && fallback !== pathname) {
      router.replace(fallback);
    }
  }, [checking, isLoginPage, user, hasCurrentRouteAccess, pathname, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#12102b]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8b6dff]" />
      </div>
    );
  }

  const visiblePrimary = MENU_PRIMARY.filter((item) =>
    item.module ? hasModuleAccess(user, item.module) : true
  );
  const visibleManage = MENU_MANAGE.filter((item) => {
    if (item.superAdminOnly) return isSuper;
    return item.module ? hasModuleAccess(user, item.module) : true;
  });

  function renderNavItem(item: NavItem) {
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
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
          active
            ? "bg-gradient-to-r from-[#9274ff] to-[#684aff] text-white border-white/70 shadow-lg shadow-violet-600/30"
            : "border-transparent text-[#9f9cc6] hover:bg-[#221f4a] hover:border-white/25 hover:text-white"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#12102b] text-[#f1f0ff] flex flex-col lg:flex-row print:bg-white print:text-black">
      {/* Topbar Mobile (oculta na impressão) */}
      <header className="lg:hidden bg-[#181638] border-b border-[#2a2759] px-4 py-3 flex items-center justify-between sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#957bff] to-[#6344ff] text-white flex items-center justify-center shadow-md shadow-violet-600/30">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">
            OrtoAgenda
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="h-10 w-10 rounded-xl bg-[#221f4a] border border-white/40 hover:border-white flex items-center justify-center text-white"
          aria-label="Abrir menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Midnight Indigo (oculta na impressão) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#171535] border-r border-[#292657] flex flex-col transform transition-transform lg:static lg:translate-x-0 print:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#9c82ff] to-[#6444ff] text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/35">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-white text-base tracking-tight truncate">
              OrtoAgenda
            </div>
            <div className="text-[11px] text-[#8d8ab8] truncate">
              Especialidade Joelho
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3.5 py-2 space-y-5 overflow-y-auto">
          {visiblePrimary.length > 0 && (
            <div>
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6f6c9e]">
                Menu
              </div>
              <div className="space-y-1">{visiblePrimary.map(renderNavItem)}</div>
            </div>
          )}

          {visibleManage.length > 0 && (
            <div>
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6f6c9e]">
                Gestão
              </div>
              <div className="space-y-1">{visibleManage.map(renderNavItem)}</div>
            </div>
          )}
        </nav>

        {/* Bottom Highlight Gradient Card */}
        <div className="p-4 space-y-2.5">
          <div className="rounded-2xl bg-gradient-to-br from-[#9e84ff] via-[#8362ff] to-[#6341ff] p-4 text-white shadow-xl shadow-violet-700/30 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15 blur-lg" />
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Sparkles className="h-4 w-4" />
              Portal do Paciente
            </div>
            <p className="text-[11px] text-violet-100 mt-1 leading-relaxed">
              Compartilhe o link mobile-first de autoatendimento no WhatsApp.
            </p>
            <Link
              href="/"
              target="_blank"
              className="mt-3 w-full h-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-xs border border-white/65 hover:border-white text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Portal Público
            </Link>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-[#211e47] hover:bg-rose-500/15 border border-white/35 hover:border-white/80 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Area with Top Utility Bar */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Desktop Bar (oculta na impressão) */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[#252250] bg-[#141230]/80 backdrop-blur-md sticky top-0 z-20 print:hidden">
          <div className="text-xs font-medium text-[#8d8ab8]">
            Sistema de Agendamento Ortopédico por Cotas • Banco 100% Local
          </div>
          <div className="flex items-center gap-3">
            {hasModuleAccess(user, "reports") && (
              <Link
                href="/admin/relatorios"
                className="h-9 px-3.5 rounded-xl bg-[#1d1a42] border border-white/35 hover:border-white/85 text-xs font-semibold text-[#d5d3f5] hover:text-white flex items-center gap-2 transition-colors"
              >
                <Printer className="h-3.5 w-3.5 text-[#957bff]" />
                Imprimir A4
              </Link>
            )}
            <div className="h-9 pl-2 pr-3 rounded-xl bg-[#1f1c47] border border-[#332f6b] flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#957bff] to-[#3b9eff] text-white text-[11px] font-bold flex items-center justify-center">
                {isSuper ? (
                  <Crown className="h-3.5 w-3.5" />
                ) : (
                  (user?.name || "U").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">
                  {user?.name || "Usuário"}
                </span>
                {isSuper && (
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    Superadmin
                  </span>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#8d8ab8]" />
            </div>
          </div>
        </div>

        {/* Conteúdo das páginas */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 print:p-0">
          {!hasCurrentRouteAccess ? (
            <div className="max-w-md mx-auto mt-16 bg-[#1b183d] border border-[#2d295e] rounded-2xl p-7 text-center shadow-xl">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Acesso Restrito</h2>
              <p className="text-sm text-[#9c99c4] mt-1">
                Seu perfil não possui permissão para acessar este módulo. Solicite ao
                Superadmin a liberação do acesso.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
