import { describe, it, expect } from "vitest";
import { gerarDias, calcMediaPorTurno, calcDadosPorDia, TURNOS_PROJECAO } from "@/lib/projecao-utils";
import type { Registro } from "@/types/attendance";

const REG = (data: string, turno: string, fornecedor = "A"): Registro => ({
  id: `${data}-${turno}`, data, turno, fornecedor,
  loteId: undefined, horaEntrada: "", horaSaida: "", totalHoras: "",
  nome: "X", cargo: "", setor: "", unidade: "", cc: "", motivo: "", obs: "",
});

// ─── gerarDias ────────────────────────────────────────────────────
describe("gerarDias", () => {
  it("gera 3 dias inclusive", () => {
    expect(gerarDias("2026-04-01", "2026-04-03")).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });
  it("retorna 1 dia quando inicio === fim", () => {
    expect(gerarDias("2026-04-01", "2026-04-01")).toHaveLength(1);
  });
  it("auto-swap quando datas invertidas", () => {
    expect(gerarDias("2026-04-03", "2026-04-01")).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });
  it("retorna [] quando string vazia", () => {
    expect(gerarDias("", "2026-04-03")).toEqual([]);
  });
});

// ─── calcMediaPorTurno ────────────────────────────────────────────
describe("calcMediaPorTurno", () => {
  const regs = [
    REG("2026-01-01", "1ª TURNO"), REG("2026-01-01", "2ª TURNO"),
    REG("2026-01-02", "1ª TURNO"), REG("2026-01-02", "3ª TURNO"),
  ];

  it("calcula média por turno corretamente", () => {
    const m = calcMediaPorTurno(regs, TURNOS_PROJECAO, "");
    expect(m["1ª TURNO"]).toBe(1); // 2 / 2 dias
    expect(m["2ª TURNO"]).toBe(0.5); // 1 / 2 dias
    expect(m["3ª TURNO"]).toBe(0.5);
  });

  it("filtra por fornecedor", () => {
    const mixed = [REG("2026-01-01", "1ª TURNO", "A"), REG("2026-01-01", "1ª TURNO", "B")];
    const m = calcMediaPorTurno(mixed, TURNOS_PROJECAO, "A");
    expect(m["1ª TURNO"]).toBe(1);
    const mB = calcMediaPorTurno(mixed, TURNOS_PROJECAO, "B");
    expect(mB["1ª TURNO"]).toBe(1);
  });

  it("retorna zeros quando sem registros", () => {
    const m = calcMediaPorTurno([], TURNOS_PROJECAO, "");
    for (const t of TURNOS_PROJECAO) expect(m[t]).toBe(0);
  });
});

// ─── calcDadosPorDia ─────────────────────────────────────────────
describe("calcDadosPorDia", () => {
  const medias = { "1ª TURNO": 2, "2ª TURNO": 1, "3ª TURNO": 1 };

  it("preenche dados reais sem alterar", () => {
    const regs = [REG("2026-04-01", "1ª TURNO"), REG("2026-04-01", "1ª TURNO")];
    const res = calcDadosPorDia(["2026-04-01"], regs, [], medias, 0);
    expect(res["2026-04-01"]["1ª TURNO"]).toBe(2);
  });

  it("projeta usando médias quando dia vazio e em diasProjecao", () => {
    const res = calcDadosPorDia(["2026-04-05"], [], ["2026-04-05"], medias, 0);
    expect(res["2026-04-05"]["1ª TURNO"]).toBe(2);
    expect(res["2026-04-05"]["2ª TURNO"]).toBe(1);
  });

  it("distribui proporcional quando qtdCustom informado", () => {
    const res = calcDadosPorDia(["2026-04-05"], [], ["2026-04-05"], medias, 8);
    const total = TURNOS_PROJECAO.reduce((s, t) => s + res["2026-04-05"][t], 0);
    expect(total).toBe(8);
  });

  it("não sobrescreve dia com dados reais existentes", () => {
    const regs = [REG("2026-04-05", "1ª TURNO")];
    const res = calcDadosPorDia(["2026-04-05"], regs, ["2026-04-05"], medias, 10);
    expect(res["2026-04-05"]["1ª TURNO"]).toBe(1); // real, não projetado
  });
});
