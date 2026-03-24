import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import type { Lang } from "@/lib/i18n-translations";
import { mapSupabaseError } from "@/lib/i18n-translations";

const LANGS: { value: Lang; label: string; code: string }[] = [
  { value: "pt-BR", label: "Português", code: "BR" },
  { value: "en-US", label: "English",   code: "US" },
];

type Step = "login" | "mfa";

export default function LoginPage() {
  const { lang, setLang, t } = useI18n();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");

  // MFA challenge state
  const [step, setStep]             = useState<Step>("login");
  const [mfaCode, setMfaCode]       = useState("");
  const [factorId, setFactorId]     = useState("");
  const [challengeId, setChallengeId] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErro(mapSupabaseError(error.message, lang));
      return;
    }

    // Verificar se MFA é necessário
    const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) { console.error("Erro ao verificar nível MFA:", aalErr.message); setLoading(false); return; }
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      // Usuário tem TOTP inscrito — iniciar challenge
      const { data: factors, error: factErr } = await supabase.auth.mfa.listFactors();
      if (factErr) { console.error("Erro ao listar fatores MFA:", factErr.message); setLoading(false); return; }
      const totpFactor = factors?.totp?.[0];
      if (totpFactor) {
        const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        if (chalErr || !challenge) {
          setErro(lang === "pt-BR" ? "Erro ao iniciar verificação MFA." : "Error starting MFA challenge.");
          setLoading(false);
          return;
        }
        setFactorId(totpFactor.id);
        setChallengeId(challenge.id);
        setStep("mfa");
      }
    }
    // Se AAL1 (sem MFA ou já verificado): App.tsx detecta sessão via onAuthStateChange
    setLoading(false);
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: mfaCode.replace(/\s/g, ""),
    });
    setLoading(false);

    if (error) {
      setErro(lang === "pt-BR" ? "Código inválido. Tente novamente." : "Invalid code. Please try again.");
      setMfaCode("");
      return;
    }
    // App.tsx detecta o upgrade para AAL2 via onAuthStateChange
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

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
              <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: .5 }}>{l.code}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#0B1628,#1A2C4A)", padding: "24px 28px" }}>
            <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>{step === "mfa" ? (lang === "pt-BR" ? "Verificação em duas etapas" : "Two-step verification") : t("login_title")}</div>
            <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>{step === "mfa" ? (lang === "pt-BR" ? "Digite o código do seu aplicativo autenticador" : "Enter the code from your authenticator app") : t("login_subtitle")}</div>
          </div>

          {step === "mfa" ? (
            <form onSubmit={handleMfaVerify} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="mfa-code" style={{ fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: .7 }}>
                  {lang === "pt-BR" ? "Código TOTP (6 dígitos)" : "TOTP Code (6 digits)"}
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "10px 14px", fontSize: 22, fontFamily: "monospace", letterSpacing: 6, textAlign: "center", background: "#FAFBFC" }}
                />
              </div>

              {erro && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E02424", fontWeight: 500 }}>
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                style={{
                  background: (loading || mfaCode.length !== 6) ? "#93AEDE" : "#1A56DB",
                  border: "none", borderRadius: 10, padding: "13px",
                  cursor: (loading || mfaCode.length !== 6) ? "not-allowed" : "pointer",
                  color: "#fff", fontWeight: 700, fontSize: 14,
                  fontFamily: "inherit", transition: "all .15s",
                }}
              >
                {loading ? (lang === "pt-BR" ? "Verificando…" : "Verifying…") : (lang === "pt-BR" ? "Verificar" : "Verify")}
              </button>

              <button
                type="button"
                onClick={() => { setStep("login"); setErro(""); setMfaCode(""); }}
                style={{ background: "none", border: "none", color: "#64748B", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
              >
                {lang === "pt-BR" ? "← Voltar ao login" : "← Back to login"}
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="rsp-auth-card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>
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
          )}
        </div>
      </div>
    </div>
  );
}
