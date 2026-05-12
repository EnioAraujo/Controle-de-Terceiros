import { useCallback, useEffect, useState } from "react";
import { supabase, authReady } from "@/lib/supabase";
import type { Pessoa } from "@/types/hierarquia";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";

interface PessoaRow { id: number; nome: string; cargo: string; fornecedor: string }

export interface UpsertItem { nome: string; cargo: string }

export interface TerceirosDoFornecedorApi {
  pessoas: Pessoa[];
  loading: boolean;
  reload: () => Promise<void>;
  addPessoa:    (nome: string, cargo: string) => Promise<void>;
  updatePessoa: (id: number, partial: Partial<Pick<Pessoa, "nome" | "cargo">>) => Promise<void>;
  deletePessoa: (id: number) => Promise<void>;
  upsertMany:   (itens: UpsertItem[]) => Promise<{ inseridos: number }>;
}

export const useTerceirosDoFornecedor = (): TerceirosDoFornecedorApi => {
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isFornecedorUser || !fornecedor) {
      setPessoas([]);
      setLoading(false);
      return;
    }
    await authReady;
    const { data, error } = await supabase
      .from("terceiros")
      .select("id, nome, cargo, fornecedor")
      .eq("fornecedor", fornecedor);
    if (error) {
      if (import.meta.env.DEV) console.error("[useTerceirosDoFornecedor]", error.message);
      setPessoas([]);
      setLoading(false);
      return;
    }
    const lista = ((data ?? []) as PessoaRow[])
      .map(p => ({ id: p.id, nome: p.nome, cargo: p.cargo ?? "", fornecedor: p.fornecedor ?? "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    setPessoas(lista);
    setLoading(false);
  }, [fornecedor, isFornecedorUser]);

  useEffect(() => {
    if (fornLoading) return;
    reload().catch(err => {
      if (import.meta.env.DEV) console.error(err);
      setLoading(false);
    });
  }, [fornLoading, reload]);

  const requireFornecedor = useCallback((): string => {
    if (!fornecedor) throw new Error("Usuário não está vinculado a um fornecedor.");
    return fornecedor;
  }, [fornecedor]);

  const wrap = useCallback(async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op();
    if (error) {
      if (import.meta.env.DEV) console.error(error.message);
      throw new Error(error.message);
    }
    await reload();
  }, [reload]);

  return {
    pessoas,
    loading: fornLoading || loading,
    reload,
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
      const { data, error } = await supabase
        .from("terceiros")
        .upsert(rows, { onConflict: "nome,fornecedor" })
        .select("id");
      if (error) {
        if (import.meta.env.DEV) console.error(error.message);
        throw new Error(error.message);
      }
      await reload();
      return { inseridos: data?.length ?? 0 };
    },
  };
};
