import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";

export interface UserScope {
  isAdmin: boolean;
  isFornecedorUser: boolean;
  fornecedor: string | null;
  loading: boolean;
}

const adminCache = new Map<string, boolean>();

export const useUserScope = (): UserScope => {
  const { user, isAuthenticated } = useAuthStatus();
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !user) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }
    if (adminCache.has(user.id)) {
      setIsAdmin(adminCache.get(user.id) === true);
      setAdminLoading(false);
      return;
    }
    setAdminLoading(true);
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;
      const value = !error && data === true;
      adminCache.set(user.id, value);
      setIsAdmin(value);
      setAdminLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  return {
    isAdmin,
    isFornecedorUser,
    fornecedor,
    loading: fornLoading || adminLoading,
  };
};
