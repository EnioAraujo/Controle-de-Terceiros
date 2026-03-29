import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { useToast } from "@/hooks/use-toast";
import { mapSupabaseError } from "@/lib/i18n-translations";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

// Lucide icons
import {
  Users, Shield, ShieldOff, Search, Crown, Pencil, Eye, User, Loader2,
  CheckCircle2, XCircle, Trash2, KeyRound, Settings, Plus, LayoutGrid, List,
  LogOut, ChevronLeft,
} from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────
type AppRole = "admin" | "moderator" | "user";

type UserWithRole = {
  id: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
  custom_permissions: string[] | null;
  role: AppRole;
};

type ModalMode = "create" | "edit" | "delete" | null;

// ── Permissões disponíveis no sistema ─────────────────────────────
const availablePermissions = [
  {
    category: "Registros",
    permissions: [
      { key: "records.view",   label: "Ver registros",    description: "Visualizar lançamentos de presença" },
      { key: "records.create", label: "Criar lançamentos", description: "Registrar novas presenças" },
      { key: "records.edit",   label: "Editar / excluir",  description: "Alterar ou remover lançamentos" },
      { key: "records.export", label: "Exportar",          description: "Exportar PDF e Excel" },
      { key: "records.close",  label: "Fechar período",    description: "Encerrar períodos de ponto" },
    ],
  },
  {
    category: "Outros",
    permissions: [
      { key: "projection.view", label: "Ver projeção",       description: "Acessar análise de demanda" },
      { key: "admin.access",    label: "Painel admin",        description: "Entrar na área administrativa" },
    ],
  },
];

const rolePresets: Record<AppRole, string[]> = {
  user:      ["records.view", "records.create"],
  moderator: ["records.view", "records.create", "records.edit", "records.export", "projection.view"],
  admin:     availablePermissions.flatMap(c => c.permissions.map(p => p.key)),
};

// ── Helpers visuais ───────────────────────────────────────────────
const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case "admin":     return <Crown  className="h-3 w-3 text-yellow-500" />;
    case "moderator": return <Pencil className="h-3 w-3 text-blue-500"   />;
    default:          return <Eye    className="h-3 w-3 text-slate-400"  />;
  }
};

const getRoleBadgeVariant = (role: AppRole): "default" | "secondary" | "destructive" | "outline" => {
  switch (role) {
    case "admin":     return "destructive";
    case "moderator": return "default";
    default:          return "secondary";
  }
};

const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case "admin":     return "Admin";
    case "moderator": return "Moderador";
    default:          return "Usuário";
  }
};

