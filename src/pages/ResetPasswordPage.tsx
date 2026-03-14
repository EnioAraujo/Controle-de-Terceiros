import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { mapSupabaseError } from "@/lib/i18n-translations";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null);
  const [hasSession, setHasSession]   = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      if (!session) timerRef.current = setTimeout(() => navigate("/login", { replace: true }), 3000);
    });
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setMsg({ ok: false, text: t("reset_err_mismatch") }); return; }
    if (newPass.length < 6)     { setMsg({ ok: false, text: t("reset_err_short") }); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);

    if (error) {
      setMsg({ ok: false, text: mapSupabaseError(error.message, lang) });
    } else {
      setMsg({ ok: true, text: t("reset_success") });
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    }
  };

  if (hasSession === null) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>{t("reset_checking")}</div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#E02424", fontWeight: 600 }}>{t("reset_invalid_link")}</div>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 8 }}>{t("reset_redirecting")}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}input:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px #1A56DB1A!important;outline:none!important}`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#1A56DB,#3B82F6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -.5, color: "#0F1C2E", lineHeight: 1.1 }}>Controle de</div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -.5, color: "#1A56DB", lineHeight: 1.1 }}>Terceiros</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#0B1628,#1A2C4A)", padding: "24px 28px" }}>
            <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>{t("reset_title")}</div>
            <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>{t("reset_subtitle")}</div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("reset_label_new")}</label>
              <input
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder={t("reset_placeholder_new")}
                required
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 9, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFBFC" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("reset_label_confirm")}</label>
              <input
                type="password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder={t("reset_placeholder_confirm")}
                required
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 9, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFBFC" }}
              />
            </div>

            {msg && (
              <div style={{
                background: msg.ok ? "#E6F9F4" : "#FEF2F2",
                border: `1px solid ${msg.ok ? "#6EE7B7" : "#FECACA"}`,
                borderRadius: 8, padding: "10px 14px", fontSize: 13,
                color: msg.ok ? "#065F46" : "#E02424", fontWeight: 600,
              }}>
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#93AEDE" : "#1A56DB",
                border: "none", borderRadius: 10, padding: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "inherit",
              }}
            >
              {loading ? t("reset_btn_loading") : t("reset_btn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
