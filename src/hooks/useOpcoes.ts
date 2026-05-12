import { useState, useCallback, useRef, useEffect } from "react";
import { Opcoes, OPCOES_DEFAULT } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";

const CHUNK = 100;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Aplica diff entre prevList e nextList usando upsert/remove fornecidos. */
async function syncList(
  prevList: string[],
  nextList: string[],
  upsert: (batch: string[]) => Promise<{ error: { message: string } | null }>,
  remove: (items: string[]) => Promise<{ error: { message: string } | null }>,
  label: string,
): Promise<void> {
  if (JSON.stringify(prevList) === JSON.stringify(nextList)) return;
  const toAdd    = nextList.filter(v => !prevList.includes(v));
  const toRemove = prevList.filter(v => !nextList.includes(v));
  if (toAdd.length > 0) {
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const { error } = await upsert(toAdd.slice(i, i + CHUNK));
      if (error) { if (import.meta.env.DEV) console.error(`Erro ao inserir ${label}:`, error.message); break; }
    }
  }
  if (toRemove.length > 0) {
    const { error } = await remove(toRemove);
    if (error) if (import.meta.env.DEV) console.error(`Erro ao remover ${label}:`, error.message);
  }
}

export const useOpcoes = (): [Opcoes, (val: Opcoes) => void, boolean, string | null] => {
  const [data, setData]       = useState<Opcoes>(OPCOES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const prevRef               = useRef<Opcoes>(OPCOES_DEFAULT);

  useEffect(() => {
    let cancelled = false;

    const loadOnce = async () => {
      // Carrega opções (sem nomes) e nomes em paralelo
      const [opcoesRes, nomesRes] = await Promise.all([
        supabase.from("opcoes").select("chave, valor").neq("chave", "nomes").order("id", { ascending: true }),
        supabase.from("terceiros").select("nome").order("nome", { ascending: true }),
      ]);
      if (opcoesRes.error) throw new Error(opcoesRes.error.message);
      if (nomesRes.error) throw new Error(nomesRes.error.message);
      return { opcoesRes, nomesRes };
    };

    authReady.then(async () => {
      // Retry com backoff exponencial 500ms / 1s / 2s — 3 tentativas.
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { opcoesRes, nomesRes } = await loadOnce();
          if (cancelled) return;

          // Limpeza: remove nomes residuais da tabela opcoes (não bloqueia)
          supabase.from("opcoes").delete().eq("chave", "nomes")
            .then(({ error }) => { if (error) if (import.meta.env.DEV) console.error("Erro ao limpar nomes residuais:", error.message); })
            .catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao limpar nomes residuais:", err); });

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
          setError(null);
          setLoading(false);
          return;
        } catch (err: unknown) {
          lastErr = err;
          if (import.meta.env.DEV) console.error(`[useOpcoes] tentativa ${attempt}:`, err);
          if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
        }
      }
      if (cancelled) return;
      // 3 tentativas falharam — mantém OPCOES_DEFAULT e expõe erro.
      setError(lastErr instanceof Error ? lastErr.message : String(lastErr ?? "Falha ao carregar opções."));
      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      if (import.meta.env.DEV) console.error("Erro ao carregar opções:", err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const save = useCallback((newVal: Opcoes) => {
    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    // ── Salva opções (excepto nomes, que têm tabela própria) ──
    const KEYS = (Object.keys(newVal) as (keyof Opcoes)[]).filter(k => k !== "nomes");
    for (const key of KEYS) {
      syncList(
        prev[key] as string[],
        newVal[key] as string[],
        batch => supabase.from("opcoes").upsert(batch.map(valor => ({ chave: key, valor })), { onConflict: "chave,valor", ignoreDuplicates: true }),
        items  => supabase.from("opcoes").delete().eq("chave", key).in("valor", items),
        `opcoes[${key}]`,
      ).catch((err: unknown) => { if (import.meta.env.DEV) console.error(`Erro ao sincronizar opcoes[${key}]:`, err); });
    }

    // ── Salva nomes na tabela terceiros ──
    syncList(
      prev.nomes,
      newVal.nomes,
      batch => supabase.from("terceiros").upsert(batch.map(nome => ({ nome })), { onConflict: "nome", ignoreDuplicates: true }),
      items  => supabase.from("terceiros").delete().in("nome", items),
      "nomes",
    ).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao sincronizar nomes:", err); });
  }, []);

  return [data, save, loading, error];
};
