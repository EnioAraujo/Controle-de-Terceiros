import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldOff, User, Loader2, CheckCircle2, XCircle, Trash2, KeyRound,
} from "lucide-react";
import type { useAdminUsers, AppRole, UserWithRole } from "@/hooks/useAdminUsers";
import { getRoleIcon, getRoleBadgeVariant, getRoleLabel } from "./AdminUserBadges";

type Admin = ReturnType<typeof useAdminUsers>;

type Props = {
  users: UserWithRole[];
  myId: string;
  viewMode: "grid" | "list";
  isLoading: boolean;
  admin: Admin;
  onDelete: (u: UserWithRole) => void;
};

export function AdminUserListing({ users, myId, viewMode, isLoading, admin, onDelete }: Props) {
  const { t, lang } = useI18n();
  const { approvalMutation, roleMutation, unblockMutation, handleResetPassword, resetFeedback } = admin;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color:"#F37E38" }} /></div>;
  }
  if (users.length === 0) {
    return (
      <div className="text-center py-20" style={{ color:"#9898B0" }}>
        <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>{t("admin_no_users")}</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <div key={user.id} style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", overflow:"hidden" }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 truncate" style={{ color:"#212B36" }}>
                <User className="h-4 w-4 shrink-0" style={{ color:"#9898B0" }} />
                <span className="truncate">{user.email}</span>
              </CardTitle>
              {user.is_approved ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {getRoleIcon(user.role)}
                <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                {user.id === myId && <span className="text-xs font-bold" style={{ color:"#F37E38" }}>{t("admin_you")}</span>}
                {user.is_blocked && <Badge variant="destructive" className="text-xs">Bloqueado</Badge>}
              </div>
              <div className="space-y-2" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", paddingTop:8, marginTop:8 }}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Aprovado</Label>
                  <Switch checked={user.is_approved} onCheckedChange={v => approvalMutation.mutate({ userId: user.id, isApproved: v })} disabled={approvalMutation.isPending} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Papel</Label>
                  <Select value={user.role} onValueChange={(v: AppRole) => roleMutation.mutate({ userId: user.id, role: v })} disabled={roleMutation.isPending || user.id === myId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderador</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.id === myId && <p style={{ fontSize:11, color:"#9898B0" }}>Você não pode alterar seu próprio papel</p>}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#9898B0" }}>Criado em: {new Date(user.created_at).toLocaleDateString(lang)}</div>
              {user.id !== myId && (
                <div className="flex gap-2" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", paddingTop:8, marginTop:4 }}>
                  {user.is_blocked ? (
                    <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50 flex-1" onClick={() => unblockMutation.mutate({ userId: user.id, email: user.email })} disabled={unblockMutation.isPending}>
                      <ShieldOff className="h-4 w-4 mr-1" />Desbloquear
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-orange-600 hover:text-orange-600 hover:bg-orange-50 flex-1" onClick={() => handleResetPassword(user.email, user.id)} title={t("admin_tooltip_reset")}>
                      <KeyRound className="h-4 w-4 mr-1" />{t("admin_reset_pwd_btn")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(user)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {resetFeedback[user.id] && (
                <p className={`text-xs font-semibold ${resetFeedback[user.id].ok ? "text-emerald-600" : "text-red-600"}`}>{resetFeedback[user.id].text}</p>
              )}
            </CardContent>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", overflow:"hidden" }}>
      <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ background:"#F4F3F5", color:"#9898B0" }}>
        <div className="col-span-2">{t("admin_col_email")}</div>
        <div>{t("admin_col_profile")}</div>
        <div>Aprovado</div>
        <div>{t("admin_col_created")}</div>
        <div>{t("admin_col_actions")}</div>
      </div>
      {users.map(user => (
        <div key={user.id} className="grid grid-cols-6 gap-2 px-4 py-2 text-sm items-center" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", background: user.id === myId ? "#F37E3808" : undefined }}>
          <div className="col-span-2 flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0" style={{ color:"#9898B0" }} />
            <span className="truncate">{user.email}</span>
            {user.id === myId && <span className="text-xs font-bold shrink-0" style={{ color:"#F37E38" }}>{t("admin_you")}</span>}
            {user.is_blocked && <Badge variant="destructive" className="text-xs shrink-0">Bloqueado</Badge>}
          </div>
          <div>
            <Select value={user.role} onValueChange={(v: AppRole) => roleMutation.mutate({ userId: user.id, role: v })} disabled={roleMutation.isPending || user.id === myId}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderador</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Switch checked={user.is_approved} onCheckedChange={v => approvalMutation.mutate({ userId: user.id, isApproved: v })} disabled={approvalMutation.isPending} /></div>
          <div style={{ fontSize:11, color:"#9898B0" }}>{new Date(user.created_at).toLocaleDateString(lang)}</div>
          <div className="flex items-center gap-1">
            {user.id !== myId ? (
              <>
                {user.is_blocked ? (
                  <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => unblockMutation.mutate({ userId: user.id, email: user.email })} disabled={unblockMutation.isPending}>
                    <ShieldOff className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 text-orange-600 hover:text-orange-600 hover:bg-orange-50" onClick={() => handleResetPassword(user.email, user.id)} title={t("admin_tooltip_reset")}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(user)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : <div className="h-8" />}
            {resetFeedback[user.id] && (
              <span className={`text-xs font-semibold ${resetFeedback[user.id].ok ? "text-emerald-600" : "text-red-600"}`}>{resetFeedback[user.id].text}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