// Ícone SVG inline para manter o header existente funcionando
const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function AdminPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useI18n();
  const { toast }   = useToast();

  // ── Auth ──────────────────────────────────────────────────────────
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [myEmail,   setMyEmail]   = useState("");
  const [myId,      setMyId]      = useState("");
  const [authReady, setAuthReady] = useState(false);

  // UI state
  const [search,   setSearch]   = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Permissions tab
  const [selectedUserPerms, setSelectedUserPerms] = useState<UserWithRole | null>(null);
  const [customPerms,        setCustomPerms]       = useState<Set<string>>(new Set());

  // Delete dialog
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail,     setNewEmail]     = useState("");
  const [newPassword,  setNewPassword]  = useState("");
  const [newIsAdmin,   setNewIsAdmin]   = useState(false);
  const [createError,  setCreateError]  = useState("");

  // Change password
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg,     setPassMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  // MFA enrollment
  type MfaEnrollStep = "idle" | "qr" | "verify" | "done";
  const [mfaFactors,    setMfaFactors]    = useState<{ id: string; friendly_name?: string }[]>([]);
  const [mfaEnrollStep, setMfaEnrollStep] = useState<MfaEnrollStep>("idle");
  const [mfaEnrollId,   setMfaEnrollId]   = useState("");
  const [mfaQrCode,     setMfaQrCode]     = useState("");
  const [mfaSecret,     setMfaSecret]     = useState("");
  const [mfaCode,       setMfaCode]       = useState("");
  const [mfaLoading,    setMfaLoading]    = useState(false);
  const [mfaMsg,        setMfaMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  // Reset feedback
  const [resetFeedback, setResetFeedback] = useState<Record<string, { text: string; ok: boolean }>>({});

  // ── Auth init ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthReady(true); return; }
      setMyId(session.user.id);
      setMyEmail(session.user.email ?? "");
      // Usa rpc('is_admin') — SECURITY DEFINER, bypassa RLS, sem risco de recursão
      const { data: adminResult, error: adminErr } = await supabase.rpc('is_admin');
      if (adminErr) console.error("Erro ao verificar admin:", adminErr.message);
      setIsAdmin(!!adminResult);
      setAuthReady(true);
    }).catch((err: unknown) => {
      console.error("Erro ao obter sessão:", err);
      setAuthReady(true);
    });
  }, []);

  // ── MFA: carregar fatores inscritos ───────────────────────────────
  const loadMfaFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { console.error("Erro ao listar fatores MFA:", error.message); return; }
    setMfaFactors(data?.totp ?? []);
  }, []);

  useEffect(() => {
    loadMfaFactors().catch((err: unknown) => console.error("Erro ao carregar MFA:", err));
  }, [loadMfaFactors]);

  const handleMfaEnroll = async () => {
    setMfaLoading(true);
    setMfaMsg(null);
    try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Controle de Terceiros",
    });
    if (error || !data) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao iniciar inscrição MFA." : "Error starting MFA enrollment." });
      return;
    }
    setMfaEnrollId(data.id);
    setMfaQrCode(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaEnrollStep("qr");
    } catch (err) {
      console.error("Erro ao inscrever MFA:", err);
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao iniciar inscrição MFA." : "Error starting MFA enrollment." });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaVerifyEnroll = async () => {
    setMfaLoading(true);
    setMfaMsg(null);
    try {
    const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollId });
    if (chalErr || !challenge) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao criar desafio MFA." : "Error creating MFA challenge." });
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollId,
      challengeId: challenge.id,
      code: mfaCode.replace(/\s/g, ""),
    });
    if (verErr) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Código inválido. Tente novamente." : "Invalid code. Try again." });
      setMfaCode("");
      return;
    }
    setMfaEnrollStep("done");
    setMfaMsg({ ok: true, text: lang === "pt-BR" ? "MFA ativado com sucesso!" : "MFA activated successfully!" });
    setMfaCode("");
    await loadMfaFactors();
    } catch (err) {
      console.error("Erro ao verificar MFA:", err);
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao verificar código MFA." : "Error verifying MFA code." });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaUnenroll = async (factorId: string) => {
    setMfaLoading(true);
    setMfaMsg(null);
    try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
      return;
    }
    setMfaMsg({ ok: true, text: lang === "pt-BR" ? "MFA removido." : "MFA removed." });
    setMfaEnrollStep("idle");
    await loadMfaFactors();
    } catch (err) {
      console.error("Erro ao remover MFA:", err);
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
    } finally {
      setMfaLoading(false);
    }
  };

  // ── Vercel API Route helper ───────────────────────────────────────
  const callAdminFn = async (action: string, params: Record<string, unknown>) => {
    // Chama a Vercel Serverless Function em /api/admin-users (mesmo domínio,
    // sem CORS), que usa SUPABASE_SERVICE_ROLE_KEY no servidor para validar
    // o token e executar operações admin.
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
  };

  // ── Query: listar usuários ────────────────────────────────────────
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<UserWithRole[]>({
    queryKey: ["admin-usuarios"],
    enabled: authReady && isAdmin,
    queryFn: async () => {
      const { data: profiles, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (pe) throw pe;

      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesErr) console.error("Erro ao carregar roles:", rolesErr.message);

      const rolesMap = new Map<string, AppRole>();
      (roles ?? []).forEach(r => rolesMap.set(r.user_id, r.role as AppRole));

      return (profiles ?? []).map(p => ({
        id:                  p.id,
        email:               p.email,
        is_admin:            p.is_admin ?? false,
        is_approved:         p.is_approved ?? true,
        created_at:          p.created_at,
        custom_permissions:  p.custom_permissions ?? [],
        role:                rolesMap.get(p.id) ?? (p.is_admin ? "admin" : "user"),
      }));
    },
  });

  // ── Mutation: toggle aprovação ────────────────────────────────────
  const approvalMutation = useMutation({
    mutationFn: async ({ userId, isApproved }: { userId: string; isApproved: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: isApproved })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Status de aprovação atualizado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Mutation: atualizar role ──────────────────────────────────────
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Papel do usuário atualizado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Mutation: excluir usuário ─────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await callAdminFn("delete", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Usuário excluído com sucesso" });
      setIsDeleteOpen(false);
      setUserToDelete(null);
      if (selectedUserPerms?.id === userToDelete?.id) setSelectedUserPerms(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  // ── Mutation: criar usuário ───────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async ({ email, password, is_admin }: { email: string; password: string; is_admin: boolean }) => {
      await callAdminFn("create", { email, password, is_admin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Usuário criado com sucesso" });
      setIsCreateOpen(false);
      setNewEmail(""); setNewPassword(""); setNewIsAdmin(false); setCreateError("");
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  // ── Mutation: salvar permissões ───────────────────────────────────
  const permsMutation = useMutation({
    mutationFn: async ({ userId, perms }: { userId: string; perms: string[] }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ custom_permissions: perms })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      toast({ title: "Permissões salvas com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar permissões", description: e.message, variant: "destructive" }),
  });

  // ── Reset password (e-mail) ───────────────────────────────────────
  const handleResetPassword = async (email: string, userId: string) => {
    try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    const msg = error ? `${t("admin_err_reset")} ${error.message}` : t("admin_email_sent");
    setResetFeedback(p => ({ ...p, [userId]: { text: msg, ok: !error } }));
    setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
    } catch (err) {
      console.error("Erro ao resetar senha:", err);
      setResetFeedback(p => ({ ...p, [userId]: { text: "Erro ao enviar e-mail de reset.", ok: false } }));
      setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
    }
  };

  // ── Change own password ───────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg({ ok: false, text: t("admin_pass_mismatch") }); return; }
    if (newPass.length < 8)     { setPassMsg({ ok: false, text: t("admin_pass_short") });    return; }
    setPassLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setPassLoading(false);
    if (error) {
      setPassMsg({ ok: false, text: mapSupabaseError(error.message, lang) });
    } else {
      setPassMsg({ ok: true, text: t("admin_pass_success") });
      setNewPass(""); setConfirmPass("");
    }
    setTimeout(() => setPassMsg(null), 5000);
  };

  // ── Handlers permissões ───────────────────────────────────────────
  const handleSelectUserPerms = (user: UserWithRole) => {
    setSelectedUserPerms(user);
    const src = (user.custom_permissions && user.custom_permissions.length > 0)
      ? user.custom_permissions
      : rolePresets[user.role] ?? [];
    setCustomPerms(new Set(src));
  };

  const allPermKeys = availablePermissions.flatMap(c => c.permissions.map(p => p.key));

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading / Guard ───────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#FAF9FB" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color:"#F37E38" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#FAF9FB", padding:24 }}>
        <div className="text-center">
          <ShieldOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 style={{ fontSize:22, fontWeight:800, color:"#212B36", marginBottom:8 }}>{t("admin_access_denied")}</h1>
          <p style={{ color:"#9898B0", marginBottom:24 }}>{t("admin_access_denied_desc")}</p>
          <Button onClick={() => navigate("/")}>{t("admin_back_home")}</Button>
        </div>
      </div>
    );
  }

  const totalAdmins = users.filter(u => u.role === "admin").length;
  const totalCommon = users.length - totalAdmins;

  return (
    <div style={{ minHeight:"100vh", background:"#FAF9FB", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');`}</style>
      {/* Header — mesmas cores do app principal */}
      <header style={{ background:"#212B36", borderBottom:"1px solid #2E3B4A", height:58, display:"flex", alignItems:"center", padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:28, borderRight:"1px solid #2E3B4A", marginRight:20 }}>
          <img src="/admin.png" alt="Administração" style={{ width:34, height:34, borderRadius:9, objectFit:"cover" }} />
          <div>
            <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Controle de</div>
            <div style={{ color:"#F37E38", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Terceiros</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:"#F37E3818", border:"1px solid #F37E3833", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#F37E38", fontWeight:600 }}>
          <Shield className="h-3 w-3" style={{ marginRight:4 }} />{t("admin_header_badge")}
        </div>
        <div style={{ flex:1 }} />
        <span className="hidden sm:block" style={{ color:"#9898B0", fontSize:11, marginRight:8 }}>{myEmail}</span>
        <button onClick={() => navigate("/")} style={{ display:"flex", alignItems:"center", gap:4, background:"transparent", border:"none", cursor:"pointer", color:"#9898B0", fontSize:13, fontFamily:"inherit", fontWeight:600, padding:"6px 10px", borderRadius:7 }}>
          <ChevronLeft className="h-4 w-4" />{t("admin_back_app")}
        </button>
        <button onClick={() => supabase.auth.signOut()} style={{ display:"flex", alignItems:"center", background:"transparent", border:"none", cursor:"pointer", color:"#9898B0", padding:"6px 8px", borderRadius:7 }}>
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <p style={{ fontSize:11, color:"#9898B0", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600, marginBottom:4 }}>{t("admin_section_sys")}</p>
          <h1 style={{ fontSize:24, fontWeight:800, color:"#212B36", letterSpacing:-.5, lineHeight:1.2 }}>{t("admin_panel_title")}</h1>
          <p style={{ fontSize:13, color:"#9898B0", marginTop:4 }}>{t("admin_panel_desc")}</p>
        </div>

        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList style={{ background:"#F4F3F5", borderRadius:10, padding:4 }}>
            <TabsTrigger value="usuarios" className="gap-2" style={{ fontFamily:"inherit", fontWeight:600 }}>
              <Users className="h-4 w-4" />{t("admin_tab_users")}
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-2" style={{ fontFamily:"inherit", fontWeight:600 }}>
              <Settings className="h-4 w-4" />Permissões
            </TabsTrigger>
            <TabsTrigger value="conta" className="gap-2" style={{ fontFamily:"inherit", fontWeight:600 }}>
              <User className="h-4 w-4" />{t("admin_tab_account")}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: USUÁRIOS ── */}
          <TabsContent value="usuarios" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t("admin_stat_total"),  val: users.length, iconBg: "#3B82F615", iconColor: "#3B82F6",  icon: <Users  className="h-5 w-5" /> },
                { label: t("admin_stat_admins"), val: totalAdmins,  iconBg: "#F37E3815", iconColor: "#F37E38",  icon: <Shield className="h-5 w-5" /> },
                { label: t("admin_stat_common"), val: totalCommon,  iconBg: "#0E9F6E15", iconColor: "#0E9F6E",  icon: <User   className="h-5 w-5" /> },
              ].map(s => (
                <div key={s.label} style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", padding:16, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize:24, fontWeight:800, color:"#212B36", lineHeight:1.1 }}>{s.val}</div>
                    <div style={{ fontSize:11, color:"#9898B0", marginTop:2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color:"#9898B0" }} />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("admin_search_ph")} className="pl-9" />
              </div>
              <div className="flex items-center rounded-md border overflow-hidden">
                <button type="button" onClick={() => setViewMode("grid")} className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setViewMode("list")} className={`px-3 py-2 transition-colors border-l ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  <List className="h-4 w-4" />
                </button>
              </div>
              <Button size="sm" onClick={() => { setNewEmail(""); setNewPassword(""); setNewIsAdmin(false); setCreateError(""); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />{t("admin_new_user")}
              </Button>
            </div>

            {isLoadingUsers ? (
              <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color:"#F37E38" }} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20" style={{ color:"#9898B0" }}>
                <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t("admin_no_users")}</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(user => (
                  <div key={user.id} style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", overflow:"hidden" }}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 truncate" style={{ color:"#212B36" }}>
                        <User className="h-4 w-4 shrink-0" style={{ color:"#9898B0" }} />
                        <span className="truncate">{user.email}</span>
                      </CardTitle>
                      {user.is_approved ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                        {user.id === myId && <span className="text-xs font-bold" style={{ color:"#F37E38" }}>{t("admin_you")}</span>}
                      </div>
                      <div className="space-y-2" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", paddingTop:8, marginTop:8 }}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Aprovado</Label>
                          <Switch checked={user.is_approved} onCheckedChange={v => approvalMutation.mutate({ userId: user.id, isApproved: v })} disabled={approvalMutation.isPending} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Papel</Label>
                          <Select value={user.role} onValueChange={(v: AppRole) => roleMutation.mutate({ userId: user.id, role: v })} disabled={roleMutation.isPending || user.id === myId}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderador</SelectItem>
                              <SelectItem value="user">Usuário</SelectItem>
                            </SelectContent>
                          </Select>
                        {user.id === myId && <p style={{ fontSize:11, color:"#9898B0" }}>Você não pode alterar seu próprio papel</p>}
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:"#9898B0" }}>Criado em: {new Date(user.created_at).toLocaleDateString(lang)}</div>
                      {user.id !== myId && (
                        <div className="flex gap-2" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", paddingTop:8, marginTop:4 }}>
                          <Button variant="ghost" size="sm" className="h-8 text-orange-600 hover:text-orange-600 hover:bg-orange-50 flex-1" onClick={() => handleResetPassword(user.email, user.id)} title={t("admin_tooltip_reset")}>
                            <KeyRound className="h-4 w-4 mr-1" />{t("admin_reset_pwd_btn")}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => { setUserToDelete(user); setIsDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {resetFeedback[user.id] && (
                        <p className={`text-xs font-semibold ${resetFeedback[user.id].ok ? "text-emerald-600" : "text-red-600"}`}>{resetFeedback[user.id].text}</p>
                      )}
                    </CardContent>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", overflow:"hidden" }}>
                <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ background:"#F4F3F5", color:"#9898B0" }}>
                  <div className="col-span-2">{t("admin_col_email")}</div>
                  <div>{t("admin_col_profile")}</div>
                  <div>Aprovado</div>
                  <div>{t("admin_col_created")}</div>
                  <div>{t("admin_col_actions")}</div>
                </div>
                {filtered.map(user => (
                  <div key={user.id} className={`grid grid-cols-6 gap-2 px-4 py-2 text-sm items-center ${user.id === myId ? "" : ""}`} style={{ borderTop:"1px solid rgba(26,28,29,0.08)", background: user.id === myId ? "#F37E3808" : undefined }}>
                    <div className="col-span-2 flex items-center gap-2 truncate">
                      <User className="h-4 w-4 shrink-0" style={{ color:"#9898B0" }} />
                      <span className="truncate">{user.email}</span>
                      {user.id === myId && <span className="text-xs font-bold shrink-0" style={{ color:"#F37E38" }}>{t("admin_you")}</span>}
                    </div>
                    <div>
                      <Select value={user.role} onValueChange={(v: AppRole) => roleMutation.mutate({ userId: user.id, role: v })} disabled={roleMutation.isPending || user.id === myId}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="moderator">Moderador</SelectItem>
                          <SelectItem value="user">Usuário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Switch checked={user.is_approved} onCheckedChange={v => approvalMutation.mutate({ userId: user.id, isApproved: v })} disabled={approvalMutation.isPending} /></div>
                    <div style={{ fontSize:11, color:"#9898B0" }}>{new Date(user.created_at).toLocaleDateString(lang)}</div>
                    <div className="flex items-center gap-1">
                      {user.id !== myId ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 text-orange-600 hover:text-orange-600 hover:bg-orange-50" onClick={() => handleResetPassword(user.email, user.id)} title={t("admin_tooltip_reset")}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => { setUserToDelete(user); setIsDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : <div className="h-8" />}
                      {resetFeedback[user.id] && (
                        <span className={`text-xs font-semibold ${resetFeedback[user.id].ok ? "text-emerald-600" : "text-red-600"}`}>{resetFeedback[user.id].text}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: PERMISSÕES ── */}
          <TabsContent value="permissoes" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-sm">Selecionar Usuário</CardTitle></CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                  {users.map(user => (
                    <div key={user.id} onClick={() => handleSelectUserPerms(user)} className="p-3 rounded-lg border cursor-pointer transition-colors" style={selectedUserPerms?.id === user.id ? { background:"#F37E3815", borderColor:"#F37E38" } : { background:"transparent", borderColor:"rgba(26,28,29,0.1)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{user.email}</div>
                          <div className="flex items-center gap-1 mt-0.5">{getRoleIcon(user.role)}<span style={{ fontSize:11, color:"#9898B0" }}>{getRoleLabel(user.role)}</span></div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="shrink-0 text-xs">{getRoleLabel(user.role)}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm">{selectedUserPerms ? `Permissões de ${selectedUserPerms.email}` : "Selecione um usuário"}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {selectedUserPerms ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide">Presets Rápidos</Label>
                        <div className="flex gap-2 flex-wrap">
                          {(["user", "moderator", "admin"] as AppRole[]).map(role => (
                            <Button key={role} variant="outline" size="sm" className="gap-1" onClick={() => setCustomPerms(new Set(rolePresets[role]))}>
                              {getRoleIcon(role)}{getRoleLabel(role)}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase tracking-wide">Permissões Customizadas</Label>
                        <Button variant="outline" size="sm" onClick={() => { const isAll = allPermKeys.every(k => customPerms.has(k)); setCustomPerms(new Set(isAll ? [] : allPermKeys)); }}>
                          {allPermKeys.every(k => customPerms.has(k)) ? "Limpar Todas" : "Selecionar Todas"}
                        </Button>
                      </div>
                      <Accordion type="multiple" className="w-full">
                        {availablePermissions.map(cat => (
                          <AccordionItem key={cat.category} value={cat.category}>
                            <AccordionTrigger className="text-sm">{cat.category}</AccordionTrigger>
                            <AccordionContent className="space-y-2 pt-2">
                              {cat.permissions.map(perm => (
                                <div key={perm.key} className="flex items-start gap-3 p-2 rounded" style={{ cursor:"default" }}>
                                  <Checkbox id={perm.key} checked={customPerms.has(perm.key)} onCheckedChange={() => { setCustomPerms(prev => { const n = new Set(prev); n.has(perm.key) ? n.delete(perm.key) : n.add(perm.key); return n; }); }} />
                                  <div>
                                    <label htmlFor={perm.key} className="text-sm font-medium cursor-pointer">{perm.label}</label>
                                    <p style={{ fontSize:11, color:"#9898B0" }}>{perm.description}</p>
                                  </div>
                                </div>
                              ))}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      <div className="flex items-center justify-between pt-4" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", marginTop:4 }}>
                        <span style={{ fontSize:11, color:"#9898B0" }}>{customPerms.size} permissões selecionadas</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { const src = (selectedUserPerms.custom_permissions && selectedUserPerms.custom_permissions.length > 0) ? selectedUserPerms.custom_permissions : rolePresets[selectedUserPerms.role] ?? []; setCustomPerms(new Set(src)); }}>Resetar</Button>
                          <Button size="sm" disabled={permsMutation.isPending} onClick={() => permsMutation.mutate({ userId: selectedUserPerms.id, perms: Array.from(customPerms) })}>
                            {permsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Salvar Permissões
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16" style={{ color:"#9898B0" }}>
                      <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p style={{ fontSize:11, color:"#9898B0" }}>
                          Selecione um usuário para gerenciar permissões
                        </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB: MINHA CONTA ── */}
          <TabsContent value="conta">
            <div className="max-w-md">
              <Card>
                <div className="bg-gradient-to-r from-slate-900 to-slate-700 p-5 flex items-center gap-3 rounded-t-lg" style={{ background:"linear-gradient(135deg, #212B36, #2E3B4A)" }}>
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">{myEmail}</div>
                    <Badge className="mt-1 text-xs bg-purple-600/30 text-purple-300 border-purple-600/50">
                      <Shield className="h-3 w-3 mr-1" />{t("admin_role_badge")}
                    </Badge>
                  </div>
                </div>
                <CardContent className="pt-6">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="font-semibold mb-2" style={{ color:"#212B36" }}>{t("admin_change_pwd")}</div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide">{t("admin_new_pwd_label")}</Label>
                      <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={t("admin_pwd_ph_min6")} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide">{t("admin_confirm_pwd_label")}</Label>
                      <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder={t("admin_confirm_ph")} required />
                    </div>
                    {passMsg && (
                      <div className={`rounded-md p-3 text-sm font-medium ${passMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{passMsg.text}</div>
                    )}
                    <Button type="submit" className="w-full" disabled={passLoading}>
                      {passLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {passLoading ? t("admin_saving") : t("admin_save_pwd")}
                    </Button>
                  </form>

                  {/* ── Seção MFA ── */}
                  <div className="mt-8 pt-6 space-y-4" style={{ borderTop:"1px solid rgba(26,28,29,0.08)" }}>
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" style={{ color:"#9898B0" }} />
                      <span className="font-semibold text-sm" style={{ color:"#212B36" }}>
                        {lang === "pt-BR" ? "Autenticação em duas etapas (TOTP)" : "Two-factor authentication (TOTP)"}
                      </span>
                      {mfaFactors.length > 0 && (
                        <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                          {lang === "pt-BR" ? "Ativo" : "Active"}
                        </Badge>
                      )}
                    </div>

                    {mfaMsg && (
                      <div className={`rounded-md p-3 text-sm font-medium ${mfaMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {mfaMsg.text}
                      </div>
                    )}

                    {mfaFactors.length > 0 ? (
                      <div className="space-y-3">
                        <p style={{ fontSize:11, color:"#9898B0" }}>
                          {lang === "pt-BR"
                            ? "Seu aplicativo autenticador está configurado. Cada login exigirá um código TOTP."
                            : "Your authenticator app is configured. Each login will require a TOTP code."}
                        </p>
                        {mfaFactors.map(f => (
                          <Button
                            key={f.id}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            disabled={mfaLoading}
                            onClick={() => handleMfaUnenroll(f.id)}
                          >
                            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                            {lang === "pt-BR" ? "Desativar MFA" : "Disable MFA"}
                          </Button>
                        ))}
                      </div>
                    ) : mfaEnrollStep === "idle" ? (
                      <div className="space-y-3">
                        <p style={{ fontSize:11, color:"#9898B0" }}>
                          {lang === "pt-BR"
                            ? "Use um aplicativo como Google Authenticator ou Authy para proteger sua conta."
                            : "Use an app like Google Authenticator or Authy to protect your account."}
                        </p>
                        <Button variant="outline" size="sm" className="w-full" onClick={handleMfaEnroll} disabled={mfaLoading}>
                          {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                          {lang === "pt-BR" ? "Configurar MFA" : "Set up MFA"}
                        </Button>
                      </div>
                    ) : mfaEnrollStep === "qr" ? (
                      <div className="space-y-4">
                        <p style={{ fontSize:11, color:"#9898B0" }}>
                          {lang === "pt-BR"
                            ? "1. Escaneie o QR code com seu aplicativo autenticador."
                            : "1. Scan the QR code with your authenticator app."}
                        </p>
                        <div className="flex justify-center">
                        <img src={mfaQrCode} alt="QR Code MFA" className="w-48 h-48 rounded-lg p-1" style={{ border:"1px solid #E8E8EA" }} />
                        </div>
                        <details style={{ fontSize:11, color:"#9898B0" }}>
                          <summary className="cursor-pointer">{lang === "pt-BR" ? "Não consegue escanear? Ver chave manual" : "Can't scan? Show manual key"}</summary>
                          <code className="block mt-1 break-all p-2 rounded select-all" style={{ background:"#F4F3F5", color:"#212B36", fontSize:11 }}>{mfaSecret}</code>
                        </details>
                        <p style={{ fontSize:11, color:"#9898B0" }}>
                          {lang === "pt-BR"
                            ? "2. Digite o código de 6 dígitos gerado pelo app para confirmar:"
                            : "2. Enter the 6-digit code from your app to confirm:"}
                        </p>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="000000"
                          value={mfaCode}
                          onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="text-center text-lg tracking-widest font-mono"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setMfaEnrollStep("idle"); setMfaMsg(null); setMfaCode(""); }}>
                            {lang === "pt-BR" ? "Cancelar" : "Cancel"}
                          </Button>
                          <Button size="sm" className="flex-1" disabled={mfaLoading || mfaCode.length !== 6} onClick={handleMfaVerifyEnroll}>
                            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {lang === "pt-BR" ? "Confirmar" : "Confirm"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* AlertDialog: Excluir */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão de Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{userToDelete?.email}</strong>?<br /><br />
              Esta ação é <strong className="text-red-600">permanente</strong> e removerá o usuário do sistema de autenticação e todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : <><Trash2 className="h-4 w-4 mr-2" />Excluir Usuário</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Criar usuário */}
      <AlertDialog open={isCreateOpen} onOpenChange={v => { if (!createMutation.isPending) setIsCreateOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_modal_new")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("admin_modal_email_label")}</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@email.com" autoFocus autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin_modal_pwd_label")}</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("admin_modal_pwd_ph")} autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setNewIsAdmin(v => !v)}>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${newIsAdmin ? "bg-purple-600" : "bg-slate-200"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${newIsAdmin ? "left-5" : "left-1"}`} />
              </div>
              <span className="text-sm font-medium">{t("admin_modal_admin_toggle")}</span>
            </div>
            {createError && <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600">{createError}</div>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMutation.isPending}>{t("admin_modal_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!newEmail.trim()) { setCreateError(t("admin_err_email_required")); return; }
                if (newPassword.length < 6) { setCreateError(t("admin_err_pwd_short")); return; }
                createMutation.mutate({ email: newEmail.trim(), password: newPassword, is_admin: newIsAdmin });
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin_saving")}</> : t("admin_create_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
