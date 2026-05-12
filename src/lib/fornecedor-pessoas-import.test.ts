import { describe, it, expect } from "vitest";
import { parseImportFile, type ImportPessoasResult } from "@/lib/fornecedor-pessoas-import";

const CARGOS = ["AUXILIAR", "OPERADOR", "SUPERVISOR"];

const csvFile = (text: string): File =>
  new File([text], "pessoas.csv", { type: "text/csv" });

const HEADER = "Nome Completo;Cargo";

describe("parseImportFile (CSV)", () => {
  it("aceita CSV válido com 3 linhas", async () => {
    const text = [
      HEADER,
      "joão silva;auxiliar",
      "maria souza;operador",
      "carlos lima;supervisor",
    ].join("\n");

    const r: ImportPessoasResult = await parseImportFile(csvFile(text), CARGOS);

    expect(r.total).toBe(3);
    expect(r.valid).toHaveLength(3);
    expect(r.invalid).toHaveLength(0);
    expect(r.valid[0]).toEqual({ nome: "JOÃO SILVA", cargo: "AUXILIAR" });
  });

  it("marca segunda ocorrência de nome duplicado como inválido", async () => {
    const text = [
      HEADER,
      "joão silva;auxiliar",
      "joão silva;operador",
    ].join("\n");

    const r = await parseImportFile(csvFile(text), CARGOS);

    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(1);
    expect(r.invalid[0].linha).toBe(3);
    expect(r.invalid[0].motivo).toMatch(/duplicad/i);
  });

  it("rejeita cargo fora da lista", async () => {
    const text = [
      HEADER,
      "joão silva;gerente",
    ].join("\n");

    const r = await parseImportFile(csvFile(text), CARGOS);

    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(1);
    expect(r.invalid[0].motivo).toMatch(/cargo/i);
  });
});

describe("parseImportFile (XLSX)", () => {
  it("faz parse de XLSX válido", async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pessoas");
    ws.addRow(["Nome Completo", "Cargo"]);
    ws.addRow(["joão silva", "auxiliar"]);
    ws.addRow(["maria souza", "operador"]);
    const buffer = await wb.xlsx.writeBuffer();
    const file = new File([buffer], "pessoas.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const r = await parseImportFile(file, CARGOS);

    expect(r.total).toBe(2);
    expect(r.valid).toHaveLength(2);
    expect(r.invalid).toHaveLength(0);
    expect(r.valid.map(v => v.nome)).toEqual(["JOÃO SILVA", "MARIA SOUZA"]);
    expect(r.valid.map(v => v.cargo)).toEqual(["AUXILIAR", "OPERADOR"]);
  });
});
