import { supabase } from "@/lib/supabase";

export interface FechamentoValorFinalDashboardOutput {
  registroId: string | null;
  fornecedor: string;
  nome: string;
  data: string;
  turno: string;
  horas: string;
  valorCalculado: number;
  atualizadoEm: string | null;
  criadoEm: string | null;
}

export interface FechamentoAprovadoCabecalho {
  id: string;
  fornecedor: string;
  data_inicio: string;
  data_fim: string;
  status: "rascunho" | "enviado" | "revisao" | "aprovado";
  updated_at: string | null;
  created_at: string | null;
}

const getReferenciaMaisRecente = (fechamento: FechamentoAprovadoCabecalho) =>
  fechamento.updated_at ?? fechamento.created_at ?? "";

const periodosSobrepoem = (
  fechamento: Pick<FechamentoAprovadoCabecalho, "data_inicio" | "data_fim">,
  dataInicio: string,
  dataFim: string,
) => fechamento.data_inicio <= dataFim && fechamento.data_fim >= dataInicio;

export const selecionarFechamentosAprovadosCanonicos = (
  fechamentos: FechamentoAprovadoCabecalho[],
  dataInicio: string,
  dataFim: string,
): FechamentoAprovadoCabecalho[] => {
  const canonicosPorPeriodo = new Map<string, FechamentoAprovadoCabecalho>();

  fechamentos
    .filter((f) => f.status === "aprovado")
    .filter((f) => periodosSobrepoem(f, dataInicio, dataFim))
    .forEach((f) => {
      const key = `${f.fornecedor}|${f.data_inicio}|${f.data_fim}`;
      const atual = canonicosPorPeriodo.get(key);

      if (!atual || getReferenciaMaisRecente(f) > getReferenciaMaisRecente(atual)) {
        canonicosPorPeriodo.set(key, f);
      }
    });

  return Array.from(canonicosPorPeriodo.values());
};

export async function buscarValoresFinaisFechamentoAprovadoPorPeriodo(
  dataInicio: string,
  dataFim: string,
): Promise<{ success: boolean; data?: FechamentoValorFinalDashboardOutput[]; error?: string }> {
  try {
    const { data: fechamentosData, error: fechamentosError } = await supabase
      .from("fechamentos")
      .select("id, fornecedor, data_inicio, data_fim, status, updated_at, created_at")
      .eq("status", "aprovado")
      .lte("data_inicio", dataFim)
      .gte("data_fim", dataInicio);

    if (fechamentosError) {
      return { success: false, error: fechamentosError.message };
    }

    const canonicos = selecionarFechamentosAprovadosCanonicos(
      (fechamentosData ?? []) as FechamentoAprovadoCabecalho[],
      dataInicio,
      dataFim,
    );

    if (canonicos.length === 0) {
      return { success: true, data: [] };
    }

    const metadadosPorFechamentoId = new Map(
      canonicos.map((f) => [
        f.id,
        {
          fornecedor: f.fornecedor,
          atualizadoEm: f.updated_at,
          criadoEm: f.created_at,
        },
      ]),
    );

    const idsCanonicos = canonicos.map((f) => f.id);

    const { data: itensData, error: itensError } = await supabase
      .from("fechamento_itens")
      .select("fechamento_id, registro_id, nome, data, turno, horas, valor_calculado")
      .in("fechamento_id", idsCanonicos)
      .gte("data", dataInicio)
      .lte("data", dataFim);

    if (itensError) {
      return { success: false, error: itensError.message };
    }

    const normalized = ((itensData ?? []) as Array<{
      fechamento_id: string;
      registro_id: string | null;
      nome: string;
      data: string;
      turno: string;
      horas: string;
      valor_calculado: number;
    }>)
      .map((item) => {
        const meta = metadadosPorFechamentoId.get(item.fechamento_id);

        if (!meta) return null;

        return {
          registroId: item.registro_id,
          fornecedor: meta.fornecedor,
          nome: item.nome,
          data: item.data,
          turno: item.turno,
          horas: item.horas,
          valorCalculado: Number(item.valor_calculado),
          atualizadoEm: meta.atualizadoEm,
          criadoEm: meta.criadoEm,
        };
      })
      .filter((item): item is FechamentoValorFinalDashboardOutput => item !== null);

    return { success: true, data: normalized };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API_FECHAMENTO_DASHBOARD] Erro inesperado:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
