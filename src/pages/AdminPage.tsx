import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { mapSupabaseError } from "@/lib/i18n-translations";

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

type Tab = "usuarios" | "conta";
type ModalMode = "create" | "edit" | "delete" | null;

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function AdminPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [loading, setLoading]     = useState(true);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [myEmail, setMyEmail]     = useState("");
  const [myId, setMyId]           = useState("");
  const [users, setUsers]         = useState<Profile[]>([]);
  const [tab, setTab]             = useState<Tab>("usuarios");
  const [search, setSearch]       = useState("");

  // Change password
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  // Per-user feedback
  const [resetFeedback, setResetFeedback]   = useState<Record<string, { text: string; ok: boolean }>>({});
  const [toggleLoading, setToggleLoading]   = useState<string | null>(null);

  // User CRUD modal
  const [modal, setModal]               = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser]  = useState<Profile | null>(null);
  const [formEmail, setFormEmail]        = useState("");
  const [formPassword, setFormPassword]  = useState("");
  const [formIsAdmin, setFormIsAdmin]    = useState(false);
  const [modalLoading, setModalLoading]  = useState(false);
  const [modalError, setModalError]      = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    setMyId(session.user.id);
    setMyEmail(session.user.email ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.is_admin) {
      setIsAdmin(true);
      const { data: all } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      setUsers(all ?? []);
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleAdmin = async (user: Profile) => {
    if (user.id === myId) return; // não pode remover próprio admin
    setToggleLoading(user.id);
    await supabase.from("profiles").update({ is_admin: !user.is_admin }).eq("id", user.id);
    await loadData();
    setToggleLoading(null);
  };

  const handleResetPassword = async (email: string, userId: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    const msg = error ? `${t("admin_err_reset")} ${error.message}` : t("admin_email_sent");
    setResetFeedback(p => ({ ...p, [userId]: { text: msg, ok: !error } }));
    setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
  };

  // ── Edge Function helper ─────────────────────────────────────────
  const callAdminFn = async (action: string, params: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action, ...params },
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const openCreate = () => {
    setFormEmail(""); setFormPassword(""); setFormIsAdmin(false);
    setModalError(""); setModal("create");
  };

  const openEdit = (user: Profile) => {
    setSelectedUser(user); setFormEmail(user.email); setFormPassword("");
    setModalError(""); setModal("edit");
  };

  const openDelete = (user: Profile) => {
    setSelectedUser(user); setModalError(""); setModal("delete");
  };

  const handleCreateUser = async () => {
    if (!formEmail.trim()) { setModalError(t("admin_err_email_required")); return; }
    if (formPassword.length < 6) { setModalError(t("admin_err_pwd_short")); return; }
    setModalLoading(true); setModalError("");
    try {
      await callAdminFn("create", { email: formEmail.trim(), password: formPassword, is_admin: formIsAdmin });
      await loadData();
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t("admin_err_generic_create"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    if (!formEmail.trim()) { setModalError(t("admin_err_email_required")); return; }
    if (formPassword && formPassword.length < 6) { setModalError(t("admin_err_pwd_short")); return; }
    setModalLoading(true); setModalError("");
    try {
      await callAdminFn("update", {
        userId: selectedUser.id,
        email: formEmail.trim(),
        ...(formPassword ? { password: formPassword } : {}),
      });
      await loadData();
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t("admin_err_generic_edit"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setModalLoading(true); setModalError("");
    try {
      await callAdminFn("delete", { userId: selectedUser.id });
      await loadData();
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t("admin_err_generic_delete"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg({ ok: false, text: t("admin_pass_mismatch") }); return; }
    if (newPass.length < 6) { setPassMsg({ ok: false, text: t("admin_pass_short") }); return; }
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

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');`}</style>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  // ── Acesso negado ────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, background: "#FEF2F2", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#E02424" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1C2E" }}>{t("admin_access_denied")}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>{t("admin_access_denied_desc")}</div>
          <button onClick={() => navigate("/")} style={{ background: "#1A56DB", border: "none", borderRadius: 10, padding: "11px 24px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
            {t("admin_back_home")}
          </button>
        </div>
      </div>
    );
  }

  // ── Página Admin ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px #1A56DB1A!important;outline:none!important}
        button{transition:all .15s} button:hover:not(:disabled){opacity:.88}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#F1F5F9}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
        @media(max-width:900px){.rsp-grid-3{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:640px){
          .rsp-grid-4,.rsp-grid-3,.rsp-grid-2{grid-template-columns:1fr!important}
          .rsp-main-admin{padding:12px!important}
          .rsp-admin-header{flex-wrap:wrap;height:auto!important;padding:8px 12px!important;gap:8px!important}
          .rsp-admin-header-right{flex-wrap:wrap;gap:6px!important}
        }
      `}</style>

      {/* Header */}
      <header className="rsp-admin-header" style={{ background: "#0B1628", borderBottom: "1px solid #1E293B", height: 58, display: "flex", alignItems: "center", padding: "0 24px", gap: 0, position: "sticky", top: 0, zIndex: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 24, borderRight: "1px solid #1E293B", marginRight: 20 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#1A56DB,#3B82F6)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" size={18} />
          </div>
          <div>
            <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 13, letterSpacing: -.4, lineHeight: 1.1 }}>Controle de</div>
            <div style={{ color: "#3B82F6", fontWeight: 800, fontSize: 13, letterSpacing: -.4, lineHeight: 1.1 }}>Terceiros</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#F8FAFC" }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#F8FAFC" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {t("admin_header_badge")}
        </div>

        <div style={{ flex: 1 }} />

        <div className="rsp-admin-header-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>{myEmail}</div>
          <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1E293B", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
              <Icon d="M15 18l-6-6 6-6" size={12} /> {t("admin_back_app")}
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1E293B", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={12} /> {t("admin_logout")}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="rsp-main-admin" style={{ flex: 1, padding: "28px 24px", maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{t("admin_section_sys")}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1C2E" }}>{t("admin_panel_title")}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{t("admin_panel_desc")}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#E2E8F0", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {([
            ["usuarios", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"],
            ["conta",    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
          ] as const).map(([id, icon]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 13,
              background: tab === id ? "#fff" : "transparent",
              color: tab === id ? "#0F1C2E" : "#64748B",
              boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            }}>
              <Icon d={icon} size={14} />{id === "usuarios" ? t("admin_tab_users") : t("admin_tab_account")}
            </button>
          ))}
        </div>

        {/* ── TAB: USUÁRIOS ── */}
        {tab === "usuarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stats */}
            <div className="rsp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                [t("admin_stat_total"),   users.length,                          "#1A56DB", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
                [t("admin_stat_admins"), users.filter(u => u.is_admin).length,   "#6C63FF", "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
                [t("admin_stat_common"), users.filter(u => !u.is_admin).length,  "#0E9F6E", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
              ].map(([label, val, color, icon]) => (
                <div key={label as string} style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, background: `${color}15`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={icon as string} /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1C2E" }}>{val as number}</div>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label as string}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E6EC", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0F1C2E", flex: 1 }}>{t("admin_users_title")}</div>
                <div style={{ position: "relative" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("admin_search_ph")}
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "7px 12px 7px 30px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", width: 220, outline: "none" }} />
                </div>
                <button
                  onClick={openCreate}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#1A56DB", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  {t("admin_new_user")}
                </button>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", fontSize: 13, color: "#94A3B8" }}>{t("admin_no_users")}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {[t("admin_col_email"), t("admin_col_profile"), t("admin_col_created"), t("admin_col_actions")].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 20px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: .7, borderBottom: "1px solid #E2E6EC" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user, i) => (
                      <tr key={user.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F1F5F9" : "none", background: user.id === myId ? "#F0F7FF" : "#fff" }}>
                        <td style={{ padding: "12px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: user.is_admin ? "#6C63FF18" : "#1A56DB12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={user.is_admin ? "#6C63FF" : "#1A56DB"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                              </svg>
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F1C2E" }}>{user.email}</div>
                              {user.id === myId && <div style={{ fontSize: 10, color: "#1A56DB", fontWeight: 700 }}>{t("admin_you")}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                            background: user.is_admin ? "#6C63FF18" : "#F1F5F9",
                            color: user.is_admin ? "#6C63FF" : "#64748B",
                          }}>
                            {user.is_admin ? (
                              <><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>{t("admin_role_admin")}</>
                            ) : t("admin_role_user")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono',monospace" }}>
                          {new Date(user.created_at).toLocaleDateString(lang)}
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {/* Toggle admin */}
                            <button
                              onClick={() => handleToggleAdmin(user)}
                              disabled={user.id === myId || toggleLoading === user.id}
                              title={user.id === myId ? t("admin_tooltip_self") : user.is_admin ? t("admin_tooltip_revoke") : t("admin_tooltip_promote")}
                              style={{
                                display: "flex", alignItems: "center", gap: 5,
                                background: user.is_admin ? "#FEF2F2" : "#F0F7FF",
                                border: `1.5px solid ${user.is_admin ? "#FECACA" : "#BFDBFE"}`,
                                borderRadius: 7, padding: "5px 10px", cursor: user.id === myId ? "not-allowed" : "pointer",
                                fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                                color: user.is_admin ? "#E02424" : "#1A56DB",
                                opacity: user.id === myId ? .4 : 1,
                              }}
                            >
                              {toggleLoading === user.id ? (
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                              ) : (
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d={user.is_admin ? "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" : "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"} />
                                </svg>
                              )}
                              {user.is_admin ? t("admin_revoke_admin") : t("admin_make_admin")}
                            </button>

                            {/* Reset password */}
                            <button
                              onClick={() => handleResetPassword(user.email, user.id)}
                              title={t("admin_tooltip_reset")}
                              style={{ display: "flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", color: "#475569" }}
                            >
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                              {t("admin_reset_pwd_btn")}
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => openEdit(user)}
                              title="Editar usuário"
                              style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 7, cursor: "pointer", color: "#0E9F6E", flexShrink: 0 }}
                            >
                              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>

                            {/* Delete */}
                            {user.id !== myId && (
                              <button
                                onClick={() => openDelete(user)}
                                title="Excluir usuário"
                                style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 7, cursor: "pointer", color: "#E02424", flexShrink: 0 }}
                              >
                                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            )}

                            {resetFeedback[user.id] && (
                              <span style={{ fontSize: 11, color: resetFeedback[user.id].ok ? "#0E9F6E" : "#E02424", fontWeight: 600 }}>
                                {resetFeedback[user.id].text}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: MINHA CONTA ── */}
        {tab === "conta" && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg,#0B1628,#1A2C4A)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, background: "#1A56DB", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                </div>
                <div>
                  <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 15 }}>{myEmail}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#6C63FF20", borderRadius: 99, padding: "2px 8px", marginTop: 4 }}>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <span style={{ color: "#6C63FF", fontSize: 11, fontWeight: 700 }}>{t("admin_role_badge")}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleChangePassword} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F1C2E", marginBottom: -4 }}>{t("admin_change_pwd")}</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("admin_new_pwd_label")}</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={t("admin_pwd_ph_min6")} required
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("admin_confirm_pwd_label")}</label>
                  <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder={t("admin_confirm_ph")} required
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
                </div>

                {passMsg && (
                  <div style={{ background: passMsg.ok ? "#E6F9F4" : "#FEF2F2", border: `1px solid ${passMsg.ok ? "#6EE7B7" : "#FECACA"}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: passMsg.ok ? "#065F46" : "#E02424", fontWeight: 600 }}>
                    {passMsg.text}
                  </div>
                )}

                <button type="submit" disabled={passLoading}
                  style={{ background: passLoading ? "#93AEDE" : "#1A56DB", border: "none", borderRadius: 9, padding: "11px", cursor: passLoading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {passLoading ? t("admin_saving") : t("admin_save_pwd")}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL CRUD ────────────────────────────────────────────── */}
      {modal && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !modalLoading) setModal(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0F1C2E" }}>
                {modal === "create" ? t("admin_modal_new") : modal === "edit" ? t("admin_modal_edit") : t("admin_modal_delete")}
              </div>
              <button onClick={() => !modalLoading && setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex", alignItems: "center" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Delete confirmation */}
            {modal === "delete" && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "#991B1B" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("admin_delete_warning")}</div>
                <div>{t("admin_delete_desc").replace("{email}", selectedUser?.email ?? "")}</div>
              </div>
            )}

            {/* Create / Edit form */}
            {(modal === "create" || modal === "edit") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: .7, marginBottom: 5 }}>{t("admin_modal_email_label")}</label>
                  <input
                    type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                    placeholder="usuario@email.com" autoFocus autoComplete="off"
                    style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: .7, marginBottom: 5 }}>
                    {modal === "create" ? t("admin_modal_pwd_label") : t("admin_modal_pwd_label_edit")}
                  </label>
                  <input
                    type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)}
                    placeholder={modal === "create" ? t("admin_modal_pwd_ph") : t("admin_modal_pwd_ph_edit")}
                    autoComplete="new-password"
                    style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", boxSizing: "border-box" }}
                  />
                </div>
                {modal === "create" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setFormIsAdmin(v => !v)}>
                    <div style={{ width: 40, height: 22, borderRadius: 11, background: formIsAdmin ? "#6C63FF" : "#E2E6EC", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 3, left: formIsAdmin ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F1C2E", userSelect: "none" }}>{t("admin_modal_admin_toggle")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {modalError && (
              <div style={{ marginTop: 14, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 14px", fontSize: 12, color: "#E02424", fontWeight: 600 }}>
                {modalError}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={() => !modalLoading && setModal(null)}
                disabled={modalLoading}
                style={{ background: "#F1F5F9", border: "1.5px solid #E2E6EC", borderRadius: 9, padding: "9px 20px", cursor: modalLoading ? "not-allowed" : "pointer", color: "#475569", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
              >
                {t("admin_modal_cancel")}
              </button>
              {modal === "delete" ? (
                <button
                  onClick={handleDeleteUser}
                  disabled={modalLoading}
                  style={{ background: modalLoading ? "#FCA5A5" : "#E02424", border: "none", borderRadius: 9, padding: "9px 20px", cursor: modalLoading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {modalLoading && <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                  {modalLoading ? t("admin_deleting") : t("admin_delete_btn")}
                </button>
              ) : (
                <button
                  onClick={modal === "create" ? handleCreateUser : handleEditUser}
                  disabled={modalLoading}
                  style={{ background: modalLoading ? "#93AEDE" : "#1A56DB", border: "none", borderRadius: 9, padding: "9px 20px", cursor: modalLoading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {modalLoading && <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                  {modalLoading ? t("admin_saving") : modal === "create" ? t("admin_create_btn") : t("admin_save_changes")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
