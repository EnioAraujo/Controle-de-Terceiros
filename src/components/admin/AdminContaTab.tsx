import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { mapSupabaseError } from "@/lib/i18n-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, Shield, Loader2 } from "lucide-react";
import { AdminMfaSection } from "./AdminMfaSection";

const MIN_PASSWORD_LENGTH = 8;

type Props = { myEmail: string };

export function AdminContaTab({ myEmail }: Props) {
  const { t, lang } = useI18n();
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg({ ok: false, text: t("admin_pass_mismatch") }); return; }
    if (newPass.length < MIN_PASSWORD_LENGTH) { setPassMsg({ ok: false, text: t("admin_pass_short") }); return; }
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

  return (
    <div className="max-w-md">
      <Card>
        <div className="p-5 flex items-center gap-3 rounded-t-lg" style={{ background:"linear-gradient(135deg, #212B36, #2E3B4A)" }}>
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">{myEmail}</div>
            <Badge className="mt-1 text-xs bg-purple-600/30 text-purple-300 border-purple-600/50">
              <Shield className="h-3 w-3 mr-1" />{t("admin_role_badge")}
            </Badge>
          </div>
        </div>
        <CardContent className="pt-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="font-semibold mb-2" style={{ color:"#212B36" }}>{t("admin_change_pwd")}</div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">{t("admin_new_pwd_label")}</Label>
              <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={t("admin_pwd_ph_min6")} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">{t("admin_confirm_pwd_label")}</Label>
              <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder={t("admin_confirm_ph")} required />
            </div>
            {passMsg && (
              <div className={`rounded-md p-3 text-sm font-medium ${passMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {passMsg.text}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={passLoading}>
              {passLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {passLoading ? t("admin_saving") : t("admin_save_pwd")}
            </Button>
          </form>

          <AdminMfaSection myEmail={myEmail} />
        </CardContent>
      </Card>
    </div>
  );
}
