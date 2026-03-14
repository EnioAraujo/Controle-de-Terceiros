import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

type Tab = "usuarios" | "conta";

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function AdminPage() {
  const navigate = useNavigate();
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
  const [resetFeedback, setResetFeedback]   = useState<Record<string, string>>({});
  const [toggleLoading, setToggleLoading]   = useState<string | null>(null);

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
    const msg = error ? `Erro: ${error.message}` : "E-mail de redefinição enviado!";
    setResetFeedback(p => ({ ...p, [userId]: msg }));
    setTimeout(() => setResetFeedback(p => { const n = { ...p }; delete n[userId]; return n; }), 5000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg({ ok: false, text: "As senhas não coincidem." }); return; }
    if (newPass.length < 6) { setPassMsg({ ok: false, text: "Mínimo de 6 caracteres." }); return; }
    setPassLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setPassLoading(false);
    if (error) {
      setPassMsg({ ok: false, text: `Erro: ${error.message}` });
    } else {
      setPassMsg({ ok: true, text: "Senha alterada com sucesso!" });
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
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1C2E", marginBottom: 8 }}>Acesso Negado</div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>Você não tem permissão de administrador para acessar esta página.</div>
          <button onClick={() => navigate("/")} style={{ background: "#1A56DB", border: "none", borderRadius: 10, padding: "11px 24px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}>
            Voltar ao início
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
      `}</style>

      {/* Header */}
      <header style={{ background: "#0B1628", borderBottom: "1px solid #1E293B", height: 58, display: "flex", alignItems: "center", padding: "0 24px", gap: 0, position: "sticky", top: 0, zIndex: 200 }}>
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
          Administração
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>{myEmail}</div>
          <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1E293B", borderRadius: 8, padding: "4px 12px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
            <Icon d="M15 18l-6-6 6-6" size={12} /> Voltar ao app
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1E293B", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={12} /> Sair
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: "28px 24px", maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Sistema</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F1C2E" }}>Painel de Administração</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Gerencie usuários, permissões e configurações de conta.</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#E2E8F0", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {([["usuarios", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", "Usuários"], ["conta", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "Minha Conta"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 13,
              background: tab === id ? "#fff" : "transparent",
              color: tab === id ? "#0F1C2E" : "#64748B",
              boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            }}>
              <Icon d={icon} size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── TAB: USUÁRIOS ── */}
        {tab === "usuarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                ["Total de usuários", users.length, "#1A56DB", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
                ["Administradores", users.filter(u => u.is_admin).length, "#6C63FF", "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
                ["Usuários comuns", users.filter(u => !u.is_admin).length, "#0E9F6E", "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
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
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0F1C2E", flex: 1 }}>Usuários cadastrados</div>
                <div style={{ position: "relative" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por e-mail…"
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "7px 12px 7px 30px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", width: 220, outline: "none" }} />
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                  Para criar novos usuários: <span style={{ color: "#1A56DB" }}>Supabase Dashboard → Authentication → Users → Add User</span>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", fontSize: 13, color: "#94A3B8" }}>Nenhum usuário encontrado.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["E-mail", "Perfil", "Cadastrado em", "Ações"].map(h => (
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
                              {user.id === myId && <div style={{ fontSize: 10, color: "#1A56DB", fontWeight: 700 }}>você</div>}
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
                              <><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>Admin</>
                            ) : "Usuário"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono',monospace" }}>
                          {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Toggle admin */}
                            <button
                              onClick={() => handleToggleAdmin(user)}
                              disabled={user.id === myId || toggleLoading === user.id}
                              title={user.id === myId ? "Você não pode alterar seu próprio perfil" : user.is_admin ? "Revogar admin" : "Promover a admin"}
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
                              {user.is_admin ? "Revogar admin" : "Tornar admin"}
                            </button>

                            {/* Reset password */}
                            <button
                              onClick={() => handleResetPassword(user.email, user.id)}
                              title="Enviar e-mail de redefinição de senha"
                              style={{ display: "flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", color: "#475569" }}
                            >
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                              Redefinir senha
                            </button>

                            {resetFeedback[user.id] && (
                              <span style={{ fontSize: 11, color: resetFeedback[user.id].startsWith("Erro") ? "#E02424" : "#0E9F6E", fontWeight: 600 }}>
                                {resetFeedback[user.id]}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    <span style={{ color: "#6C63FF", fontSize: 11, fontWeight: 700 }}>Administrador</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleChangePassword} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F1C2E", marginBottom: -4 }}>Alterar senha</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>Nova senha</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" required
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>Confirmar nova senha</label>
                  <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repita a senha" required
                    style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
                </div>

                {passMsg && (
                  <div style={{ background: passMsg.ok ? "#E6F9F4" : "#FEF2F2", border: `1px solid ${passMsg.ok ? "#6EE7B7" : "#FECACA"}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: passMsg.ok ? "#065F46" : "#E02424", fontWeight: 600 }}>
                    {passMsg.text}
                  </div>
                )}

                <button type="submit" disabled={passLoading}
                  style={{ background: passLoading ? "#93AEDE" : "#1A56DB", border: "none", borderRadius: 9, padding: "11px", cursor: passLoading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {passLoading ? "Salvando…" : "Salvar nova senha"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
