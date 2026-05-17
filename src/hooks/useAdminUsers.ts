import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/use-i18n";
import { logAudit } from "@/lib/audit";

export type AppRole = "admin" | "moderator" | "user";

export type UserWithRole = {
  id: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  is_blocked: boolean;
  login_attempts: number;
  created_at: string;
  custom_permissions: string[] | null;
  role: AppRole;
};

export const availablePermissions = [
  {
    category: "Registros",
    permissions: [
      { key: "records.view",   label: "Ver registros",     description: "Visualizar lançamentos de presença" },
      { key: "records.create", label: "Criar lançamentos", description: "Registrar novas presenças" },
      { key: "records.edit",   label: "Editar / excluir",  description: "Alterar ou remover lançamentos" },
      { key: "records.export", label: "Exportar",          description: "Exportar PDF e Excel" },
      { key: "records.close",  label: "Fechar período",    description: "Encerrar períodos de ponto" },
    ],
  },
  {
    category: "Outros",
    permissions: [
      { key: "projection.view", label: "Ver projeção",   description: "Acessar análise de demanda" },
      { key: "admin.access",    label: "Painel admin",   description: "Entrar na área administrativa" },
    ],
  },
] as const;

export const rolePresets: Record<AppRole, string[]> = {
  user:      ["records.view", "records.create"],
  moderator: ["records.view", "records.create", "records.edit", "records.export", "projection.view"],
  admin:     availablePermissions.flatMap(c => c.permissions.map(p => p.key)),
};

async function callAdminFn(action: string, params: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  if ((json as { error?: string }).error) throw new Error((json as { error?: string }).error);
  return json;
}

export function useAdminUsers(opts: { enabled: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const [resetFeedback, setResetFeedback] = useState<Record<string, { text: string; ok: boolean }>>({});

  const { data: users = [], isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["admin-usuarios"],
    enabled: opts.enabled,
    queryFn: async () => {
      const { data: profiles, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (pe) throw pe;

      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesErr && import.meta.env.DEV) console.error("Erro ao carregar roles:", rolesErr.message);

      const rolesMap = new Map<string, AppRole>();
      (roles ?? []).forEach(r => rolesMap.set(r.user_id, r.role as AppRole));

      return (profiles ?? []).map(p => ({
        id:                 p.id,
        email:              p.email,
        is_admin:           p.is_admin ?? false,
        is_approved:        p.is_approved ?? true,
        is_blocked:         p.is_blocked ?? false,
        login_attempts:     p.login_attempts ?? 0,
        created_at:         p.created_at,
        custom_permissions: p.custom_permissions ?? [],
        role:               rolesMap.get(p.id) ?? (p.is_admin ? "admin" : "user"),
      }));
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ userId, isApproved }: { userId: string; isApproved: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_approved: isApproved }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Status de aprovação atualizado" });
      logAudit("UPDATE", "profiles", v.userId, { is_approved: v.isApproved });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Papel do usuário atualizado" });
      logAudit("UPDATE", "user_roles", v.userId, { role: v.role });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => { await callAdminFn("delete", { userId }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Usuário excluído com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (p: { email: string; password: string; is_admin: boolean }) => {
      await callAdminFn("create", p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Usuário criado com sucesso" });
    },
  });

  const handleResetPassword = async (email: string, userId: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      const msg = error ? `${t("admin_err_reset")} ${error.message}` : t("admin_email_sent");
      setResetFeedback(p => ({ ...p, [userId]: { text: msg, ok: !error } }));
      setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Erro ao resetar senha:", err);
      setResetFeedback(p => ({ ...p, [userId]: { text: "Erro ao enviar e-mail de reset.", ok: false } }));
      setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
    }
  };

  const unblockMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { error } = await supabase.rpc("admin_unblock_user", { p_user_id: userId });
      if (error) throw error;
      await handleResetPassword(email, userId);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Usuário desbloqueado. E-mail de redefinição enviado." });
      logAudit("UPDATE", "profiles", v.userId, { action: "unblock" });
    },
    onError: (e: Error) => toast({ title: "Erro ao desbloquear", description: e.message, variant: "destructive" }),
  });

  const permsMutation = useMutation({
    mutationFn: async ({ userId, perms }: { userId: string; perms: string[] }) => {
      const { error } = await supabase.from("profiles").update({ custom_permissions: perms }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Permissões salvas com sucesso" });
      logAudit("UPDATE", "profiles", v.userId, { custom_permissions: v.perms });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar permissões", description: e.message, variant: "destructive" }),
  });

  return {
    users,
    isLoading,
    approvalMutation,
    roleMutation,
    deleteMutation,
    createMutation,
    unblockMutation,
    permsMutation,
    handleResetPassword,
    resetFeedback,
  };
}
