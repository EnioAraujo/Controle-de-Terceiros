import { describe, expect, it } from "vitest";
import { montarFinanceiroDashboard, criarMapaCustosFinais } from "./dashboard-finance-utils";
import type { Registro } from "@/types/attendance";
import type { DiariaConfig } from "./fechamento-utils";

const registrosBase: Registro[] = [
  {
    id: "r1",
    data: "2026-04-05",
    turno: "1ª TURNO",
    horaEntrada: "05:21",
    horaSaida: "13:40",
    totalHoras: "08:20",
    nome: "Ana",
    cargo: "",
    setor: "",
    unidade: "",
    cc: "",
    motivo: "",
    fornecedor: "JSS",
    obs: "",
  },
  {
    id: "r2",
    data: "2026-04-12",
    turno: "2ª TURNO",
    horaEntrada: "13:41",
    horaSaida: "22:00",
    totalHoras: "08:20",
    nome: "Bruno",
    cargo: "",
    setor: "",
    unidade: "",
    cc: "",
    motivo: "",
    fornecedor: "JSS",
    obs: "",
  },
  {
    id: "r3",
    data: "2026-04-25",
    turno: "1ª TURNO",
    horaEntrada: "05:21",
    horaSaida: "13:40",
    totalHoras: "08:20",
    nome: "Caio",
    cargo: "",
    setor: "",
    unidade: "",
    cc: "",
    motivo: "",
    fornecedor: "LIDER",
    obs: "",
  },
];

const diariasConfig: DiariaConfig[] = [
  { fornecedor: "JSS", turno: "1ª TURNO", valorDiaria: 200 },
  { fornecedor: "JSS", turno: "2ª TURNO", valorDiaria: 180 },
  { fornecedor: "LIDER", turno: null, valorDiaria: 300 },
];

describe("criarMapaCustosFinais", () => {
  it("mantém o valor mais recente quando o mesmo registro aparece em mais de um fechamento", () => {
    const mapa = criarMapaCustosFinais([
      { registroId: "r1", fornecedor: "JSS", nome: "Ana", data: "2026-04-05", turno: "1ª TURNO", horas: "08:20", valorCalculado: 200, atualizadoEm: "2026-04-10T10:00:00Z" },
      { registroId: "r1", fornecedor: "JSS", nome: "Ana", data: "2026-04-05", turno: "1ª TURNO", horas: "08:20", valorCalculado: 260, atualizadoEm: "2026-04-12T10:00:00Z" },
    ]);

    expect(mapa.get("id:r1")).toBe(260);
  });

  it("usa chave de fallback quando o item salvo não tem registroId", () => {
    const mapa = criarMapaCustosFinais([
      { registroId: null, fornecedor: "LIDER MASTER", nome: "Carlos", data: "2026-04-05", turno: "1ª TURNO", horas: "08:20", valorCalculado: 240, atualizadoEm: "2026-04-12T10:00:00Z" },
    ]);

    expect(mapa.get("fallback:LIDER MASTER|Carlos|2026-04-05|1ª TURNO|08:20")).toBe(240);
  });
});

describe("montarFinanceiroDashboard", () => {
  it("usa o valor final do fechamento salvo em custo por fornecedor e custo por período", () => {
    const result = montarFinanceiroDashboard({
      registros: registrosBase,
      turnos: ["1ª TURNO", "2ª TURNO"],
      periodLabels: ["1º", "2º", "3º"],
      diariasConfig,
      fechamentoValores: [
        { registroId: "r1", fornecedor: "JSS", nome: "Ana", data: "2026-04-05", turno: "1ª TURNO", horas: "08:20", valorCalculado: 250, atualizadoEm: "2026-04-18T10:00:00Z" },
        { registroId: "r2", fornecedor: "JSS", nome: "Bruno", data: "2026-04-12", turno: "2ª TURNO", horas: "08:20", valorCalculado: 150, atualizadoEm: "2026-04-18T10:00:00Z" },
      ],
    });

    expect(result.custosPorFornecedor).toEqual([
      { fornecedor: "JSS", presencas: 2, totalCusto: 400, avgCusto: 200 },
      { fornecedor: "LIDER", presencas: 1, totalCusto: 300, avgCusto: 300 },
    ]);

    expect(result.dadosPeriodo).toEqual([
      { periodo: "1º", "1ª TURNO": 1, "2ª TURNO": 0, _total: 1, _custo: 250 },
      { periodo: "2º", "1ª TURNO": 0, "2ª TURNO": 1, _total: 1, _custo: 150 },
      { periodo: "3º", "1ª TURNO": 1, "2ª TURNO": 0, _total: 1, _custo: 300 },
    ]);

    expect(result.totalCusto).toBe(700);
  });

  it("mantém o cálculo por diária quando não existe fechamento salvo para o registro", () => {
    const result = montarFinanceiroDashboard({
      registros: registrosBase,
      turnos: ["1ª TURNO", "2ª TURNO"],
      periodLabels: ["1º", "2º", "3º"],
      diariasConfig,
      fechamentoValores: [],
    });

    expect(result.custosPorFornecedor).toEqual([
      { fornecedor: "JSS", presencas: 2, totalCusto: 380, avgCusto: 190 },
      { fornecedor: "LIDER", presencas: 1, totalCusto: 300, avgCusto: 300 },
    ]);

    expect(result.totalCusto).toBe(680);
  });

  it("aplica valor final do fechamento mesmo quando o item salvo não tem registroId", () => {
    const result = montarFinanceiroDashboard({
      registros: registrosBase,
      turnos: ["1ª TURNO", "2ª TURNO"],
      periodLabels: ["1º", "2º", "3º"],
      diariasConfig,
      fechamentoValores: [
        { registroId: null, fornecedor: "LIDER", nome: "Caio", data: "2026-04-25", turno: "1ª TURNO", horas: "08:20", valorCalculado: 240, atualizadoEm: "2026-04-18T10:00:00Z" },
      ],
    });

    expect(result.custosPorFornecedor).toEqual([
      { fornecedor: "JSS", presencas: 2, totalCusto: 380, avgCusto: 190 },
      { fornecedor: "LIDER", presencas: 1, totalCusto: 240, avgCusto: 240 },
    ]);

    expect(result.dadosPeriodo[2]).toEqual({
      periodo: "3º",
      "1ª TURNO": 1,
      "2ª TURNO": 0,
      _total: 1,
      _custo: 240,
    });
  });
});
