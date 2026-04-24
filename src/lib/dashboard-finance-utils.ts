import type { Registro } from "@/types/attendance";
import { resolverDiaria, type DiariaConfig } from "@/lib/fechamento-utils";

export interface FechamentoValorFinalDashboard {
  registroId: string;
  data: string;
  valorCalculado: number;
  atualizadoEm?: string | null;
  criadoEm?: string | null;
}

interface DashboardFinanceParams {
  registros: Registro[];
  turnos: string[];
  periodLabels: string[];
  diariasConfig: DiariaConfig[];
  fechamentoValores: FechamentoValorFinalDashboard[];
}

interface DashboardFinanceFornecedor {
  fornecedor: string;
  presencas: number;
  totalCusto: number;
  avgCusto: number;
}

export interface DashboardFinancePeriodo extends Record<string, string | number> {
  periodo: string;
  _total: number;
  _custo: number;
}

export interface DashboardFinanceData {
  custosPorFornecedor: DashboardFinanceFornecedor[];
  dadosPeriodo: DashboardFinancePeriodo[];
  totalCusto: number;
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const getReferenciaMaisRecente = (value: FechamentoValorFinalDashboard) =>
  value.atualizadoEm ?? value.criadoEm ?? "";

export const criarMapaCustosFinais = (valores: FechamentoValorFinalDashboard[]) => {
  const latestByRegistro = new Map<string, FechamentoValorFinalDashboard>();

  valores.forEach((valor) => {
    if (!valor.registroId) return;

    const current = latestByRegistro.get(valor.registroId);
    if (!current || getReferenciaMaisRecente(valor) >= getReferenciaMaisRecente(current)) {
      latestByRegistro.set(valor.registroId, valor);
    }
  });

  return new Map(
    Array.from(latestByRegistro.entries()).map(([registroId, valor]) => [registroId, roundCurrency(valor.valorCalculado)]),
  );
};

export const resolverCustoDashboard = (
  registro: Registro,
  diariasConfig: DiariaConfig[],
  custosFinaisMap: Map<string, number>,
) => custosFinaisMap.get(registro.id) ?? resolverDiaria(registro.fornecedor, registro.turno, diariasConfig, registro.data);

export const montarFinanceiroDashboard = ({
  registros,
  turnos,
  periodLabels,
  diariasConfig,
  fechamentoValores,
}: DashboardFinanceParams): DashboardFinanceData => {
  const custosFinaisMap = criarMapaCustosFinais(fechamentoValores);
  const custosPorFornecedorMap = new Map<string, { presencas: number; totalCusto: number }>();

  registros.forEach((registro) => {
    const fornecedor = registro.fornecedor || "—";
    const custo = resolverCustoDashboard(registro, diariasConfig, custosFinaisMap);
    const entry = custosPorFornecedorMap.get(fornecedor) ?? { presencas: 0, totalCusto: 0 };

    entry.presencas += 1;
    entry.totalCusto = roundCurrency(entry.totalCusto + custo);
    custosPorFornecedorMap.set(fornecedor, entry);
  });

  const grupos = [
    registros.filter((r) => {
      const dia = Number.parseInt(r.data.slice(8), 10);
      return dia <= 10;
    }),
    registros.filter((r) => {
      const dia = Number.parseInt(r.data.slice(8), 10);
      return dia >= 11 && dia <= 20;
    }),
    registros.filter((r) => {
      const dia = Number.parseInt(r.data.slice(8), 10);
      return dia >= 21;
    }),
  ];

  const dadosPeriodo = grupos.map((grupo, index) => {
    const ponto: DashboardFinancePeriodo = {
      periodo: periodLabels[index] ?? `${index + 1}`,
      _total: grupo.length,
      _custo: roundCurrency(
        grupo.reduce((acc, registro) => acc + resolverCustoDashboard(registro, diariasConfig, custosFinaisMap), 0),
      ),
    };

    turnos.forEach((turno) => {
      ponto[turno] = grupo.filter((registro) => registro.turno === turno).length;
    });

    return ponto;
  });

  const custosPorFornecedor = Array.from(custosPorFornecedorMap.entries())
    .map(([fornecedor, { presencas, totalCusto }]) => ({
      fornecedor,
      presencas,
      totalCusto,
      avgCusto: presencas > 0 ? Math.round(totalCusto / presencas) : 0,
    }))
    .sort((a, b) => b.totalCusto - a.totalCusto);

  return {
    custosPorFornecedor,
    dadosPeriodo,
    totalCusto: roundCurrency(custosPorFornecedor.reduce((acc, fornecedor) => acc + fornecedor.totalCusto, 0)),
  };
};
