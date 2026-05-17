import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Settings, Loader2 } from "lucide-react";
import {
  useAdminUsers, availablePermissions, rolePresets,
  type AppRole, type UserWithRole,
} from "@/hooks/useAdminUsers";
import { getRoleIcon, getRoleBadgeVariant, getRoleLabel } from "./AdminUserBadges";

type Props = {
  admin: ReturnType<typeof useAdminUsers>;
};

export function AdminPermissoesTab({ admin }: Props) {
  const { users, permsMutation } = admin;
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [customPerms, setCustomPerms] = useState<Set<string>>(new Set());

  const allPermKeys = availablePermissions.flatMap(c => c.permissions.map(p => p.key));

  const handleSelect = (user: UserWithRole) => {
    setSelectedUser(user);
    const src = (user.custom_permissions && user.custom_permissions.length > 0)
      ? user.custom_permissions
      : rolePresets[user.role] ?? [];
    setCustomPerms(new Set(src));
  };

  const togglePerm = (key: string) => {
    setCustomPerms(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const resetPerms = () => {
    if (!selectedUser) return;
    const src = (selectedUser.custom_permissions && selectedUser.custom_permissions.length > 0)
      ? selectedUser.custom_permissions
      : rolePresets[selectedUser.role] ?? [];
    setCustomPerms(new Set(src));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">Selecionar Usuário</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => handleSelect(user)}
                className="p-3 rounded-lg border cursor-pointer transition-colors"
                style={selectedUser?.id === user.id
                  ? { background:"#F37E3815", borderColor:"#F37E38" }
                  : { background:"transparent", borderColor:"rgba(26,28,29,0.1)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{user.email}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {getRoleIcon(user.role)}
                      <span style={{ fontSize:11, color:"#9898B0" }}>{getRoleLabel(user.role)}</span>
                    </div>
                  </div>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="shrink-0 text-xs">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedUser ? `Permissões de ${selectedUser.email}` : "Selecione um usuário"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedUser ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Presets Rápidos</Label>
                  <div className="flex gap-2 flex-wrap">
                    {(["user", "moderator", "admin"] as AppRole[]).map(role => (
                      <Button key={role} variant="outline" size="sm" className="gap-1" onClick={() => setCustomPerms(new Set(rolePresets[role]))}>
                        {getRoleIcon(role)}{getRoleLabel(role)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Permissões Customizadas</Label>
                  <Button variant="outline" size="sm" onClick={() => {
                    const isAll = allPermKeys.every(k => customPerms.has(k));
                    setCustomPerms(new Set(isAll ? [] : allPermKeys));
                  }}>
                    {allPermKeys.every(k => customPerms.has(k)) ? "Limpar Todas" : "Selecionar Todas"}
                  </Button>
                </div>
                <Accordion type="multiple" className="w-full">
                  {availablePermissions.map(cat => (
                    <AccordionItem key={cat.category} value={cat.category}>
                      <AccordionTrigger className="text-sm">{cat.category}</AccordionTrigger>
                      <AccordionContent className="space-y-2 pt-2">
                        {cat.permissions.map(perm => (
                          <div key={perm.key} className="flex items-start gap-3 p-2 rounded" style={{ cursor:"default" }}>
                            <Checkbox id={perm.key} checked={customPerms.has(perm.key)} onCheckedChange={() => togglePerm(perm.key)} />
                            <div>
                              <label htmlFor={perm.key} className="text-sm font-medium cursor-pointer">{perm.label}</label>
                              <p style={{ fontSize:11, color:"#9898B0" }}>{perm.description}</p>
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <div className="flex items-center justify-between pt-4" style={{ borderTop:"1px solid rgba(26,28,29,0.08)", marginTop:4 }}>
                  <span style={{ fontSize:11, color:"#9898B0" }}>{customPerms.size} permissões selecionadas</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetPerms}>Resetar</Button>
                    <Button size="sm" disabled={permsMutation.isPending} onClick={() => permsMutation.mutate({ userId: selectedUser.id, perms: Array.from(customPerms) })}>
                      {permsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Salvar Permissões
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16" style={{ color:"#9898B0" }}>
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p style={{ fontSize:11, color:"#9898B0" }}>Selecione um usuário para gerenciar permissões</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
