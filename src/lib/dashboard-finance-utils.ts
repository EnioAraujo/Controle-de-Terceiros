import type { Registro } from "@/types/attendance";
import { resolverDiaria, calcularValorDia, type DiariaConfig, type TurnoConfig } from "@/lib/fechamento-utils";

export interface FechamentoValorFinalDashboard {
  registroId: string | null;
  fornecedor: string;
  nome: string;
  data: string;
  turno: string;
  horas: string;
  valorCalculado: number;
  atualizadoEm?: string | null;
  criadoEm?: string | null;
}

interface DashboardFinanceParams {
  registros: Registro[];
  turnos: string[];
  periodLabels: string[];
  diariasConfig: DiariaConfig[];
  turnosConfig: TurnoConfig[];
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

const montarChaveFallback = ({
  fornecedor,
  nome,
  data,
  turno,
  horas,
}: {
  fornecedor: string;
  nome: string;
  data: string;
  turno: string;
  horas: string;
}) => [fornecedor, nome, data, turno, horas].join("|");

export const criarMapaCustosFinais = (valores: FechamentoValorFinalDashboard[]) => {
  const latestByRegistro = new Map<string, FechamentoValorFinalDashboard>();

  valores.forEach((valor) => {
    const key = valor.registroId
      ? `id:${valor.registroId}`
      : `fallback:${montarChaveFallback(valor)}`;

    const current = latestByRegistro.get(key);
    if (!current || getReferenciaMaisRecente(valor) >= getReferenciaMaisRecente(current)) {
      latestByRegistro.set(key, valor);
    }
  });

  return new Map(
    Array.from(latestByRegistro.entries()).map(([registroId, valor]) => [registroId, roundCurrency(valor.valorCalculado)]),
  );
};

export const resolverCustoDashboard = (
  registro: Registro,
  diariasConfig: DiariaConfig[],
  turnosConfig: TurnoConfig[],
  custosFinaisMap: Map<string, number>,
) => {
  const custoFechamento =
    custosFinaisMap.get(`id:${registro.id}`) ??
    custosFinaisMap.get(`fallback:${montarChaveFallback({
      fornecedor: registro.fornecedor,
      nome: registro.nome,
      data: registro.data,
      turno: registro.turno,
      horas: registro.totalHoras,
    })}`);

  if (custoFechamento !== undefined) return custoFechamento;

  return calcularValorDia(
    registro.totalHoras,
    registro.turno,
    registro.fornecedor,
    diariasConfig,
    turnosConfig,
    registro.data,
  ).valorCalculado;
};

export const montarFinanceiroDashboard = ({
  registros,
  turnos,
  periodLabels,
  diariasConfig,
  turnosConfig,
  fechamentoValores,
}: DashboardFinanceParams): DashboardFinanceData => {
  const custosFinaisMap = criarMapaCustosFinais(fechamentoValores);
  const custosPorFornecedorMap = new Map<string, { presencas: number; totalCusto: number }>();

  registros.forEach((registro) => {
    const fornecedor = registro.fornecedor || "—";
    const custo = resolverCustoDashboard(registro, diariasConfig, turnosConfig, custosFinaisMap);
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
        grupo.reduce((acc, registro) => acc + resolverCustoDashboard(registro, diariasConfig, turnosConfig, custosFinaisMap), 0),
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
