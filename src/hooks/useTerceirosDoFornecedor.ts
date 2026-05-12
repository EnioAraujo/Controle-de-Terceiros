import { useCallback, useEffect, useState } from "react";
import { supabase, authReady } from "@/lib/supabase";
import type { Pessoa } from "@/types/hierarquia";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";

interface PessoaRow { id: number; nome: string; cargo: string; fornecedor: string }

export interface UpsertItem { nome: string; cargo: string }

export interface TerceirosDoFornecedorApi {
  pessoas: Pessoa[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  retry: () => Promise<void>;
  addPessoa:    (nome: string, cargo: string) => Promise<void>;
  updatePessoa: (id: number, partial: Partial<Pick<Pessoa, "nome" | "cargo">>) => Promise<void>;
  deletePessoa: (id: number) => Promise<void>;
  upsertMany:   (itens: UpsertItem[]) => Promise<{ inseridos: number }>;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const useTerceirosDoFornecedor = (): TerceirosDoFornecedorApi => {
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isFornecedorUser || !fornecedor) {
      setPessoas([]);
      setLoading(false);
      setError(null);
      return;
    }
    await authReady;
    // Retry com backoff exponencial 500ms / 1s / 2s — 3 tentativas.
    let lastErr: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error: queryErr } = await supabase
        .from("terceiros")
        .select("id, nome, cargo, fornecedor")
        .eq("fornecedor", fornecedor);
      if (!queryErr) {
        const lista = ((data ?? []) as PessoaRow[])
          .map(p => ({ id: p.id, nome: p.nome, cargo: p.cargo ?? "", fornecedor: p.fornecedor ?? "" }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setPessoas(lista);
        setError(null);
        setLoading(false);
        return;
      }
      lastErr = queryErr.message;
      if (import.meta.env.DEV) console.error(`[useTerceirosDoFornecedor] tentativa ${attempt}:`, lastErr);
      if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }
    // 3 tentativas falharam — preserva último snapshot (NÃO zera pessoas) e expõe erro.
    setError(lastErr ?? "Falha ao carregar funcionários.");
    setLoading(false);
  }, [fornecedor, isFornecedorUser]);

  useEffect(() => {
    if (fornLoading) return;
    reload().catch(err => {
      if (import.meta.env.DEV) console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });
  }, [fornLoading, reload]);

  const requireFornecedor = useCallback((): string => {
    if (!fornecedor) throw new Error("Usuário não está vinculado a um fornecedor.");
    return fornecedor;
  }, [fornecedor]);

  const wrap = useCallback(async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error: opErr } = await op();
    if (opErr) {
      if (import.meta.env.DEV) console.error(opErr.message);
      throw new Error(opErr.message);
    }
    await reload();
  }, [reload]);

  return {
    pessoas,
    loading: fornLoading || loading,
    error,
    reload,
    retry: reload,
    addPessoa: (nome, cargo) => {
      const f = requireFornecedor();
      return wrap(() => supabase.from("terceiros").insert({ nome, cargo, fornecedor: f }));
    },
    updatePessoa: (id, partial) =>
      wrap(() => supabase.from("terceiros").update(partial).eq("id", id)),
    deletePessoa: id =>
      wrap(() => supabase.from("terceiros").delete().eq("id", id)),
    upsertMany: async (itens) => {
      const f = requireFornecedor();
      const rows = itens.map(it => ({ nome: it.nome, cargo: it.cargo, fornecedor: f }));
      const { data, error: upErr } = await supabase
        .from("terceiros")
        .upsert(rows, { onConflict: "nome,fornecedor" })
        .select("id");
      if (upErr) {
        if (import.meta.env.DEV) console.error(upErr.message);
        throw new Error(upErr.message);
      }
      await reload();
      return { inseridos: data?.length ?? 0 };
    },
  };
};
