import { useCallback, useEffect, useState } from "react";
import { supabase, authReady } from "@/lib/supabase";
import type { Hierarquia, Pessoa, Unidade } from "@/types/hierarquia";
import { HIERARQUIA_DEFAULT } from "@/types/hierarquia";

interface UnidadeRow  { id: number; nome: string }
interface CCRow       { id: number; unidade_id: number; codigo: string }
interface OperacaoRow { id: number; cc_id: number; nome: string }
interface PessoaRow   { id: number; nome: string; cargo: string; fornecedor: string }

function buildHierarquia(
  unidades: UnidadeRow[],
  ccs: CCRow[],
  operacoes: OperacaoRow[],
  pessoas: PessoaRow[],
): Hierarquia {
  const opsByCc = new Map<number, { id: number; ccId: number; nome: string }[]>();
  operacoes.forEach(op => {
    if (!opsByCc.has(op.cc_id)) opsByCc.set(op.cc_id, []);
    opsByCc.get(op.cc_id)!.push({ id: op.id, ccId: op.cc_id, nome: op.nome });
  });

  const ccsByUnidade = new Map<number, { id: number; unidadeId: number; codigo: string; operacoes: { id: number; ccId: number; nome: string }[] }[]>();
  ccs.forEach(c => {
    if (!ccsByUnidade.has(c.unidade_id)) ccsByUnidade.set(c.unidade_id, []);
    ccsByUnidade.get(c.unidade_id)!.push({
      id: c.id, unidadeId: c.unidade_id, codigo: c.codigo,
      operacoes: (opsByCc.get(c.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  });

  const unidadeList: Unidade[] = unidades.map(u => ({
    id: u.id, nome: u.nome,
    ccs: (ccsByUnidade.get(u.id) ?? []).sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const pessoaList: Pessoa[] = pessoas.map(p => ({
    id: p.id, nome: p.nome, cargo: p.cargo ?? "", fornecedor: p.fornecedor ?? "",
  })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { unidades: unidadeList, pessoas: pessoaList };
}

export interface HierarquiaApi {
  hierarquia: Hierarquia;
  loading: boolean;
  reload: () => Promise<void>;
  addUnidade:    (nome: string) => Promise<void>;
  renameUnidade: (id: number, nome: string) => Promise<void>;
  deleteUnidade: (id: number) => Promise<void>;
  addCC:    (unidadeId: number, codigo: string) => Promise<void>;
  renameCC: (id: number, codigo: string) => Promise<void>;
  deleteCC: (id: number) => Promise<void>;
  addOperacao:    (ccId: number, nome: string) => Promise<void>;
  renameOperacao: (id: number, nome: string) => Promise<void>;
  deleteOperacao: (id: number) => Promise<void>;
  addPessoa:    (p: Omit<Pessoa, "id">) => Promise<void>;
  updatePessoa: (id: number, p: Partial<Omit<Pessoa, "id">>) => Promise<void>;
  deletePessoa: (id: number) => Promise<void>;
}

export const useHierarquia = (): HierarquiaApi => {
  const [hierarquia, setHierarquia] = useState<Hierarquia>(HIERARQUIA_DEFAULT);
  const [loading, setLoading]       = useState(true);

  const reload = useCallback(async () => {
    await authReady;
    const [unidadesRes, ccsRes, opsRes, pessoasRes] = await Promise.all([
      supabase.from("unidades").select("id, nome"),
      supabase.from("ccs").select("id, unidade_id, codigo"),
      supabase.from("operacoes").select("id, cc_id, nome"),
      supabase.from("terceiros").select("id, nome, cargo, fornecedor"),
    ]);
    if (import.meta.env.DEV) {
      [unidadesRes, ccsRes, opsRes, pessoasRes].forEach(r => {
        if (r.error) console.error("Erro hierarquia:", r.error.message);
      });
    }
    setHierarquia(buildHierarquia(
      (unidadesRes.data ?? []) as UnidadeRow[],
      (ccsRes.data      ?? []) as CCRow[],
      (opsRes.data      ?? []) as OperacaoRow[],
      (pessoasRes.data  ?? []) as PessoaRow[],
    ));
    setLoading(false);
  }, []);

  useEffect(() => { reload().catch(err => { if (import.meta.env.DEV) console.error(err); setLoading(false); }); }, [reload]);

  const wrap = useCallback(async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op();
    if (error) { if (import.meta.env.DEV) console.error(error.message); throw new Error(error.message); }
    await reload();
  }, [reload]);

  return {
    hierarquia,
    loading,
    reload,
    addUnidade:    nome     => wrap(() => supabase.from("unidades").insert({ nome })),
    renameUnidade: (id, n)  => wrap(() => supabase.from("unidades").update({ nome: n }).eq("id", id)),
    deleteUnidade: id       => wrap(() => supabase.from("unidades").delete().eq("id", id)),
    addCC:         (u, c)   => wrap(() => supabase.from("ccs").insert({ unidade_id: u, codigo: c })),
    renameCC:      (id, c)  => wrap(() => supabase.from("ccs").update({ codigo: c }).eq("id", id)),
    deleteCC:      id       => wrap(() => supabase.from("ccs").delete().eq("id", id)),
    addOperacao:    (cc, n) => wrap(() => supabase.from("operacoes").insert({ cc_id: cc, nome: n })),
    renameOperacao: (id, n) => wrap(() => supabase.from("operacoes").update({ nome: n }).eq("id", id)),
    deleteOperacao: id      => wrap(() => supabase.from("operacoes").delete().eq("id", id)),
    addPessoa:    p        => wrap(() => supabase.from("terceiros").insert({ nome: p.nome, cargo: p.cargo, fornecedor: p.fornecedor })),
    updatePessoa: (id, p)  => wrap(() => supabase.from("terceiros").update(p).eq("id", id)),
    deletePessoa: id       => wrap(() => supabase.from("terceiros").delete().eq("id", id)),
  };
};
