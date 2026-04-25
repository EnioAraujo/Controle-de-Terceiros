import type { Registro } from "@/types/attendance";
import type { FechamentoItem } from "@/lib/fechamento-utils";

export interface LoteFornecedor {
  fornecedor: string;
  itens: FechamentoItem[];
  total: number;
}

export const filtrarRegistrosPorFornecedoresEPeriodo = (
  registros: Registro[],
  fornecedores: string[],
  dataInicio: string,
  dataFim: string,
): Registro[] => {
  if (fornecedores.length === 0 || !dataInicio || !dataFim) return [];

  return registros.filter((r) =>
    fornecedores.includes(r.fornecedor) &&
    r.data >= dataInicio &&
    r.data <= dataFim,
  );
};

export const mapearFornecedorPorRegistroId = (
  registros: Registro[],
): Record<string, string> => {
  const map: Record<string, string> = {};
  registros.forEach((r) => {
    map[r.id] = r.fornecedor;
  });
  return map;
};

export const dividirItensPorFornecedor = (
  itens: FechamentoItem[],
  fornecedoresSelecionados: string[],
  fornecedorPorRegistroId: Record<string, string>,
): LoteFornecedor[] => {
  return fornecedoresSelecionados.map((fornecedor) => {
    const itensFornecedor = itens.filter((item) => {
      if (!item.registroId) return false;
      return fornecedorPorRegistroId[item.registroId] === fornecedor;
    });

    const total = Math.round(
      itensFornecedor.reduce((acc, item) => acc + item.valorCalculado, 0) * 100,
    ) / 100;

    return {
      fornecedor,
      itens: itensFornecedor,
      total,
    };
  });
};

export const resolverFornecedorDoItem = (
  item: FechamentoItem,
  fornecedorPorRegistroId: Record<string, string>,
  fornecedoresSelecionados: string[],
): string => {
  if (item.registroId && fornecedorPorRegistroId[item.registroId]) {
    return fornecedorPorRegistroId[item.registroId];
  }

  if (fornecedoresSelecionados.length === 1) {
    return fornecedoresSelecionados[0];
  }

  return "-";
};
