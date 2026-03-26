import { useState, useCallback, useRef, useEffect } from "react";
import { Opcoes, OPCOES_DEFAULT } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";

export const useOpcoes = (): [Opcoes, (val: Opcoes) => void, boolean] => {
  const [data, setData]       = useState<Opcoes>(OPCOES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const prevRef               = useRef<Opcoes>(OPCOES_DEFAULT);

  useEffect(() => {
    authReady.then(async () => {
      // Carrega opções (sem nomes) e nomes em paralelo
      const [opcoesRes, nomesRes] = await Promise.all([
        supabase.from("opcoes").select("chave, valor").neq("chave", "nomes").order("id", { ascending: true }),
        supabase.from("terceiros").select("nome").order("nome", { ascending: true }),
      ]);

      // Limpeza: remove nomes residuais da tabela opcoes (devem estar apenas em terceiros)
      supabase.from("opcoes").delete().eq("chave", "nomes")
        .then(({ error }) => { if (error) console.error("Erro ao limpar nomes residuais:", error.message); })
        .catch((err: unknown) => console.error("Erro ao limpar nomes residuais:", err));

      if (opcoesRes.error) console.error("Erro ao carregar opções:", opcoesRes.error.message);
      if (nomesRes.error)  console.error("Erro ao carregar nomes:", nomesRes.error.message);

      const rows  = opcoesRes.data ?? [];
      const nomes = (nomesRes.data ?? []).map((r: { nome: string }) => r.nome);

      const byKey = new Map<string, string[]>();
      (rows as { chave: string; valor: string }[]).forEach(row => {
        if (!byKey.has(row.chave)) byKey.set(row.chave, []);
        byKey.get(row.chave)!.push(row.valor);
      });

      const built: Opcoes = { turnos: [], unidades: [], fornecedores: [], motivos: [], cargos: [], ccList: [], nomes: [] };
      byKey.forEach((vals, k) => {
        if (k !== "nomes" && k in built) {
          Object.assign(built, { [k]: vals });
        }
      });
      built.nomes = nomes;

      setData(built);
      prevRef.current = built;
      setLoading(false);
    }).catch((err: unknown) => {
      console.error("Erro ao carregar opções:", err);
      setLoading(false);
    });
  }, []);

  const save = useCallback((newVal: Opcoes) => {
    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    // ── Salva opções (excepto nomes, que têm tabela própria) ──
    const KEYS = (Object.keys(newVal) as (keyof Opcoes)[]).filter(k => k !== "nomes");
    for (const key of KEYS) {
      const prevList = prev[key] as string[];
      const nextList = newVal[key] as string[];
      if (JSON.stringify(prevList) === JSON.stringify(nextList)) continue;

      const toAdd    = nextList.filter(v => !prevList.includes(v));
      const toRemove = prevList.filter(v => !nextList.includes(v));

      if (toAdd.length > 0) {
        const CHUNK = 100;
        (async () => {
          for (let i = 0; i < toAdd.length; i += CHUNK) {
            const batch = toAdd.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("opcoes")
              .upsert(batch.map(valor => ({ chave: key, valor })), { onConflict: "chave,valor", ignoreDuplicates: true });
            if (error) { console.error(`Erro ao inserir opções [${key}]:`, error.message); break; }
          }
        })().catch((err: unknown) => console.error(`Erro ao inserir opções [${key}]:`, err));
      }
      if (toRemove.length > 0) {
        supabase.from("opcoes").delete().eq("chave", key).in("valor", toRemove)
          .then(({ error }) => { if (error) console.error(`Erro ao remover opções [${key}]:`, error.message); })
          .catch((err: unknown) => console.error(`Erro ao remover opções [${key}]:`, err));
      }
    }

    // ── Salva nomes na tabela terceiros ──
    const prevNomes = prev.nomes;
    const nextNomes = newVal.nomes;
    if (JSON.stringify(prevNomes) !== JSON.stringify(nextNomes)) {
      const toAdd    = nextNomes.filter(v => !prevNomes.includes(v));
      const toRemove = prevNomes.filter(v => !nextNomes.includes(v));

      if (toAdd.length > 0) {
        const CHUNK = 100;
        (async () => {
          for (let i = 0; i < toAdd.length; i += CHUNK) {
            const batch = toAdd.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("terceiros")
              .upsert(batch.map(nome => ({ nome })), { onConflict: "nome", ignoreDuplicates: true });
            if (error) { console.error("Erro ao inserir nomes:", error.message); break; }
          }
        })().catch((err: unknown) => console.error("Erro ao inserir nomes:", err));
      }
      if (toRemove.length > 0) {
        supabase.from("terceiros").delete().in("nome", toRemove)
          .then(({ error }) => { if (error) console.error("Erro ao remover nomes:", error.message); })
          .catch((err: unknown) => console.error("Erro ao remover nomes:", err));
      }
    }
  }, []);

  return [data, save, loading];
};
