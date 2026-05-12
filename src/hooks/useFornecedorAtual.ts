import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export interface FornecedorAtual {
  fornecedor: string | null;
  isFornecedorUser: boolean;
  loading: boolean;
}

const cache = new Map<string, string | null>();

export const useFornecedorAtual = (): FornecedorAtual => {
  const { user, isAuthenticated } = useAuthStatus();
  const [fornecedor, setFornecedor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !user) {
      setFornecedor(null);
      setLoading(false);
      return;
    }

    if (cache.has(user.id)) {
      setFornecedor(cache.get(user.id) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("fornecedor")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const value = (data?.fornecedor as string | null) ?? null;
        cache.set(user.id, value);
        setFornecedor(value);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  return {
    fornecedor,
    isFornecedorUser: fornecedor !== null && fornecedor.trim().length > 0,
    loading,
  };
};
