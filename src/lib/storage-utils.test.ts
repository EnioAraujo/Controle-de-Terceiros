import { describe, it, expect } from "vitest";
import { deduplicarLote, diffRegistros } from "./storage-utils";
import type { Registro } from "@/types/attendance";

// ─── Helpers ────────────────────────────────────────────────────

function makeRegistro(overrides: Partial<Registro> & { id: string; nome: string }): Registro {
  return {
    data: "2026-01-01",
    turno: "DT",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "8",
    fornecedor: "F1",
    unidade: "U1",
    motivo: "M1",
    cargo: "C1",
    setor: "S1",
    cc: "",
    obs: "",
    ...overrides,
  };
}

// ─── deduplicarLote ─────────────────────────────────────────────

describe("deduplicarLote", () => {
  it("remove duplicata de mesmo nome (case-insensitive) dentro do mesmo loteId", () => {
    const registros = [
      makeRegistro({ id: "1", nome: "João Silva", loteId: "lote-1" }),
      makeRegistro({ id: "2", nome: "joão silva", loteId: "lote-1" }),
    ];
    const result = deduplicarLote(registros);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("mantém nomes diferentes dentro do mesmo loteId", () => {
    const registros = [
      makeRegistro({ id: "1", nome: "João Silva", loteId: "lote-1" }),
      makeRegistro({ id: "2", nome: "Maria Souza", loteId: "lote-1" }),
    ];
    const result = deduplicarLote(registros);
    expect(result).toHaveLength(2);
  });

  it("registros sem loteId sempre passam (incluindo nomes duplicados)", () => {
    const registros = [
      makeRegistro({ id: "1", nome: "João Silva" }),
      makeRegistro({ id: "2", nome: "João Silva" }),
    ];
    const result = deduplicarLote(registros);
    expect(result).toHaveLength(2);
  });

  it("loteIds diferentes são independentes entre si", () => {
    const registros = [
      makeRegistro({ id: "1", nome: "João Silva", loteId: "lote-1" }),
      makeRegistro({ id: "2", nome: "João Silva", loteId: "lote-2" }),
    ];
    const result = deduplicarLote(registros);
    expect(result).toHaveLength(2);
  });

  it("remove apenas o segundo duplicado, mantém o primeiro", () => {
    const registros = [
      makeRegistro({ id: "A", nome: "  Ana  ", loteId: "lote-x" }),
      makeRegistro({ id: "B", nome: "ANA", loteId: "lote-x" }),
      makeRegistro({ id: "C", nome: "Pedro", loteId: "lote-x" }),
    ];
    const result = deduplicarLote(registros);
    expect(result.map(r => r.id)).toEqual(["A", "C"]);
  });

  it("lista vazia retorna lista vazia", () => {
    expect(deduplicarLote([])).toEqual([]);
  });

  it("elemento único sem loteId passa sem alteração", () => {
    const registros = [makeRegistro({ id: "1", nome: "João Silva" })];
    const result = deduplicarLote(registros);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].nome).toBe("João Silva");
  });
});

// ─── diffRegistros ──────────────────────────────────────────────

describe("diffRegistros", () => {
  it("detecta registro deletado (estava em prev, não está em next)", () => {
    const prev = [makeRegistro({ id: "1", nome: "João" })];
    const next: Registro[] = [];
    const { deletedIds, toUpsert } = diffRegistros(prev, next);
    expect(deletedIds).toEqual(["1"]);
    expect(toUpsert).toHaveLength(0);
  });

  it("detecta inserção (está em next, não estava em prev)", () => {
    const prev: Registro[] = [];
    const next = [makeRegistro({ id: "1", nome: "João" })];
    const { deletedIds, toUpsert } = diffRegistros(prev, next);
    expect(deletedIds).toHaveLength(0);
    expect(toUpsert).toHaveLength(1);
    expect(toUpsert[0].id).toBe("1");
  });

  it("detecta atualização (mesmo id, conteúdo diferente)", () => {
    const prev = [makeRegistro({ id: "1", nome: "João", obs: "antes" })];
    const next = [makeRegistro({ id: "1", nome: "João", obs: "depois" })];
    const { deletedIds, toUpsert } = diffRegistros(prev, next);
    expect(deletedIds).toHaveLength(0);
    expect(toUpsert).toHaveLength(1);
  });

  it("não inclui em toUpsert registros sem alteração", () => {
    const registro = makeRegistro({ id: "1", nome: "João" });
    const { deletedIds, toUpsert } = diffRegistros([registro], [registro]);
    expect(deletedIds).toHaveLength(0);
    expect(toUpsert).toHaveLength(0);
  });

  it("trata corretamente inserções, atualizações e deleções simultaneamente", () => {
    const prev = [
      makeRegistro({ id: "keep", nome: "Mantido" }),
      makeRegistro({ id: "edit", nome: "Editado", obs: "v1" }),
      makeRegistro({ id: "del", nome: "Deletado" }),
    ];
    const next = [
      makeRegistro({ id: "keep", nome: "Mantido" }),
      makeRegistro({ id: "edit", nome: "Editado", obs: "v2" }),
      makeRegistro({ id: "new", nome: "Novo" }),
    ];
    const { deletedIds, toUpsert } = diffRegistros(prev, next);
    expect(deletedIds).toEqual(["del"]);
    expect(toUpsert.map(r => r.id).sort()).toEqual(["edit", "new"]);
  });

  it("ambas as listas vazias retornam sem mudanças", () => {
    const { deletedIds, toUpsert } = diffRegistros([], []);
    expect(deletedIds).toHaveLength(0);
    expect(toUpsert).toHaveLength(0);
  });
});
