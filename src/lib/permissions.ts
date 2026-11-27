export const ADMIN_MODULES = [
  "dashboard",
  "patients",
  "reports",
  "settings",
  "integrations",
] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

export interface ModuleDefinition {
  id: AdminModule;
  label: string;
  description: string;
  href: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard & Atendimento",
    description: "Visualizar agenda do dia, fila de chegada e alterar status das consultas",
    href: "/admin",
  },
  {
    id: "patients",
    label: "Base de Pacientes",
    description: "Consultar histórico completo de agendamentos por paciente",
    href: "/admin/pacientes",
  },
  {
    id: "reports",
    label: "Relatórios & Estatísticas",
    description: "Gerar relatórios diários, gráficos, impressão A4 e exportação CSV",
    href: "/admin/relatorios",
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Gerenciar cotas semanais, datas individuais, locais, convênios e parâmetros",
    href: "/admin/configuracoes",
  },
  {
    id: "integrations",
    label: "Integrações & API",
    description: "Gerenciar API Keys, Webhooks n8n e baixar templates de automação",
    href: "/admin/integracoes",
  },
];

export interface UserAccessSubject {
  role: string;
  isSystemSuperAdmin?: boolean;
  permissions?: string[];
}

export function isSuperAdminUser(user: UserAccessSubject | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isSystemSuperAdmin && user.role === "SUPERADMIN");
}

export function hasModuleAccess(
  user: UserAccessSubject | null | undefined,
  moduleId: AdminModule
): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(moduleId);
}

export function getRequiredModuleForPath(pathname: string): AdminModule | "users" | null {
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  if (pathname.startsWith("/admin/pacientes")) return "patients";
  if (pathname.startsWith("/admin/relatorios")) return "reports";
  if (pathname.startsWith("/admin/configuracoes")) return "settings";
  if (pathname.startsWith("/admin/integracoes")) return "integrations";
  if (pathname.startsWith("/admin/usuarios")) return "users";
  return null;
}

export function getFirstAllowedAdminRoute(
  user: UserAccessSubject | null | undefined
): string | null {
  if (!user) return null;
  if (isSuperAdminUser(user)) return "/admin";
  for (const mod of MODULE_DEFINITIONS) {
    if (hasModuleAccess(user, mod.id)) {
      return mod.href;
    }
  }
  return null;
}
