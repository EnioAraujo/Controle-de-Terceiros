import { Crown, Pencil, Eye } from "lucide-react";
import type { AppRole } from "@/hooks/useAdminUsers";

export const getRoleIcon = (role: AppRole) => {
  switch (role) {
    case "admin":     return <Crown  className="h-3 w-3 text-yellow-500" />;
    case "moderator": return <Pencil className="h-3 w-3 text-blue-500" />;
    default:          return <Eye    className="h-3 w-3 text-slate-400" />;
  }
};

export const getRoleBadgeVariant = (role: AppRole): "default" | "secondary" | "destructive" | "outline" => {
  switch (role) {
    case "admin":     return "destructive";
    case "moderator": return "default";
    default:          return "secondary";
  }
};

export const getRoleLabel = (role: AppRole) => {
  switch (role) {
    case "admin":     return "Admin";
    case "moderator": return "Moderador";
    default:          return "Usuário";
  }
};
