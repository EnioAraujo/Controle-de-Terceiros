import { describe, expect, it } from "vitest";
import type { Registro } from "@/types/attendance";
import type { FechamentoItem } from "@/lib/fechamento-utils";
import {
  dividirItensPorFornecedor,
  filtrarRegistrosPorFornecedoresEPeriodo,
  mapearFornecedorPorRegistroId,
  resolverFornecedorDoItem,
} from "./fechamento-multifornecedor-utils";

const baseRegistros: Registro[] = [
  {
    id: "r1",
    data: "2026-04-10",
    turno: "2º TURNO",
    horaEntrada: "08:00",
    horaSaida: "12:00",
    totalHoras: "04:00",
    nome: "Alex",
    cargo: "Ajudante",
    unidade: "U1",
    cc: "100",
    motivo: "Teste",
    fornecedor: "JSS",
    obs: "",
  },
  {
    id: "r2",
    data: "2026-04-11",
    turno: "2º TURNO",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "09:00",
    nome: "Bruna",
    cargo: "Ajudante",
    unidade: "U1",
    cc: "100",
    motivo: "Teste",
    fornecedor: "LIDER MASTER",
    obs: "",
  },
  {
    id: "r3",
    data: "2026-03-11",
    turno: "2º TURNO",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "09:00",
    nome: "Caio",
    cargo: "Ajudante",
    unidade: "U1",
    cc: "100",
    motivo: "Teste",
    fornecedor: "JSS",
    obs: "",
  },
];

const baseItens: FechamentoItem[] = [
  {
    registroId: "r1",
    nome: "Alex",
    data: "2026-04-10",
    turno: "2º TURNO",
    horas: "04:00",
    valorDiaria: 250,
    valorHora: 30,
    valorCalculado: 120,
    ajusteManual: false,
    obs: "",
  },
  {
    registroId: "r2",
    nome: "Bruna",
    data: "2026-04-11",
    turno: "2º TURNO",
    horas: "09:00",
    valorDiaria: 250,
    valorHora: 30,
    valorCalculado: 250,
    ajusteManual: false,
    obs: "",
  },
];

describe("fechamento-multifornecedor-utils", () => {
  it("filtra registros por periodo e fornecedores selecionados", () => {
    const result = filtrarRegistrosPorFornecedoresEPeriodo(
      baseRegistros,
      ["JSS", "LIDER MASTER"],
      "2026-04-01",
      "2026-04-30",
    );

    expect(result.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("cria mapa de fornecedor por registro id", () => {
    const map = mapearFornecedorPorRegistroId(baseRegistros);

    expect(map.r1).toBe("JSS");
    expect(map.r2).toBe("LIDER MASTER");
  });

  it("divide itens por fornecedor com totais corretos", () => {
    const map = mapearFornecedorPorRegistroId(baseRegistros);
    const lotes = dividirItensPorFornecedor(baseItens, ["JSS", "LIDER MASTER"], map);

    expect(lotes).toHaveLength(2);
    expect(lotes[0]).toEqual({ fornecedor: "JSS", itens: [baseItens[0]], total: 120 });
    expect(lotes[1]).toEqual({ fornecedor: "LIDER MASTER", itens: [baseItens[1]], total: 250 });
  });

  it("resolve fornecedor por registroId e faz fallback quando ha apenas um selecionado", () => {
    const map = mapearFornecedorPorRegistroId(baseRegistros);

    expect(resolverFornecedorDoItem(baseItens[0], map, ["JSS", "LIDER MASTER"]))
      .toBe("JSS");

    const itemSemRegistro: FechamentoItem = {
      ...baseItens[0],
      registroId: null,
    };

    expect(resolverFornecedorDoItem(itemSemRegistro, map, ["JSS"]))
      .toBe("JSS");

    expect(resolverFornecedorDoItem(itemSemRegistro, map, ["JSS", "LIDER MASTER"]))
      .toBe("-");
  });
});
