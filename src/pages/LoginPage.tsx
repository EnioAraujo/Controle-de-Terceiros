import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import type { Lang } from "@/lib/i18n-translations";
import { mapSupabaseError } from "@/lib/i18n-translations";

const LANGS: { value: Lang; label: string; flag: string }[] = [
  { value: "pt-BR", label: "Português", flag: "🇧🇷" },
  { value: "en-US", label: "English",   flag: "🇺🇸" },
];

export default function LoginPage() {
  const { lang, setLang, t } = useI18n();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErro(mapSupabaseError(error.message, lang));
    }
    // Se ok: App.tsx detecta a sessão via onAuthStateChange e renderiza o Index
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F0F2F5",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}input:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px #1A56DB1A!important;outline:none!important}`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Seletor de idioma */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 6 }}>
          {LANGS.map(l => (
            <button
              key={l.value}
              onClick={() => setLang(l.value)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontWeight: 600, fontSize: 12,
                border: lang === l.value ? "1.5px solid #1A56DB" : "1.5px solid #E2E6EC",
                background: lang === l.value ? "#EFF6FF" : "#fff",
                color: lang === l.value ? "#1A56DB" : "#64748B",
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>

        {/* Logotipo */}
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

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#0B1628,#1A2C4A)", padding: "24px 28px" }}>
            <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>{t("login_title")}</div>
            <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>{t("login_subtitle")}</div>
          </div>

          <form onSubmit={handleLogin} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="email" style={{ fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: .7 }}>
                {t("login_email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("login_placeholder_email")}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFBFC" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="password" style={{ fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: .7 }}>
                {t("login_password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("login_placeholder_pass")}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFBFC" }}
              />
            </div>

            {erro && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E02424", fontWeight: 500 }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "#93AEDE" : "#1A56DB",
                border: "none", borderRadius: 10, padding: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                color: "#fff", fontWeight: 700, fontSize: 14,
                fontFamily: "inherit", transition: "all .15s",
              }}
            >
              {loading ? t("login_btn_loading") : t("login_btn")}
            </button>

            <div style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: -4 }}>
              {t("login_no_account")}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
