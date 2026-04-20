import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useI18n } from "@/hooks/use-i18n";
import type { Lang } from "@/lib/i18n-translations";
import { mapSupabaseError } from "@/lib/i18n-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const LANGS: { value: Lang; label: string; code: string }[] = [
  { value: "pt-BR", label: "Português", code: "BR" },
  { value: "en-US", label: "English",   code: "US" },
];

// ─── MFA REPLAY GUARD ────────────────────────────────────────────────────────
const MFA_REPLAY_KEY = "mfa_replay_guard";
const MFA_REPLAY_TTL_MS = 35_000;

async function computeMfaCodeHash(code: string, factorId: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}|${factorId}`);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function getReplayGuard(): { hash: string; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(MFA_REPLAY_KEY);
    return raw ? (JSON.parse(raw) as { hash: string; ts: number }) : null;
  } catch { return null; }
}

function setReplayGuard(hash: string): void {
  try {
    sessionStorage.setItem(MFA_REPLAY_KEY, JSON.stringify({ hash, ts: Date.now() }));
  } catch { /* fail open */ }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── TOTP RATE LIMIT ─────────────────────────────────────────────────────────
const TOTP_RATE_KEY = "totp_rate";
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_COOLDOWN_MS = 60_000;

function recordTotpFail(): number {
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(TOTP_RATE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s?.bu && now < s.bu) return Math.ceil((s.bu - now) / 1000);
    let c = 1, ws = now;
    if (s && !s.bu && now - s.ws < TOTP_COOLDOWN_MS) { c = (s.c || 0) + 1; ws = s.ws; }
    if (c >= TOTP_MAX_ATTEMPTS) {
      const bu = now + TOTP_COOLDOWN_MS;
      sessionStorage.setItem(TOTP_RATE_KEY, JSON.stringify({ c, ws, bu }));
      return Math.ceil(TOTP_COOLDOWN_MS / 1000);
    }
    sessionStorage.setItem(TOTP_RATE_KEY, JSON.stringify({ c, ws }));
    return 0;
  } catch { return 0; }
}

function getTotpBlock(): number {
  try {
    const raw = sessionStorage.getItem(TOTP_RATE_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw);
    return s.bu && Date.now() < s.bu ? Math.ceil((s.bu - Date.now()) / 1000) : 0;
  } catch { return 0; }
}
// ─────────────────────────────────────────────────────────────────────────────

type Step = "login" | "mfa" | "recovery";
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
  const [recoveryCode, setRecoveryCode] = useState("");
  const [totpBlock, setTotpBlock]   = useState(() => getTotpBlock());
  const [forgotMode, setForgotMode] = useState(false);
  // Cancela handleLogin em progresso quando usuário clica "Voltar"
  const loginCancelledRef = useRef(false);

  useEffect(() => {
    if (totpBlock <= 0) return;
    const timer = setTimeout(() => setTotpBlock(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [totpBlock]);

  const chooseDevice = (choice: "mobile" | "desktop") => {
    sessionStorage.setItem("deviceMode", choice);
    setDeviceChoice(choice);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginCancelledRef.current = false;
    setErro("");
    setLoading(true);

    try {
      // Verifica bloqueio antes de tentar autenticar
      const { data: blocked } = await supabase.rpc("check_user_blocked", { p_email: email });
      if (blocked) {
        setLoading(false);
        setErro(t("login_err_blocked"));
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (loginCancelledRef.current) { setLoading(false); return; }
      if (error) {
        if (import.meta.env.DEV) console.warn("[LOGIN_FAILURE]", { error: error.message });
        // Registra falha no banco e re-verifica bloqueio
        await supabase.rpc("record_failed_login", { p_email: email });
        const { data: nowBlocked } = await supabase.rpc("check_user_blocked", { p_email: email });
        setLoading(false);
        setErro(nowBlocked ? t("login_err_blocked") : mapSupabaseError(error.message, lang));
        return;
      }

      const { data: factors, error: factErr } = await supabase.auth.mfa.listFactors();
      if (loginCancelledRef.current) { setLoading(false); return; }
      if (factErr) {
        if (import.meta.env.DEV) console.error("[MFA_LIST_ERROR]", factErr.message);
        setLoading(false);
        setErro(lang === "pt-BR" ? "Erro ao verificar MFA." : "Error verifying MFA.");
        return;
      }

      const verifiedTotp = factors?.totp?.find(f => f.factor_type === "totp" && f.status === "verified");

      if (verifiedTotp) {
        const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (loginCancelledRef.current) { setLoading(false); return; }
        if (aalErr) {
          if (import.meta.env.DEV) console.error("[MFA_AAL_ERROR]", aalErr.message);
          setLoading(false);
          setErro(lang === "pt-BR" ? "Erro ao verificar nível de autenticação." : "Error checking authentication level.");
          return;
        }

        if (aal?.currentLevel !== "aal2") {
          if (loginCancelledRef.current) { setLoading(false); return; }
          setFactorId(verifiedTotp.id);
          setStep("mfa");
          setLoading(false);
          return;
        }
      } else {
        navigate("/mfa-setup", { replace: true });
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[LOGIN_UNEXPECTED_ERROR]", err);
      setLoading(false);
      setErro(lang === "pt-BR" ? "Erro interno. Tente novamente." : "Internal error. Please try again.");
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      // Pre-check: SDK pode já ter elevado para aal2 automaticamente (MFA_CHALLENGE_VERIFIED)
      const { data: aalPre } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalPre?.currentLevel === "aal2") {
        const dest = sessionStorage.getItem("deviceMode") === "mobile" ? "/mobile" : "/";
        navigate(dest, { replace: true });
        return;
      }

      // Replay guard: rejeita o mesmo código TOTP dentro da janela de 35s
      const cleanCode = mfaCode.replace(/\s/g, "");
      const codeHash = await computeMfaCodeHash(cleanCode, factorId);
      const lastGuard = getReplayGuard();
      if (lastGuard && lastGuard.hash === codeHash && Date.now() - lastGuard.ts < MFA_REPLAY_TTL_MS) {
        setErro(
          lang === "pt-BR"
            ? "Este código já foi utilizado. Aguarde a atualização no app autenticador."
            : "This code was already used. Wait for your authenticator app to generate a new one."
        );
        return;
      }

      // Challenge fresco a cada submit — evita 422 por challengeId stale
      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr || !challenge) {
        if (import.meta.env.DEV) console.error("[MFA_CHALLENGE_ERROR]", chalErr?.message);
        setErro(lang === "pt-BR" ? "Erro ao iniciar verificação. Tente novamente." : "Error starting verification. Please try again.");
        return;
      }

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: cleanCode,
      });

      if (error) {
        if (import.meta.env.DEV) console.warn("[MFA_VERIFY_FAILURE]", { error: error.message });
        setMfaCode("");

        // Post-check: mesmo com erro na API, SDK pode ter elevado para aal2
        const { data: aalPost } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalPost?.currentLevel === "aal2") {
          setReplayGuard(codeHash);
          logAudit("MFA_VERIFY", "mfa", factorId);
          const dest = sessionStorage.getItem("deviceMode") === "mobile" ? "/mobile" : "/";
          navigate(dest, { replace: true });
          return;
        }

        const block = recordTotpFail();
        if (block > 0) setTotpBlock(block);
        logAudit("MFA_VERIFY_FAIL", "mfa", factorId);
        setErro(lang === "pt-BR" ? "Código inválido. Tente novamente." : "Invalid code. Please try again.");
        return;
      }

      setReplayGuard(codeHash);
      logAudit("MFA_VERIFY", "mfa", factorId);
      const dest = sessionStorage.getItem("deviceMode") === "mobile" ? "/mobile" : "/";
      navigate(dest, { replace: true });
    } catch (err) {
      if (import.meta.env.DEV) console.error("[MFA_VERIFY_UNEXPECTED_ERROR]", err);
      setErro(lang === "pt-BR" ? "Erro ao verificar código. Tente novamente." : "Error verifying code. Please try again.");
      setMfaCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    loginCancelledRef.current = true;
    setStep("login");
    setErro("");
    setMfaCode("");
    setRecoveryCode("");
    setFactorId("");
    setChallengeId("");
    setTotpBlock(0);
    setForgotMode(false);
    sessionStorage.removeItem(TOTP_RATE_KEY);
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { setErro(lang === "pt-BR" ? "Sessão expirada." : "Session expired."); return; }
      const raw = recoveryCode.replace(/\s/g, "").toUpperCase();
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${raw}`));
      const hash = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data: valid, error } = await supabase.rpc("use_backup_code", { p_code_hash: hash });
      if (error || !valid) {
        setErro(lang === "pt-BR" ? "Código de recuperação inválido." : "Invalid recovery code.");
        return;
      }
      logAudit("BACKUP_CODE_USED", "backup_codes", userId);
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
      navigate("/mfa-setup", { replace: true });
    } catch {
      setErro(lang === "pt-BR" ? "Erro ao verificar código." : "Error verifying code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-dm-sans">
      {/* Language selector */}
      <div className="absolute top-4 right-4 flex gap-2">
        {LANGS.map(l => (
          <button
            key={l.value}
            onClick={() => setLang(l.value)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${lang === l.value
                ? 'bg-orange-50 border-2 border-orange-500 text-orange-600'
                : 'bg-white border-2 border-gray-200 text-gray-400 hover:border-orange-300'
              }
            `}
          >
            <span className="font-black text-[10px] tracking-wider">{l.code}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        {/* Device Selection */}
        {deviceChoice === null ? (
          <Card className="overflow-hidden shadow-lg">
            <CardHeader className="bg-gradient-to-br from-slate-800 to-slate-700 text-white">
              <CardTitle className="text-lg font-bold">
                {lang === "pt-BR" ? "Controle de Terceiros" : "Third-party Control"}
              </CardTitle>
              <CardDescription className="text-slate-300 text-sm mt-1">
                {lang === "pt-BR" ? "Como você vai acessar hoje?" : "How will you access today?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-7">
              <div className="flex gap-3.5">
                {/* Mobile Card */}
                <button
                  onClick={() => chooseDevice("mobile")}
                  className="flex-1 flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-orange-200 bg-orange-50 cursor-pointer transition-all hover:border-orange-400 hover:shadow-md font-dm-sans"
                >
                  <span className="text-[34px] leading-none">📱</span>
                  <div className="font-black text-base text-orange-600">Mobile</div>
                  <div className="text-[11px] text-gray-400 text-center leading-tight">
                    {lang === "pt-BR"
                      ? "Otimizado para celular — somente lançamentos"
                      : "Optimized for phone — entries only"}
                  </div>
                </button>

                {/* Desktop Card */}
                <button
                  onClick={() => chooseDevice("desktop")}
                  className="flex-1 flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 bg-slate-50 cursor-pointer transition-all hover:border-slate-400 hover:shadow-md font-dm-sans"
                >
                  <span className="text-[34px] leading-none">💻</span>
                  <div className="font-black text-base text-slate-800">Desktop</div>
                  <div className="text-[11px] text-gray-400 text-center leading-tight">
                    {lang === "pt-BR"
                      ? "Acesso completo — todas as telas"
                      : "Full access — all screens"}
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-lg">
            <CardHeader className="bg-gradient-to-br from-slate-800 to-slate-700 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">
                    {step === "mfa" || step === "recovery"
                      ? (lang === "pt-BR" ? "Verificação em duas etapas" : "Two-step verification")
                      : t("login_title")}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-1">
                    {step === "mfa"
                      ? (lang === "pt-BR" ? "Digite o código do seu aplicativo autenticador" : "Enter the code from your authenticator app")
                      : step === "recovery"
                      ? (lang === "pt-BR" ? "Insira um código de recuperação salvo" : "Enter a saved recovery code")
                      : t("login_subtitle")}
                  </CardDescription>
                </div>
                <span className={`
                  px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide whitespace-nowrap
                  ${deviceChoice === "mobile" ? 'bg-orange-500 text-white' : 'bg-slate-800 text-white'}
                `}>
                  {deviceChoice === "mobile" ? "📱 Mobile" : "💻 Desktop"}
                </span>
              </div>
            </CardHeader>

            {step === "mfa" ? (
              <form onSubmit={handleMfaVerify} className="p-7 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfa-code" className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                    {lang === "pt-BR" ? "Código TOTP (6 dígitos)" : "TOTP Code (6 digits)"}
                  </Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000 000"
                    aria-label={lang === "pt-BR" ? "Código de verificação de 6 dígitos" : "6-digit verification code"}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    className="text-[22px] font-mono tracking-[6px] text-center bg-gray-50"
                  />
                </div>

                {erro && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-[13px] font-medium text-red-600">
                      {erro}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  disabled={loading || mfaCode.length !== 6 || totpBlock > 0}
                  className="w-full font-bold"
                >
                  {totpBlock > 0
                    ? (lang === "pt-BR" ? `Bloqueado (${totpBlock}s)` : `Blocked (${totpBlock}s)`)
                    : loading ? (lang === "pt-BR" ? "Verificando…" : "Verifying…") : (lang === "pt-BR" ? "Verificar" : "Verify")}
                </Button>

                <Button 
                  type="button" 
                  variant="link" 
                  onClick={handleBackToLogin}
                  className="text-gray-400 text-xs"
                >
                  {lang === "pt-BR" ? "← Voltar ao login" : "← Back to login"}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  onClick={() => { setStep("recovery"); setErro(""); }}
                  className="text-gray-400 text-[11px] -mt-2"
                >
                  {lang === "pt-BR" ? "Usar código de recuperação" : "Use a recovery code"}
                </Button>
              </form>
            ) : step === "recovery" ? (
              <form onSubmit={handleRecoveryVerify} className="p-7 flex flex-col gap-4">
                <div className="text-center text-sm text-gray-500">
                  {lang === "pt-BR"
                    ? "Insira um dos códigos de recuperação que você salvou ao configurar a autenticação."
                    : "Enter one of the recovery codes you saved when setting up authentication."}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recovery-code" className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                    {lang === "pt-BR" ? "Código de recuperação" : "Recovery code"}
                  </Label>
                  <Input
                    id="recovery-code"
                    type="text"
                    placeholder="A1B2C3D4E5"
                    value={recoveryCode}
                    onChange={e => setRecoveryCode(e.target.value.replace(/[^a-fA-F0-9]/g, "").slice(0, 10))}
                    required
                    autoFocus
                    aria-label={lang === "pt-BR" ? "Código de recuperação de 10 caracteres" : "10-character recovery code"}
                    className="text-[18px] font-mono tracking-[4px] text-center bg-gray-50"
                  />
                </div>

                {erro && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-[13px] font-medium text-red-600">{erro}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading || recoveryCode.length !== 10} className="w-full font-bold">
                  {loading ? (lang === "pt-BR" ? "Verificando…" : "Verifying…") : (lang === "pt-BR" ? "Usar código" : "Use code")}
                </Button>
                <Button type="button" variant="link" onClick={() => { setStep("mfa"); setErro(""); setRecoveryCode(""); }} className="text-gray-400 text-xs">
                  {lang === "pt-BR" ? "← Voltar para código TOTP" : "← Back to TOTP code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="p-7 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t("login_email")}
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    autoComplete="email" 
                    placeholder={t("login_placeholder_email")}
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required
                    className="bg-gray-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password" className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t("login_password")}
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    autoComplete="current-password" 
                    placeholder={t("login_placeholder_pass")}
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required
                    className="bg-gray-50"
                  />
                </div>

                {erro && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-[13px] font-medium text-red-600">
                      {erro}
                    </AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading} className="w-full font-bold">
                  {loading ? t("login_btn_loading") : t("login_btn")}
                </Button>

                {forgotMode ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex flex-col gap-1.5">
                    <p className="text-[12px] font-semibold text-amber-700 text-center">{t("login_forgot_msg")}</p>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setForgotMode(false)}
                      className="text-amber-600 text-[11px] h-auto p-0"
                    >
                      {lang === "pt-BR" ? "← Voltar" : "← Back"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setForgotMode(true)}
                    className="text-gray-400 text-[11px] -mt-1 h-auto"
                  >
                    {t("login_forgot_link")}
                  </Button>
                )}

                <p className="text-center text-xs text-gray-400 -mt-1">
                  {t("login_no_account")}
                </p>

                <Button 
                  type="button" 
                  variant="link" 
                  onClick={() => { setDeviceChoice(null); sessionStorage.removeItem("deviceMode"); setErro(""); setForgotMode(false); }}
                  className="text-gray-400 text-[11px] -mt-2"
                >
                  {lang === "pt-BR" ? "← Trocar tipo de acesso" : "← Change access type"}
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
