import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldOff, KeyRound, Loader2 } from "lucide-react";

type MfaEnrollStep = "idle" | "qr" | "verify" | "done";

type Props = { myEmail: string };

export function AdminMfaSection({ myEmail }: Props) {
  const { lang } = useI18n();
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [step, setStep] = useState<MfaEnrollStep>("idle");
  const [enrollId, setEnrollId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isUnenrollOpen, setIsUnenrollOpen] = useState(false);
  const [unenrollFactorId, setUnenrollFactorId] = useState("");
  const [unenrollPass, setUnenrollPass] = useState("");

  const loadFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { if (import.meta.env.DEV) console.error("Erro ao listar fatores MFA:", error.message); return; }
    setFactors(data?.totp ?? []);
  }, []);

  useEffect(() => {
    loadFactors().catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar MFA:", err); });
  }, [loadFactors]);

  const handleEnroll = async () => {
    setLoading(true); setMsg(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Controle de Terceiros" });
      if (error || !data) {
        setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao iniciar inscrição MFA." : "Error starting MFA enrollment." });
        return;
      }
      setEnrollId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); setStep("qr");
    } catch (err) {
      if (import.meta.env.DEV) console.error("Erro ao inscrever MFA:", err);
      setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao iniciar inscrição MFA." : "Error starting MFA enrollment." });
    } finally { setLoading(false); }
  };

  const handleVerifyEnroll = async () => {
    setLoading(true); setMsg(null);
    try {
      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: enrollId });
      if (chalErr || !challenge) {
        setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao criar desafio MFA." : "Error creating MFA challenge." });
        return;
      }
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollId, challengeId: challenge.id, code: code.replace(/\s/g, ""),
      });
      if (verErr) {
        setMsg({ ok: false, text: lang === "pt-BR" ? "Código inválido. Tente novamente." : "Invalid code. Try again." });
        setCode(""); return;
      }
      setStep("done");
      setMsg({ ok: true, text: lang === "pt-BR" ? "MFA ativado com sucesso!" : "MFA activated successfully!" });
      setCode(""); await loadFactors();
    } catch (err) {
      if (import.meta.env.DEV) console.error("Erro ao verificar MFA:", err);
      setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao verificar código MFA." : "Error verifying MFA code." });
    } finally { setLoading(false); }
  };

  const openUnenroll = (factorId: string) => {
    setUnenrollFactorId(factorId); setUnenrollPass(""); setMsg(null); setIsUnenrollOpen(true);
  };

  const handleUnenroll = async () => {
    if (!unenrollPass.trim()) {
      setMsg({ ok: false, text: lang === "pt-BR" ? "Informe sua senha atual." : "Enter your current password." });
      return;
    }
    setLoading(true); setMsg(null);
    try {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: myEmail, password: unenrollPass });
      if (reAuthErr) {
        setMsg({ ok: false, text: lang === "pt-BR" ? "Senha incorreta." : "Incorrect password." });
        setUnenrollPass(""); return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: unenrollFactorId });
      if (error) {
        setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
        return;
      }
      setMsg({ ok: true, text: lang === "pt-BR" ? "MFA removido." : "MFA removed." });
      setStep("idle"); setIsUnenrollOpen(false); await loadFactors();
    } catch {
      setMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
    } finally { setLoading(false); setUnenrollPass(""); }
  };

  return (
    <div className="mt-8 pt-6 space-y-4" style={{ borderTop:"1px solid rgba(26,28,29,0.08)" }}>
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4" style={{ color:"#9898B0" }} />
        <span className="font-semibold text-sm" style={{ color:"#212B36" }}>
          {lang === "pt-BR" ? "Autenticação em duas etapas (TOTP)" : "Two-factor authentication (TOTP)"}
        </span>
        {factors.length > 0 && (
          <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
            {lang === "pt-BR" ? "Ativo" : "Active"}
          </Badge>
        )}
      </div>

      {msg && (
        <div className={`rounded-md p-3 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {factors.length > 0 ? (
        <div className="space-y-3">
          <p style={{ fontSize:11, color:"#9898B0" }}>
            {lang === "pt-BR"
              ? "Seu aplicativo autenticador está configurado. Cada login exigirá um código TOTP."
              : "Your authenticator app is configured. Each login will require a TOTP code."}
          </p>
          {factors.map(f => (
            <Button key={f.id} variant="destructive" size="sm" className="w-full" disabled={loading} onClick={() => openUnenroll(f.id)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              {lang === "pt-BR" ? "Desativar MFA" : "Disable MFA"}
            </Button>
          ))}
        </div>
      ) : step === "idle" ? (
        <div className="space-y-3">
          <p style={{ fontSize:11, color:"#9898B0" }}>
            {lang === "pt-BR"
              ? "Use um aplicativo como Google Authenticator ou Authy para proteger sua conta."
              : "Use an app like Google Authenticator or Authy to protect your account."}
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleEnroll} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            {lang === "pt-BR" ? "Configurar MFA" : "Set up MFA"}
          </Button>
        </div>
      ) : step === "qr" ? (
        <div className="space-y-4">
          <p style={{ fontSize:11, color:"#9898B0" }}>
            {lang === "pt-BR" ? "1. Escaneie o QR code com seu aplicativo autenticador." : "1. Scan the QR code with your authenticator app."}
          </p>
          <div className="flex justify-center">
            <img src={qrCode} alt="QR Code MFA" className="w-48 h-48 rounded-lg p-1" style={{ border:"1px solid #E8E8EA" }} />
          </div>
          <details style={{ fontSize:11, color:"#9898B0" }}>
            <summary className="cursor-pointer">{lang === "pt-BR" ? "Não consegue escanear? Ver chave manual" : "Can't scan? Show manual key"}</summary>
            <code className="block mt-1 break-all p-2 rounded select-all" style={{ background:"#F4F3F5", color:"#212B36", fontSize:11 }}>{secret}</code>
          </details>
          <p style={{ fontSize:11, color:"#9898B0" }}>
            {lang === "pt-BR" ? "2. Digite o código de 6 dígitos gerado pelo app para confirmar:" : "2. Enter the 6-digit code from your app to confirm:"}
          </p>
          <Input
            type="text" inputMode="numeric" placeholder="000000" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-widest font-mono" autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setStep("idle"); setMsg(null); setCode(""); }}>
              {lang === "pt-BR" ? "Cancelar" : "Cancel"}
            </Button>
            <Button size="sm" className="flex-1" disabled={loading || code.length !== 6} onClick={handleVerifyEnroll}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {lang === "pt-BR" ? "Confirmar" : "Confirm"}
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={isUnenrollOpen} onOpenChange={v => { if (!loading) setIsUnenrollOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "pt-BR" ? "Confirmar desativação do MFA" : "Confirm MFA deactivation"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "pt-BR"
                ? "Esta ação removerá a autenticação em duas etapas da sua conta. Confirme sua senha atual para continuar."
                : "This will remove two-factor authentication from your account. Enter your current password to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Input
              type="password"
              placeholder={lang === "pt-BR" ? "Senha atual" : "Current password"}
              value={unenrollPass} onChange={e => setUnenrollPass(e.target.value)}
              autoFocus autoComplete="current-password"
            />
            {msg && !msg.ok && <p className="text-sm text-red-600">{msg.text}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{lang === "pt-BR" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnenroll} disabled={loading || !unenrollPass.trim()} className="bg-red-600 hover:bg-red-700">
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{lang === "pt-BR" ? "Removendo..." : "Removing..."}</>
                : <><ShieldOff className="h-4 w-4 mr-2" />{lang === "pt-BR" ? "Desativar MFA" : "Disable MFA"}</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
