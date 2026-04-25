import { describe, expect, it } from "vitest";
import {
  passaFiltroDataPeriodo,
  resolverIntervaloLancamentos,
  type LancamentosPeriodoFiltroState,
} from "./lancamentos-filtros-utils";

describe("resolverIntervaloLancamentos", () => {
  it("resolve mes inteiro quando periodo nao esta selecionado", () => {
    const filtro: LancamentosPeriodoFiltroState = {
      mes: "2026-04",
      periodoIdx: null,
      customInicio: "",
      customFim: "",
    };

    expect(resolverIntervaloLancamentos(filtro)).toEqual({
      inicio: "2026-04-01",
      fim: "2026-04-30",
    });
  });

  it("retorna intervalo vazio quando mes esta vazio e periodo nao selecionado", () => {
    const filtro: LancamentosPeriodoFiltroState = {
      mes: "",
      periodoIdx: null,
      customInicio: "",
      customFim: "",
    };

    expect(resolverIntervaloLancamentos(filtro)).toEqual({ inicio: "", fim: "" });
  });

  it("resolve primeiro periodo do mes", () => {
    const filtro: LancamentosPeriodoFiltroState = {
      mes: "2026-04",
      periodoIdx: 0,
      customInicio: "",
      customFim: "",
    };

    expect(resolverIntervaloLancamentos(filtro)).toEqual({
      inicio: "2026-04-01",
      fim: "2026-04-10",
    });
  });

  it("resolve periodo customizado", () => {
    const filtro: LancamentosPeriodoFiltroState = {
      mes: "2026-04",
      periodoIdx: 3,
      customInicio: "2026-04-05",
      customFim: "2026-04-18",
    };

    expect(resolverIntervaloLancamentos(filtro)).toEqual({
      inicio: "2026-04-05",
      fim: "2026-04-18",
    });
  });
});

describe("passaFiltroDataPeriodo", () => {
  it("aplica somente data exata quando nao ha periodo", () => {
    expect(passaFiltroDataPeriodo("2026-04-12", "2026-04-12", { inicio: "", fim: "" })).toBe(true);
    expect(passaFiltroDataPeriodo("2026-04-11", "2026-04-12", { inicio: "", fim: "" })).toBe(false);
  });

  it("aplica intersecao entre data exata e periodo", () => {
    const intervalo = { inicio: "2026-04-11", fim: "2026-04-20" };
    expect(passaFiltroDataPeriodo("2026-04-12", "2026-04-12", intervalo)).toBe(true);
    expect(passaFiltroDataPeriodo("2026-04-22", "2026-04-22", intervalo)).toBe(false);
  });

  it("aplica periodo quando data exata esta vazia", () => {
    const intervalo = { inicio: "2026-04-11", fim: "2026-04-20" };
    expect(passaFiltroDataPeriodo("2026-04-10", "", intervalo)).toBe(false);
    expect(passaFiltroDataPeriodo("2026-04-11", "", intervalo)).toBe(true);
    expect(passaFiltroDataPeriodo("2026-04-20", "", intervalo)).toBe(true);
    expect(passaFiltroDataPeriodo("2026-04-21", "", intervalo)).toBe(false);
  });
});
