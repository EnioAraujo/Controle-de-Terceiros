import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
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
    const raw = localStorage.getItem(MFA_REPLAY_KEY);
    return raw ? (JSON.parse(raw) as { hash: string; ts: number }) : null;
  } catch { return null; }
}

function setReplayGuard(hash: string): void {
  try {
    localStorage.setItem(MFA_REPLAY_KEY, JSON.stringify({ hash, ts: Date.now() }));
  } catch { /* fail open */ }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  // Cancela handleLogin em progresso quando usuário clica "Voltar"
  const loginCancelledRef = useRef(false);

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (loginCancelledRef.current) { setLoading(false); return; }
      if (error) {
        console.warn("[LOGIN_FAILURE]", { email, error: error.message });
        setLoading(false);
        setErro(mapSupabaseError(error.message, lang));
        return;
      }

      const { data: factors, error: factErr } = await supabase.auth.mfa.listFactors();
      if (loginCancelledRef.current) { setLoading(false); return; }
      if (factErr) {
        console.error("[MFA_LIST_ERROR]", factErr.message);
        setLoading(false);
        setErro(lang === "pt-BR" ? "Erro ao verificar MFA." : "Error verifying MFA.");
        return;
      }

      const verifiedTotp = factors?.totp?.find(f => f.factor_type === "totp" && f.status === "verified");

      if (verifiedTotp) {
        const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (loginCancelledRef.current) { setLoading(false); return; }
        if (aalErr) {
          console.error("[MFA_AAL_ERROR]", aalErr.message);
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
      console.error("[LOGIN_UNEXPECTED_ERROR]", err);
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
        console.error("[MFA_CHALLENGE_ERROR]", chalErr?.message);
        setErro(lang === "pt-BR" ? "Erro ao iniciar verificação. Tente novamente." : "Error starting verification. Please try again.");
        return;
      }

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: cleanCode,
      });

      if (error) {
        console.warn("[MFA_VERIFY_FAILURE]", { factorId, error: error.message });
        setMfaCode("");

        // Post-check: mesmo com erro na API, SDK pode ter elevado para aal2
        const { data: aalPost } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalPost?.currentLevel === "aal2") {
          setReplayGuard(codeHash);
          const dest = sessionStorage.getItem("deviceMode") === "mobile" ? "/mobile" : "/";
          navigate(dest, { replace: true });
          return;
        }

        setErro(lang === "pt-BR" ? "Código inválido. Tente novamente." : "Invalid code. Please try again.");
        return;
      }

      setReplayGuard(codeHash);
    } catch (err) {
      console.error("[MFA_VERIFY_UNEXPECTED_ERROR]", err);
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
    setFactorId("");
    setChallengeId("");
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
                    {step === "mfa"
                      ? (lang === "pt-BR" ? "Verificação em duas etapas" : "Two-step verification")
                      : t("login_title")}
                  </CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-1">
                    {step === "mfa"
                      ? (lang === "pt-BR" ? "Digite o código do seu aplicativo autenticador" : "Enter the code from your authenticator app")
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
                    placeholder="000000"
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
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full font-bold"
                >
                  {loading ? (lang === "pt-BR" ? "Verificando…" : "Verifying…") : (lang === "pt-BR" ? "Verificar" : "Verify")}
                </Button>

                <Button 
                  type="button" 
                  variant="link" 
                  onClick={handleBackToLogin}
                  className="text-gray-400 text-xs"
                >
                  {lang === "pt-BR" ? "← Voltar ao login" : "← Back to login"}
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

                <p className="text-center text-xs text-gray-400 -mt-1">
                  {t("login_no_account")}
                </p>

                <Button 
                  type="button" 
                  variant="link" 
                  onClick={() => { setDeviceChoice(null); sessionStorage.removeItem("deviceMode"); setErro(""); }}
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
