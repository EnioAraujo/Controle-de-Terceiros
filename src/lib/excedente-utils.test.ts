import { describe, it, expect } from "vitest";
import {
  resolverCapacidade,
  calcExcedentePorTurnoDia,
  gerarDadosRelatorioExcedentes,
} from "./excedente-utils";
import type { TurnoCapacidade } from "./fechamento-utils";

const cfgs: TurnoCapacidade[] = [
  { id: "1", turno: "A", qtdPadrao: 5, vigenciaInicio: "2026-04-01", vigenciaFim: "2026-04-30" },
  { id: "2", turno: "B", qtdPadrao: 3, vigenciaInicio: "2026-04-01", vigenciaFim: "2026-04-30" },
];

// ─── resolverCapacidade ──────────────────────────────────────

describe("resolverCapacidade", () => {
  it("retorna qtdPadrao quando turno e data estão dentro da vigência", () => {
    expect(resolverCapacidade("A", "2026-04-15", cfgs)).toBe(5);
  });

  it("retorna null quando data está fora da vigência", () => {
    expect(resolverCapacidade("A", "2026-05-01", cfgs)).toBeNull();
  });

  it("retorna null quando turno não possui configuração", () => {
    expect(resolverCapacidade("C", "2026-04-15", cfgs)).toBeNull();
  });

  it("retorna null quando lista de configs está vazia", () => {
    expect(resolverCapacidade("A", "2026-04-15", [])).toBeNull();
  });

  it("aceita data igual ao limite inferior da vigência", () => {
    expect(resolverCapacidade("A", "2026-04-01", cfgs)).toBe(5);
  });

  it("aceita data igual ao limite superior da vigência", () => {
    expect(resolverCapacidade("A", "2026-04-30", cfgs)).toBe(5);
  });
});

// ─── calcExcedentePorTurnoDia ────────────────────────────────

describe("calcExcedentePorTurnoDia", () => {
  it("retorna excedente 0 quando total <= limite", () => {
    const regs = Array.from({ length: 4 }, () => ({ data: "2026-04-01", turno: "A" }));
    const mapa = calcExcedentePorTurnoDia(regs, cfgs);
    const info = mapa.get("2026-04-01|A")!;
    expect(info.total).toBe(4);
    expect(info.limite).toBe(5);
    expect(info.excedente).toBe(0);
  });

  it("calcula excedente correto quando total > limite", () => {
    const regs = Array.from({ length: 7 }, () => ({ data: "2026-04-02", turno: "A" }));
    const mapa = calcExcedentePorTurnoDia(regs, cfgs);
    const info = mapa.get("2026-04-02|A")!;
    expect(info.excedente).toBe(2);
    expect(info.total).toBe(7);
  });

  it("retorna limite null quando turno não tem config", () => {
    const regs = [{ data: "2026-04-01", turno: "C" }];
    const mapa = calcExcedentePorTurnoDia(regs, cfgs);
    const info = mapa.get("2026-04-01|C")!;
    expect(info.limite).toBeNull();
    expect(info.excedente).toBe(0);
  });

  it("agrupa corretamente múltiplos turnos no mesmo dia", () => {
    const regs = [
      ...Array.from({ length: 4 }, () => ({ data: "2026-04-03", turno: "A" })),
      ...Array.from({ length: 5 }, () => ({ data: "2026-04-03", turno: "B" })),
    ];
    const mapa = calcExcedentePorTurnoDia(regs, cfgs);
    expect(mapa.get("2026-04-03|A")!.excedente).toBe(0); // 4 <= 5
    expect(mapa.get("2026-04-03|B")!.excedente).toBe(2); // 5 > 3
  });

  it("retorna mapa vazio para lista de registros vazia", () => {
    const mapa = calcExcedentePorTurnoDia([], cfgs);
    expect(mapa.size).toBe(0);
  });

  it("excedente é exatamente 0 quando total === limite", () => {
    const regs = Array.from({ length: 5 }, () => ({ data: "2026-04-04", turno: "A" }));
    const mapa = calcExcedentePorTurnoDia(regs, cfgs);
    expect(mapa.get("2026-04-04|A")!.excedente).toBe(0);
  });
});

// ─── gerarDadosRelatorioExcedentes ──────────────────────────

describe("gerarDadosRelatorioExcedentes", () => {
  it("filtra apenas linhas com configuração de capacidade", () => {
    const regs = [
      { data: "2026-04-01", turno: "A" },
      { data: "2026-04-01", turno: "C" }, // sem config
    ];
    const linhas = gerarDadosRelatorioExcedentes(regs, cfgs);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].turno).toBe("A");
  });

  it("ordena por data asc, depois por turno asc", () => {
    const regs = [
      { data: "2026-04-02", turno: "B" },
      { data: "2026-04-01", turno: "A" },
      { data: "2026-04-01", turno: "B" },
    ];
    const linhas = gerarDadosRelatorioExcedentes(regs, cfgs);
    expect(linhas[0]).toMatchObject({ data: "2026-04-01", turno: "A" });
    expect(linhas[1]).toMatchObject({ data: "2026-04-01", turno: "B" });
    expect(linhas[2]).toMatchObject({ data: "2026-04-02", turno: "B" });
  });

  it("retorna array vazio quando configs está vazio", () => {
    const regs = [{ data: "2026-04-01", turno: "A" }];
    expect(gerarDadosRelatorioExcedentes(regs, [])).toHaveLength(0);
  });

  it("inclui linha mesmo quando excedente é 0 (desde que haja config)", () => {
    const regs = [{ data: "2026-04-01", turno: "A" }]; // 1 pessoa, limite 5
    const linhas = gerarDadosRelatorioExcedentes(regs, cfgs);
    expect(linhas[0].excedente).toBe(0);
  });

  it("popula capacidade corretamente na linha", () => {
    const regs = Array.from({ length: 6 }, () => ({ data: "2026-04-05", turno: "A" }));
    const linhas = gerarDadosRelatorioExcedentes(regs, cfgs);
    expect(linhas[0].capacidade).toBe(5);
    expect(linhas[0].total).toBe(6);
    expect(linhas[0].excedente).toBe(1);
  });
});
