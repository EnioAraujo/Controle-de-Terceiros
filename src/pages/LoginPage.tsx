import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import type { Lang } from "@/lib/i18n-translations";
import { mapSupabaseError } from "@/lib/i18n-translations";

const LANGS: { value: Lang; label: string; code: string }[] = [
  { value: "pt-BR", label: "Português", code: "BR" },
  { value: "en-US", label: "English",   code: "US" },
];

type Step = "login" | "mfa";
type DeviceChoice = "mobile" | "desktop" | null;

export default function LoginPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [deviceChoice, setDeviceChoice] = useState<DeviceChoice>(null);

  // MFA challenge state
  const [step, setStep]             = useState<Step>("login");
  const [mfaCode, setMfaCode]       = useState("");
  const [factorId, setFactorId]     = useState("");
  const [challengeId, setChallengeId] = useState("");

  const chooseDevice = (choice: "mobile" | "desktop") => {
    sessionStorage.setItem("deviceMode", choice);
    setDeviceChoice(choice);
  };

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

    // Verificar fatores MFA do usuário
    const { data: factors, error: factErr } = await supabase.auth.mfa.listFactors();
    if (factErr) { console.error("Erro ao listar fatores MFA:", factErr.message); setLoading(false); return; }

    // Fator TOTP já verificado (enrollment completo)
    const verifiedTotp = factors?.totp?.find(f => f.factor_type === "totp" && f.status === "verified");

    if (verifiedTotp) {
      // Usuário tem MFA ativo — verificar se a sessão atual ainda é AAL1
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") {
        // Sessão AAL1: exigir código TOTP antes de prosseguir
        const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });
        if (chalErr || !challenge) {
          setErro(lang === "pt-BR" ? "Erro ao iniciar verificação MFA." : "Error starting MFA challenge.");
          setLoading(false);
          return;
        }
        setFactorId(verifiedTotp.id);
        setChallengeId(challenge.id);
        setStep("mfa");
        setLoading(false);
        return;
      }
    } else {
      // Usuário sem TOTP verificado — redirecionar para setup
      navigate("/mfa-setup", { replace: true });
      setLoading(false);
      return;
    }

    // Sessão já é AAL2: App.tsx detecta via onAuthStateChange
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
      background: "#FAF9FB",
      fontFamily: "'DM Sans',system-ui,sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* ─── Seleção de Dispositivo ─── */}
        {deviceChoice === null ? (
          <>
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
                    border: lang === l.value ? "1.5px solid #F37E38" : "1.5px solid #E8E8EA",
                    background: lang === l.value ? "#FFF4EC" : "#fff",
                    color: lang === l.value ? "#F37E38" : "#9898B0",
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: .5 }}>{l.code}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg,#212B36,#2E3B4A)", padding: "24px 28px" }}>
                <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>
                  {lang === "pt-BR" ? "Controle de Terceiros" : "Third-party Control"}
                </div>
                <div style={{ color: "#9898B0", fontSize: 13, marginTop: 4 }}>
                  {lang === "pt-BR" ? "Como você vai acessar hoje?" : "How will you access today?"}
                </div>
              </div>

              {/* Cards de escolha */}
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 14 }}>

                  {/* Card Mobile */}
                  <button
                    onClick={() => chooseDevice("mobile")}
                    style={{
                      flex: 1,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 8, padding: "22px 12px",
                      borderRadius: 12, border: "2px solid #FDD9B5",
                      background: "#FFF4EC", cursor: "pointer",
                      fontFamily: "inherit", transition: "all .15s",
                    }}
                  >
                    <span style={{ fontSize: 34, lineHeight: 1 }}>📱</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#F37E38" }}>Mobile</div>
                    <div style={{
                      fontSize: 11, color: "#9898B0", textAlign: "center",
                      lineHeight: 1.5, maxWidth: 140,
                    }}>
                      {lang === "pt-BR"
                        ? "Otimizado para celular — somente lançamentos"
                        : "Optimized for phone — entries only"}
                    </div>
                  </button>

                  {/* Card Desktop */}
                  <button
                    onClick={() => chooseDevice("desktop")}
                    style={{
                      flex: 1,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 8, padding: "22px 12px",
                      borderRadius: 12, border: "2px solid #E8E8EA",
                      background: "#F8FAFC", cursor: "pointer",
                      fontFamily: "inherit", transition: "all .15s",
                    }}
                  >
                    <span style={{ fontSize: 34, lineHeight: 1 }}>💻</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#212B36" }}>Desktop</div>
                    <div style={{
                      fontSize: 11, color: "#9898B0", textAlign: "center",
                      lineHeight: 1.5, maxWidth: 140,
                    }}>
                      {lang === "pt-BR"
                        ? "Acesso completo — todas as telas"
                        : "Full access — all screens"}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
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
                    border: lang === l.value ? "1.5px solid #F37E38" : "1.5px solid #E8E8EA",
                    background: lang === l.value ? "#FFF4EC" : "#fff",
                    color: lang === l.value ? "#F37E38" : "#9898B0",
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: .5 }}>{l.code}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>

            {/* Card de login */
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg,#212B36,#2E3B4A)", padding: "24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>
                      {step === "mfa"
                        ? (lang === "pt-BR" ? "Verificação em duas etapas" : "Two-step verification")
                        : t("login_title")}
                    </div>
                    <div style={{ color: "#9898B0", fontSize: 12, marginTop: 4 }}>
                      {step === "mfa"
                        ? (lang === "pt-BR" ? "Digite o código do seu aplicativo autenticador" : "Enter the code from your authenticator app")
                        : t("login_subtitle")}
                    </div>
                  </div>
                  {/* Badge do modo escolhido */}
                  <span style={{
                    background: deviceChoice === "mobile" ? "#F37E38" : "#212B36",
                    color: "#fff", borderRadius: 8, padding: "4px 10px",
                    fontSize: 11, fontWeight: 700, letterSpacing: .5, whiteSpace: "nowrap",
                  }}>
                    {deviceChoice === "mobile" ? "📱 Mobile" : "💻 Desktop"}
                  </span>
                </div>
              </div>

              {step === "mfa" ? (
                <form onSubmit={handleMfaVerify} style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="mfa-code" style={{ fontSize: 12, fontWeight: 600, color: "#9898B0", textTransform: "uppercase", letterSpacing: .7 }}>
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
                      style={{ border: "1.5px solid #E8E8EA", borderRadius: 8, padding: "10px 14px", fontSize: 22, fontFamily: "monospace", letterSpacing: 6, textAlign: "center", background: "#FAFAFA" }}
                    />
                  </div>
                  {erro && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E02424", fontWeight: 500 }}>
                      {erro}
                    </div>
                  )}
                  <button type="submit" disabled={loading || mfaCode.length !== 6}
                    style={{ background: (loading || mfaCode.length !== 6) ? "#F9C49A" : "#F37E38", border: "none", borderRadius: 10, padding: "13px", cursor: (loading || mfaCode.length !== 6) ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", transition: "all .15s" }}>
                    {loading ? (lang === "pt-BR" ? "Verificando…" : "Verifying…") : (lang === "pt-BR" ? "Verificar" : "Verify")}
                  </button>
                  <button type="button" onClick={() => { setStep("login"); setErro(""); setMfaCode(""); }}
                    style={{ background: "none", border: "none", color: "#9898B0", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                    {lang === "pt-BR" ? "← Voltar ao login" : "← Back to login"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="rsp-auth-card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="email" style={{ fontSize: 12, fontWeight: 600, color: "#9898B0", textTransform: "uppercase", letterSpacing: .7 }}>
                      {t("login_email")}
                    </label>
                    <input id="email" type="email" autoComplete="email" placeholder={t("login_placeholder_email")}
                      value={email} onChange={e => setEmail(e.target.value)} required
                      style={{ border: "1.5px solid #E8E8EA", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFAFA" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor="password" style={{ fontSize: 12, fontWeight: 600, color: "#9898B0", textTransform: "uppercase", letterSpacing: .7 }}>
                      {t("login_password")}
                    </label>
                    <input id="password" type="password" autoComplete="current-password" placeholder={t("login_placeholder_pass")}
                      value={password} onChange={e => setPassword(e.target.value)} required
                      style={{ border: "1.5px solid #E8E8EA", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", background: "#FAFAFA" }} />
                  </div>
                  {erro && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E02424", fontWeight: 500 }}>
                      {erro}
                    </div>
                  )}
                  <button type="submit" disabled={loading}
                    style={{ background: loading ? "#F9C49A" : "#F37E38", border: "none", borderRadius: 10, padding: "13px", cursor: loading ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", transition: "all .15s" }}>
                    {loading ? t("login_btn_loading") : t("login_btn")}
                  </button>
                  <div style={{ textAlign: "center", fontSize: 12, color: "#9898B0", marginTop: -4 }}>
                    {t("login_no_account")}
                  </div>
                  {/* Voltar para seleção de dispositivo */}
                  <button type="button" onClick={() => { setDeviceChoice(null); sessionStorage.removeItem("deviceMode"); setErro(""); }}
                    style={{ background: "none", border: "none", color: "#9898B0", fontSize: 11, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", marginTop: -8 }}>
                    {lang === "pt-BR" ? "← Trocar tipo de acesso" : "← Change access type"}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
