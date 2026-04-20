/**
 * Funções puras para cálculo de excedentes por turno/dia.
 *
 * Regras de negócio:
 * - Um turno pode ter uma quantidade padrão configurada com período de vigência.
 * - Excedente = max(0, total_pessoas_no_turno_dia - qtd_padrao)
 * - Se não há configuração para o turno/data: limite null, excedente 0.
 */

import type { TurnoCapacidade } from "@/lib/fechamento-utils";

// ─── TIPOS ───────────────────────────────────────────────────

export interface ExcedenteInfo {
  total: number;
  limite: number | null;
  excedente: number;
}

export interface LinhaRelatorioExcedente {
  data: string;           // YYYY-MM-DD
  turno: string;
  capacidade: number | null;
  total: number;
  excedente: number;
}

// ─── RESOLUÇÃO DE CAPACIDADE ─────────────────────────────────

/**
 * Retorna a capacidade padrão configurada para o turno na data informada.
 * Seleciona a primeira configuração cuja vigência cobre a data.
 * Retorna null se nenhuma configuração cobrir o turno/data.
 */
export const resolverCapacidade = (
  turno: string,
  data: string,
  configs: TurnoCapacidade[],
): number | null => {
  const match = configs.find(
    c => c.turno === turno && data >= c.vigenciaInicio && data <= c.vigenciaFim,
  );
  return match?.qtdPadrao ?? null;
};

// ─── CÁLCULO DE EXCEDENTE POR DIA/TURNO ─────────────────────

/**
 * Calcula os excedentes agrupados por (data, turno).
 * Chave do mapa: "YYYY-MM-DD|TURNO"
 */
export const calcExcedentePorTurnoDia = (
  registros: { data: string; turno: string }[],
  configs: TurnoCapacidade[],
): Map<string, ExcedenteInfo> => {
  const counts = new Map<string, number>();
  for (const r of registros) {
    const key = `${r.data}|${r.turno}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result = new Map<string, ExcedenteInfo>();
  for (const [key, total] of counts.entries()) {
    const sep = key.indexOf("|");
    const data = key.slice(0, sep);
    const turno = key.slice(sep + 1);
    const limite = resolverCapacidade(turno, data, configs);
    const excedente = limite !== null ? Math.max(0, total - limite) : 0;
    result.set(key, { total, limite, excedente });
  }
  return result;
};

// ─── GERAÇÃO DE DADOS PARA RELATÓRIO ────────────────────────

/**
 * Gera as linhas do relatório de excedentes filtradas por período e turno/dia.
 * Inclui apenas linhas onde existe configuração de capacidade para o turno.
 * Ordenado por data asc, depois turno asc.
 */
export const gerarDadosRelatorioExcedentes = (
  registros: { data: string; turno: string }[],
  configs: TurnoCapacidade[],
): LinhaRelatorioExcedente[] => {
  const mapa = calcExcedentePorTurnoDia(registros, configs);
  return Array.from(mapa.entries())
    .filter(([, info]) => info.limite !== null)
    .map(([key, info]) => {
      const sep = key.indexOf("|");
      const data = key.slice(0, sep);
      const turno = key.slice(sep + 1);
      return {
        data,
        turno,
        capacidade: info.limite,
        total: info.total,
        excedente: info.excedente,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.turno.localeCompare(b.turno));
};
