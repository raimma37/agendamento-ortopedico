"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Edit3,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { MODULE_DEFINITIONS, type AdminModule } from "@/lib/permissions";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isSystemSuperAdmin: boolean;
  permissions: AdminModule[];
  active: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Edição do Superadmin (SOMENTE e-mail e senha)
  const [editingSuper, setEditingSuper] = useState(false);
  const [superEmail, setSuperEmail] = useState("");
  const [superPassword, setSuperPassword] = useState("");
  const [savingSuper, setSavingSuper] = useState(false);

  // Cadastro de novo usuário
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPermissions, setNewPermissions] = useState<AdminModule[]>(["dashboard"]);
  const [creating, setCreating] = useState(false);

  // Edição de usuário comum
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<AdminModule[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Não foi possível carregar os usuários.");
        return;
      }
      const json = await res.json();
      setUsers(json.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const superAdmin = users.find((u) => u.isSystemSuperAdmin || u.role === "SUPERADMIN");
  const regularUsers = users.filter((u) => !u.isSystemSuperAdmin && u.role !== "SUPERADMIN");

  function openSuperEdit() {
    if (!superAdmin) return;
    setSuperEmail(superAdmin.email);
    setSuperPassword("");
    setEditingSuper(true);
    setError(null);
  }

  async function handleSaveSuper(e: React.FormEvent) {
    e.preventDefault();
    if (!superAdmin) return;
    setError(null);
    setSavingSuper(true);
    try {
      const payload: { email?: string; password?: string } = {};
      if (superEmail.trim() && superEmail.trim().toLowerCase() !== superAdmin.email) {
        payload.email = superEmail.trim();
      }
      if (superPassword.trim()) {
        payload.password = superPassword.trim();
      }
      if (Object.keys(payload).length === 0) {
        setError("Altere o e-mail ou informe uma nova senha para salvar.");
        return;
      }

      const res = await fetch(`/api/admin/users/${superAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao atualizar Superadmin.");
        return;
      }
      setEditingSuper(false);
      setSuperPassword("");
      await loadUsers();
      showToast("Credenciais do Superadmin atualizadas com sucesso!");
    } finally {
      setSavingSuper(false);
    }
  }

  function togglePerm(
    list: AdminModule[],
    setter: React.Dispatch<React.SetStateAction<AdminModule[]>>,
    mod: AdminModule
  ) {
    setter(list.includes(mod) ? list.filter((m) => m !== mod) : [...list, mod]);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          permissions: newPermissions,
          active: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao cadastrar usuário.");
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewPermissions(["dashboard"]);
      await loadUsers();
      showToast("Usuário cadastrado com sucesso!");
    } finally {
      setCreating(false);
    }
  }

  function startEditUser(u: UserRecord) {
    setEditingUserId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditActive(u.active);
    setEditPermissions([...u.permissions]);
    setError(null);
  }

  async function handleSaveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUserId) return;
    setError(null);
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          password: editPassword.trim() || undefined,
          active: editActive,
          permissions: editPermissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao salvar alterações.");
        return;
      }
      setEditingUserId(null);
      await loadUsers();
      showToast("Perfil atualizado com sucesso!");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteUser(u: UserRecord) {
    if (u.isSystemSuperAdmin || u.role === "SUPERADMIN") return;
    const confirmed = window.confirm(
      `Tem certeza que deseja apagar permanentemente o usuário "${u.name}" (${u.email})?`
    );
    if (!confirmed) return;

    setDeletingId(u.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Não foi possível apagar o usuário.");
        return;
      }
      await loadUsers();
      showToast("Usuário removido permanentemente.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-[#9c99c4]">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-[#8b6dff] mb-2" />
        Carregando gestão de usuários...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-[#957bff]" />
            Usuários &amp; Permissões
          </h1>
          <p className="text-sm text-[#9c99c4] mt-0.5">
            Área exclusiva do Superadmin — gerencie perfis de acesso e permissões por
            módulo
          </p>
        </div>
        {toast && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] text-white text-sm font-semibold border border-white/50 shadow-lg shadow-violet-600/30">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3.5 flex items-center gap-2.5 text-sm text-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CONTA PADRÃO SUPERADMIN (PROTEGIDA E INDESTRUTÍVEL) */}
      {superAdmin && (
        <section className="rounded-2xl bg-gradient-to-br from-[#261f5c] via-[#1d1947] to-[#1a173d] border border-[#5c4ab8] p-5 shadow-xl shadow-black/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">
                    {superAdmin.name}
                  </h2>
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/45">
                    Superadmin • Conta Padrão Fixa
                  </span>
                </div>
                <div className="text-sm text-[#c7c4eb] font-mono mt-0.5">
                  {superAdmin.email}
                </div>
                <p className="text-xs text-[#a8a5ce] mt-1 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  Poder exclusivo e irrevogável de criar e deletar perfis. Esta conta
                  nunca pode ser apagada — apenas e-mail e senha podem ser alterados.
                </p>
              </div>
            </div>

            {!editingSuper && (
              <button
                type="button"
                onClick={openSuperEdit}
                className="h-10 px-4 rounded-xl bg-[#27225c] hover:bg-[#332c75] border border-white/45 hover:border-white text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
              >
                <KeyRound className="h-4 w-4 text-amber-300" />
                Alterar E-mail / Senha
              </button>
            )}
          </div>

          {editingSuper && (
            <form
              onSubmit={handleSaveSuper}
              className="pt-4 border-t border-[#3b3578] grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-[#c7c4eb] mb-1">
                  Novo E-mail do Superadmin
                </label>
                <input
                  type="email"
                  required
                  value={superEmail}
                  onChange={(e) => setSuperEmail(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#453d91] bg-[#13112d] text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#c7c4eb] mb-1">
                  Nova Senha (deixe em branco para manter)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={superPassword}
                  onChange={(e) => setSuperPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#453d91] bg-[#13112d] text-white text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingSuper}
                  className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border border-white/60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:brightness-110 disabled:opacity-50"
                >
                  {savingSuper ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Credenciais
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSuper(false)}
                  className="h-10 px-3 rounded-xl bg-[#141230] border border-white/35 text-[#c7c4eb] hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* 2. CADASTRAR NOVO USUÁRIO */}
      <section className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-5 shadow-lg shadow-black/20 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-[#957bff]" />
          <h2 className="text-lg font-bold text-white">Cadastrar Novo Usuário</h2>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Nome completo *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Maria Recepção"
                className="w-full h-10 px-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#6f6c9a] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                E-mail de acesso *
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="recepcao@clinica.com.br"
                className="w-full h-10 px-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#6f6c9a] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                Senha inicial *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full h-10 px-3.5 rounded-xl border border-[#322e66] bg-[#13112d] text-white placeholder-[#6f6c9a] text-sm"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#a792ff] mb-2">
              Permissões de Módulos
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {MODULE_DEFINITIONS.map((mod) => {
                const checked = newPermissions.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? "bg-[#26215c] border-[#8b6dff] text-white"
                        : "bg-[#141230] border-[#2e2a61] text-[#a8a5ce] hover:border-[#4e4699]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        togglePerm(newPermissions, setNewPermissions, mod.id)
                      }
                      className="mt-0.5 h-4 w-4 rounded accent-[#8b6dff] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{mod.label}</div>
                      <div className="text-[11px] text-[#8d8ab8] leading-snug mt-0.5">
                        {mod.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border border-white/60 text-white font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-violet-600/25 hover:brightness-110 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Cadastrar Usuário
            </button>
          </div>
        </form>
      </section>

      {/* 3. LISTA DE PERFIS ADICIONAIS (EDITÁVEIS E APAGÁVEIS) */}
      <section className="bg-[#1b183d] rounded-2xl border border-[#2d295e] p-5 shadow-lg shadow-black/20 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            Usuários Cadastrados ({regularUsers.length})
          </h2>
          <span className="text-xs text-[#8d8ab8]">
            Podem ser editados ou apagados pelo Superadmin
          </span>
        </div>

        {regularUsers.length === 0 ? (
          <div className="rounded-xl bg-[#141230] border border-[#2a2657] p-8 text-center text-sm text-[#8d8ab8]">
            Nenhum usuário adicional cadastrado ainda. Use o formulário acima para criar
            perfis para recepção ou equipe.
          </div>
        ) : (
          <div className="space-y-3">
            {regularUsers.map((u) => {
              const isEditing = editingUserId === u.id;
              return (
                <div
                  key={u.id}
                  className="rounded-2xl bg-[#141230] border border-[#2e2a61] p-4 space-y-3"
                >
                  {!isEditing ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{u.name}</span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              u.active
                                ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/35"
                                : "bg-rose-500/15 text-rose-300 border-rose-500/35"
                            }`}
                          >
                            {u.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div className="text-xs text-[#9c99c4] font-mono">{u.email}</div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {u.permissions.length === 0 ? (
                            <span className="text-[11px] text-rose-300">
                              Nenhum módulo liberado
                            </span>
                          ) : (
                            u.permissions.map((perm) => {
                              const def = MODULE_DEFINITIONS.find((m) => m.id === perm);
                              return (
                                <span
                                  key={perm}
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-[#231f52] text-[#c7c4eb] border border-[#3d3780]"
                                >
                                  {def?.label || perm}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditUser(u)}
                          className="h-9 px-3 rounded-xl bg-[#1f1c47] border border-white/35 hover:border-white text-xs font-semibold text-white inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#957bff]" />
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === u.id}
                          onClick={() => handleDeleteUser(u)}
                          className="h-9 px-3 rounded-xl bg-rose-500/15 border border-rose-400/45 hover:border-rose-300 text-xs font-semibold text-rose-200 inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {deletingId === u.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Apagar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveEditUser} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#2a2657] pb-2">
                        <span className="text-sm font-bold text-white">
                          Editando perfil: {u.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="text-[#8d8ab8] hover:text-white p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            required
                            minLength={2}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#1b183d] text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                            E-mail
                          </label>
                          <input
                            type="email"
                            required
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#1b183d] text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#9c99c4] mb-1">
                            Nova Senha (opcional)
                          </label>
                          <input
                            type="password"
                            minLength={6}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Deixe vazio para manter"
                            className="w-full h-10 px-3 rounded-xl border border-[#322e66] bg-[#1b183d] text-white text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {MODULE_DEFINITIONS.map((mod) => {
                          const checked = editPermissions.includes(mod.id);
                          return (
                            <label
                              key={mod.id}
                              className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-semibold ${
                                checked
                                  ? "bg-[#26215c] border-[#8b6dff] text-white"
                                  : "bg-[#1b183d] border-[#2e2a61] text-[#9c99c4]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  togglePerm(editPermissions, setEditPermissions, mod.id)
                                }
                                className="h-4 w-4 rounded accent-[#8b6dff]"
                              />
                              <span>{mod.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#d5d3f5] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="h-4 w-4 rounded accent-[#8b6dff]"
                          />
                          Usuário ativo (pode fazer login)
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="h-9 px-3.5 rounded-xl bg-[#1b183d] border border-white/35 text-xs font-semibold text-[#c7c4eb]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#8f71ff] to-[#6344ff] border border-white/60 text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {savingEdit ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
