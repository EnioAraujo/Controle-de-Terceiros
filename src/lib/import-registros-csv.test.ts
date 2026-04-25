import { describe, expect, it } from "vitest";
import type { Registro } from "@/types/attendance";
import { importRegistrosFromCsv } from "./import-registros-csv";

const HEADER =
  "DATA_PRESENCA;DIA_SEMANA;TURNO;Hora_entrada;Hora_Saída;Total_Horas;NOME_COMPLETO_TERCEIRO;CARGO;UNIDADE;CENTRO CUSTO;MOTIVO;FORNECEDOR;OBSEVAÇÃO";

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

const existente: Registro = {
  id: "ex-1",
  data: "2024-01-02",
  turno: "3ª TURNO",
  horaEntrada: "22:00",
  horaSaida: "05:20",
  totalHoras: "07:20",
  nome: "AMAURI SALES",
  cargo: "AUXILIAR",
  setor: "",
  unidade: "UDI",
  cc: "BAT",
  motivo: "OPERACAO",
  fornecedor: "FENICE",
  obs: "",
};

describe("importRegistrosFromCsv", () => {
  it("importa linha válida convertendo data e hora", () => {
    const result = importRegistrosFromCsv(
      csv("02/01/2024;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;HIGOR;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;"),
      [],
    );

    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].data).toBe("2024-01-02");
    expect(result.valid[0].horaEntrada).toBe("06:30");
    expect(result.valid[0].horaSaida).toBe("13:40");
    expect(result.valid[0].totalHoras).toBe("07:10");
  });

  it("ignora duplicados já existentes e repetidos no arquivo", () => {
    const result = importRegistrosFromCsv(
      csv(
        "02/01/2024;Terça-Feira;3ª TURNO;22:00:00;05:20:00;07:20:00;AMAURI SALES;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;",
        "02/01/2024;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;HIGOR;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;",
        "02/01/2024;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;HIGOR;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;",
      ),
      [existente],
    );

    expect(result.valid).toHaveLength(1);
    expect(result.invalid.length).toBeGreaterThanOrEqual(2);
  });

  it("rejeita conflito de turno para mesmo nome e data", () => {
    const result = importRegistrosFromCsv(
      csv("02/01/2024;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;AMAURI SALES;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;"),
      [existente],
    );

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain("Conflito de turno");
  });

  it("rejeita linhas com data inválida ou nome ausente", () => {
    const result = importRegistrosFromCsv(
      csv(
        "2024-01-02;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;HIGOR;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;",
        "02/01/2024;Terça-Feira;1ª TURNO;06:30:00;13:40:00;07:10:00;;AUXILIAR;UDI;BAT;OPERAÇÃO BAT HUB BRASIL;FENICE;",
      ),
      [],
    );

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });
});
