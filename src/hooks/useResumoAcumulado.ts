import { useCallback, useEffect, useState } from "react";
import { supabase, authReady } from "@/lib/supabase";
import {
  agruparPorPessoa,
  calcularTotal,
  dbToDiariaConfig,
  dbToTurnoConfig,
  gerarItensFechamento,
  type DiariaConfig,
  type ResumoPessoa,
  type TurnoConfig,
} from "@/lib/fechamento-utils";

interface RegistroRow {
  id: string;
  nome: string;
  data: string;
  turno: string;
  total_horas: string;
  fornecedor: string;
}

interface RegistroNormalizado {
  id: string;
  nome: string;
  data: string;
  turno: string;
  totalHoras: string;
  fornecedor: string;
}

export interface ResumoAcumuladoApi {
  resumo: ResumoPessoa[];
  total: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const useResumoAcumulado = (
  fornecedor: string | null | undefined,
  inicio: string,
  fim: string,
): ResumoAcumuladoApi => {
  const [resumo, setResumo] = useState<ResumoPessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fornecedor || !inicio || !fim) {
      setResumo([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }
    await authReady;
    setLoading(true);

    let lastErr: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const [regRes, turnosRes, diariasRes] = await Promise.all([
        supabase
          .from("registros")
          .select("id, nome, data, turno, total_horas, fornecedor")
          .eq("fornecedor", fornecedor)
          .gte("data", inicio)
          .lte("data", fim),
        supabase.from("turnos_config").select("*"),
        supabase.from("diarias_config").select("*").eq("fornecedor", fornecedor),
      ]);

      const firstErr = regRes.error ?? turnosRes.error ?? diariasRes.error;
      if (!firstErr) {
        const registros: RegistroNormalizado[] = ((regRes.data ?? []) as RegistroRow[]).map(r => ({
          id: r.id,
          nome: r.nome,
          data: r.data,
          turno: r.turno,
          totalHoras: r.total_horas,
          fornecedor: r.fornecedor,
        }));
        const turnosConfig: TurnoConfig[] = (turnosRes.data ?? []).map(dbToTurnoConfig);
        const diariasConfig: DiariaConfig[] = (diariasRes.data ?? []).map(dbToDiariaConfig);

        const itens = gerarItensFechamento(registros, diariasConfig, turnosConfig);
        setResumo(agruparPorPessoa(itens));
        setTotal(calcularTotal(itens));
        setError(null);
        setLoading(false);
        return;
      }
      lastErr = firstErr.message;
      if (import.meta.env.DEV) console.error(`[useResumoAcumulado] tentativa ${attempt}:`, lastErr);
      if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
    }
    setError(lastErr ?? "Falha ao carregar resumo.");
    setLoading(false);
  }, [fornecedor, inicio, fim]);

  useEffect(() => {
    load().catch(err => {
      if (import.meta.env.DEV) console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });
  }, [load]);

  return { resumo, total, loading, error, reload: load };
};
