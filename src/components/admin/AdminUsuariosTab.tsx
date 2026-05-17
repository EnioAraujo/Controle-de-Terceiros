import { useState } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Shield, Search, User, Loader2, Trash2, Plus, LayoutGrid, List,
} from "lucide-react";
import { useAdminUsers, type UserWithRole } from "@/hooks/useAdminUsers";
import { AdminUserListing } from "./AdminUserListing";

const MIN_PASSWORD_LENGTH = 8;

type Props = {
  myId: string;
  admin: ReturnType<typeof useAdminUsers>;
};

export function AdminUsuariosTab({ myId, admin }: Props) {
  const { t } = useI18n();
  const { users, isLoading, deleteMutation, createMutation } = admin;

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [createError, setCreateError] = useState("");

  const filtered = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  const totalAdmins = users.filter(u => u.role === "admin").length;
  const totalCommon = users.length - totalAdmins;

  const openDelete = (u: UserWithRole) => { setUserToDelete(u); setIsDeleteOpen(true); };

  const submitCreate = () => {
    if (!newEmail.trim()) { setCreateError(t("admin_err_email_required")); return; }
    if (newPassword.length < MIN_PASSWORD_LENGTH) { setCreateError(t("admin_err_pwd_short")); return; }
    createMutation.mutate(
      { email: newEmail.trim(), password: newPassword, is_admin: newIsAdmin },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewEmail(""); setNewPassword(""); setNewIsAdmin(false); setCreateError("");
        },
        onError: (e: Error) => setCreateError(e.message),
      }
    );
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    deleteMutation.mutate(userToDelete.id, {
      onSuccess: () => { setIsDeleteOpen(false); setUserToDelete(null); },
    });
  };

  const stats = [
    { label: t("admin_stat_total"),  val: users.length, iconBg: "#3B82F615", iconColor: "#3B82F6", icon: <Users  className="h-5 w-5" /> },
    { label: t("admin_stat_admins"), val: totalAdmins,  iconBg: "#F37E3815", iconColor: "#F37E38", icon: <Shield className="h-5 w-5" /> },
    { label: t("admin_stat_common"), val: totalCommon,  iconBg: "#0E9F6E15", iconColor: "#0E9F6E", icon: <User   className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} style={{ background:"#FFFFFF", borderRadius:12, boxShadow:"0 20px 40px rgba(26,28,29,0.06)", padding:16, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:s.iconBg, color:s.iconColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:800, color:"#212B36", lineHeight:1.1 }}>{s.val}</div>
              <div style={{ fontSize:11, color:"#9898B0", marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color:"#9898B0" }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("admin_search_ph")} className="pl-9" />
        </div>
        <div className="flex items-center rounded-md border overflow-hidden">
          <button type="button" onClick={() => setViewMode("grid")} className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setViewMode("list")} className={`px-3 py-2 transition-colors border-l ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
        <Button size="sm" onClick={() => { setNewEmail(""); setNewPassword(""); setNewIsAdmin(false); setCreateError(""); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />{t("admin_new_user")}
        </Button>
      </div>

      <AdminUserListing
        users={filtered}
        myId={myId}
        viewMode={viewMode}
        isLoading={isLoading}
        admin={admin}
        onDelete={openDelete}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão de Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{userToDelete?.email}</strong>?<br /><br />
              Esta ação é <strong className="text-red-600">permanente</strong> e removerá o usuário do sistema de autenticação e todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : <><Trash2 className="h-4 w-4 mr-2" />Excluir Usuário</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCreateOpen} onOpenChange={v => { if (!createMutation.isPending) setIsCreateOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_modal_new")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("admin_modal_email_label")}</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@email.com" autoFocus autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("admin_modal_pwd_label")}</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("admin_modal_pwd_ph")} autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setNewIsAdmin(v => !v)}>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${newIsAdmin ? "bg-purple-600" : "bg-slate-200"}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${newIsAdmin ? "left-5" : "left-1"}`} />
              </div>
              <span className="text-sm font-medium">{t("admin_modal_admin_toggle")}</span>
            </div>
            {createError && <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600">{createError}</div>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMutation.isPending}>{t("admin_modal_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin_saving")}</> : t("admin_create_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
