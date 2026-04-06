import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useI18n } from "@/hooks/use-i18n";

type SetupStep = "loading" | "qr" | "verify" | "backup" | "error";

async function genBackupCodes(userId: string): Promise<string[]> {
  const plain: string[] = [];
  const rows: { user_id: string; code_hash: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    const c = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    plain.push(c);
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${c}`));
    rows.push({ user_id: userId, code_hash: btoa(String.fromCharCode(...new Uint8Array(buf))) });
  }
  await supabase.from("backup_codes").delete().eq("user_id", userId);
  await supabase.from("backup_codes").insert(rows);
  return plain;
}

export default function MfaSetupPage() {
  const navigate = useNavigate();
  const { lang } = useI18n();

  const [step, setStep]         = useState<SetupStep>("loading");
  const [qrUrl, setQrUrl]       = useState("");
  const [secret, setSecret]     = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const t = (pt: string, en: string) => lang === "pt-BR" ? pt : en;

  useEffect(() => {
    let cancelled = false;

    async function initEnrollment() {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session) {
        navigate("/login", { replace: true });
        return;
      }

      // Se ja esta em AAL2, MFA ja verificado nesta sessao
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        navigate("/", { replace: true });
        return;
      }

      // Se ja tem fator inscrito mas ainda aguarda verificacao
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const existingFactor = factors?.totp?.[0];
      if (existingFactor) {
        setFactorId(existingFactor.id);
        if (!cancelled) setStep("verify");
        return;
      }

      // Novo enrollment TOTP
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) {
        if (!cancelled) setStep("error");
        return;
      }

      setFactorId(data.id);
      setQrUrl(data.totp.qr_code);
      setSecret(data.totp.secret);
      logAudit("MFA_ENROLL", "mfa", data.id);
      if (!cancelled) setStep("qr");
    }

    initEnrollment();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chalErr || !challenge) {
      setErro(t("Erro ao iniciar verificação. Tente novamente.", "Error starting verification. Please try again."));
      setLoading(false);
      return;
    }

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ""),
    });

    setLoading(false);

    if (verErr) {
      setErro(t("Código inválido. Verifique o app autenticador e tente novamente.", "Invalid code. Check your authenticator app and try again."));
      setCode("");
      return;
    }

    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user?.id) {
      const codes = await genBackupCodes(s.user.id);
      setBackupCodes(codes);
    }
    logAudit("MFA_VERIFY", "mfa", factorId);
    setStep("backup");
  };

  const handleSkip = () => {
    if (factorId && step === "qr") {
      supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    }
    logAudit("MFA_SKIP", "mfa", factorId || undefined);
    navigate("/", { replace: true });
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#FAF9FB",
    fontFamily: "'DM Sans',system-ui,sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  if (step === "loading") {
    return (
      <div style={containerStyle}>
          <div style={{ fontSize: 14, color: "#9898B0", fontWeight: 600 }}>
          {t("Configurando autenticação...", "Setting up authentication...")}
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div style={containerStyle}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#E02424", fontWeight: 600 }}>
            {t("Erro ao configurar autenticação em dois fatores.", "Error setting up two-factor authentication.")}
          </div>
          <button
            onClick={() => navigate("/", { replace: true })}
            style={{ marginTop: 16, background: "#F37E38", border: "none", borderRadius: 10, padding: "11px 24px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}
          >
            {t("Continuar sem MFA", "Continue without MFA")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div style={containerStyle}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#212B36" }}>
            {t("Códigos de Recuperação", "Recovery Codes")}
          </div>
          <div style={{ fontSize: 12, color: "#9898B0", lineHeight: 1.6, margin: "8px 0 16px", maxWidth: 360, marginInline: "auto" }}>
            {t(
              "Salve estes códigos em local seguro. Cada código pode ser usado uma única vez caso perca acesso ao app autenticador.",
              "Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app."
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {backupCodes.map((c, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 14, background: "#F8FAFC", borderRadius: 6, padding: "8px 12px", letterSpacing: 1, color: "#212B36" }}>
                {c}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(backupCodes.join("\n")).catch(() => undefined)}
              style={{ flex: 1, background: "#F8FAFC", border: "1.5px solid #E8E8EA", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#212B36", fontFamily: "inherit" }}
            >
              {t("Copiar todos", "Copy all")}
            </button>
            <button
              type="button"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([backupCodes.join("\n")], { type: "text/plain" }));
                a.download = "backup-codes.txt";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              style={{ flex: 1, background: "#F8FAFC", border: "1.5px solid #E8E8EA", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#212B36", fontFamily: "inherit" }}
            >
              {t("Baixar .txt", "Download .txt")}
            </button>
          </div>
          <button
            onClick={() => navigate("/", { replace: true })}
            style={{ background: "#F37E38", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", width: "100%" }}
          >
            {t("Confirmo que salvei os códigos", "I confirm I saved the codes")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,.08)", overflow: "hidden" }}>

          <div style={{ background: "linear-gradient(135deg,#212B36,#2E3B4A)", padding: "24px 28px" }}>
            <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 18 }}>
              {t("Configurar Autenticação em 2 Fatores", "Set Up Two-Factor Authentication")}
            </div>
            <div style={{ color: "#9898B0", fontSize: 13, marginTop: 4 }}>
              {t("Proteja sua conta com um app autenticador", "Protect your account with an authenticator app")}
            </div>
          </div>

          <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}>

            {step === "qr" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" as const, width: "100%" }}>
                {/* Passo 1 */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 28, background: "#FFF4EC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#F37E38" }}>1</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#212B36" }}>
                    {t("Instale um app autenticador", "Install an authenticator app")}
                  </div>
                  <div style={{ fontSize: 12, color: "#9898B0", lineHeight: 1.6, maxWidth: 300 }}>
                    {t(
                      "Ex: Google Authenticator, Microsoft Authenticator ou Authy. Disponível gratuitamente.",
                      "E.g.: Google Authenticator, Microsoft Authenticator or Authy. Free on the app stores."
                    )}
                  </div>
                </div>

                {/* Passo 2 */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
                  <div style={{ width: 28, height: 28, background: "#FFF4EC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#F37E38" }}>2</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#212B36", marginBottom: 6 }}>
                    {t("Escaneie o QR Code", "Scan the QR Code")}
                  </div>
                  <div style={{ background: "#fff", border: "2px solid #E8E8EA", borderRadius: 12, padding: 12, display: "inline-block" }}>
                    <img src={qrUrl} alt="QR Code MFA" width={160} height={160} style={{ display: "block" }} />
                  </div>
                  {secret && (
                    <div style={{ marginTop: 8, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 8, padding: "10px 14px", width: "100%" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9898B0", textTransform: "uppercase", letterSpacing: .7, marginBottom: 4 }}>
                        {t("Ou insira o codigo manualmente:", "Or enter the secret key manually:")}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "#212B36", letterSpacing: 1, wordBreak: "break-all" }}>
                        {secret}
                      </div>
                    </div>
                  )}
                </div>

                {/* Passo 3 */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
                  <div style={{ width: 28, height: 28, background: "#FFF4EC", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#F37E38" }}>3</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#212B36", marginBottom: 4 }}>
                    {t("Confirme o código gerado", "Confirm the generated code")}
                  </div>
                  <button
                    onClick={() => setStep("verify")}
                    style={{ background: "#F37E38", border: "none", borderRadius: 10, padding: "12px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", width: "100%" }}
                  >
                    {t("Já escaneei — inserir código", "I scanned it — enter code")}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSkip}
                  style={{ background: "none", border: "none", color: "#9898B0", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", textAlign: "center" }}
                >
                  {t("Configurar mais tarde (não recomendado)", "Set up later (not recommended)")}
                </button>
              </div>
            )}

            {step === "verify" && (
              <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}>
                <div style={{ textAlign: "center", fontSize: 13, color: "#9898B0", lineHeight: 1.6 }}>
                  {t(
                    "Abra seu app autenticador e insira o código de 6 dígitos gerado para esta conta.",
                    "Open your authenticator app and enter the 6-digit code generated for this account."
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  <label htmlFor="totp-code" style={{ fontSize: 12, fontWeight: 600, color: "#9898B0", textTransform: "uppercase", letterSpacing: .7, textAlign: "center" }}>
                    {t("Código de 6 dígitos", "6-digit code")}
                  </label>
                  <input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000 000"
                    aria-label={t("Código de verificação de 6 dígitos", "6-digit verification code")}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    style={{
                      border: "1.5px solid #E8E8EA",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 28,
                      fontFamily: "monospace",
                      letterSpacing: 10,
                      textAlign: "center",
                      background: "#FAFAFA",
                    }}
                  />
                </div>

                {erro && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#E02424", fontWeight: 500, width: "100%", textAlign: "center" }}>
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  style={{
                    background: (loading || code.length !== 6) ? "#F9C49A" : "#F37E38",
                    border: "none", borderRadius: 10, padding: "13px",
                    cursor: (loading || code.length !== 6) ? "not-allowed" : "pointer",
                    color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
                    width: "100%",
                  }}
                >
                  {loading
                    ? t("Verificando...", "Verifying...")
                    : t("Ativar autenticação em 2 fatores", "Enable two-factor authentication")}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("qr"); setErro(""); setCode(""); }}
                  style={{ background: "none", border: "none", color: "#9898B0", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", textAlign: "center" }}
                >
                  {t("Ver o QR Code novamente", "See the QR code again")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
