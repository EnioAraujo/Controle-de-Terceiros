import { describe, it, expect } from "vitest";
import {
  fmt,
  fmtMes,
  calcHoras,
  fornCor,
  dbToRegistro,
  registroToDb,
  dataLimiteRetencao,
  KEY_TO_FIELD,
  FORN_PALETTE,
  RETENCAO_ANOS,
  buildWhatsAppMessage,
  WHATSAPP_FIELDS,
  WA_DEFAULT_TEMPLATE,
} from "@/lib/format-utils";
import type { WhatsAppTemplate } from "@/lib/format-utils";

// ─── fmt ─────────────────────────────────────────────────────────
describe("fmt", () => {
  it("formata data pt-BR corretamente", () => {
    const r = fmt("2026-03-14", "pt-BR");
    expect(r).toMatch(/14/);
    expect(r).toMatch(/03|mar/i);
  });

  it("formata data en-US corretamente", () => {
    const r = fmt("2026-03-14", "en-US");
    expect(r).toMatch(/3\/14\/2026|Mar/);
  });

  it("retorna '—' para string vazia", () => {
    expect(fmt("")).toBe("—");
  });

  it("usa pt-BR como padrão quando locale omitido", () => {
    const r = fmt("2026-01-01");
    expect(r).toMatch(/01/);
  });
});

// ─── fmtMes ──────────────────────────────────────────────────────
describe("fmtMes", () => {
  it("formata mês/ano em pt-BR", () => {
    expect(fmtMes("2026-03")).toBe("Mar/2026");
    expect(fmtMes("2026-01")).toBe("Jan/2026");
    expect(fmtMes("2026-12")).toBe("Dez/2026");
  });

  it("formata mês/ano em en-US", () => {
    const r = fmtMes("2026-03", "en-US");
    expect(r).toMatch(/Mar.*2026/);
  });

  it("todos os meses pt-BR mapeiam corretamente", () => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    meses.forEach((m, i) => {
      const num = String(i + 1).padStart(2, "0");
      expect(fmtMes(`2026-${num}`)).toBe(`${m}/2026`);
    });
  });
});

// ─── calcHoras ───────────────────────────────────────────────────
describe("calcHoras", () => {
  it("calcula diferença simples de horas", () => {
    expect(calcHoras("08:00", "17:00")).toBe("09:00");
  });

  it("calcula com minutos quebrados", () => {
    expect(calcHoras("08:30", "17:45")).toBe("09:15");
  });

  it("suporta turno noturno (saída antes da entrada)", () => {
    expect(calcHoras("22:00", "06:00")).toBe("08:00");
  });

  it("retorna string vazia se entrada vazia", () => {
    expect(calcHoras("", "17:00")).toBe("");
  });

  it("retorna string vazia se saída vazia", () => {
    expect(calcHoras("08:00", "")).toBe("");
  });

  it("retorna '00:00' se mesma hora", () => {
    expect(calcHoras("12:00", "12:00")).toBe("00:00");
  });

  it("calcula diferença de 1 minuto", () => {
    expect(calcHoras("12:00", "12:01")).toBe("00:01");
  });

  it("calcula turno completo 24h - 1min", () => {
    expect(calcHoras("00:01", "00:00")).toBe("23:59");
  });
});

// ─── fornCor ─────────────────────────────────────────────────────
describe("fornCor", () => {
  const lista = ["LIDER", "TRANSLOG", "SERVILOG"];

  it("retorna a cor correta pelo índice", () => {
    expect(fornCor("LIDER", lista)).toBe(FORN_PALETTE[0]);
    expect(fornCor("TRANSLOG", lista)).toBe(FORN_PALETTE[1]);
    expect(fornCor("SERVILOG", lista)).toBe(FORN_PALETTE[2]);
  });

  it("faz cycling quando lista maior que paleta", () => {
    const grande = Array.from({ length: 15 }, (_, i) => `F${i}`);
    // Índice 10 → PALETTE[10 % 10] = PALETTE[0]
    expect(fornCor("F10", grande)).toBe(FORN_PALETTE[0]);
  });

  it("retorna fallback para item não encontrado", () => {
    expect(fornCor("DESCONHECIDO", lista)).toBe("#64748B");
  });
});

// ─── dbToRegistro / registroToDb ─────────────────────────────────
describe("dbToRegistro / registroToDb", () => {
  const dbRow = {
    id: "abc-123",
    lote_id: "lote-1",
    data: "2026-03-14",
    turno: "1ª TURNO",
    hora_entrada: "08:00",
    hora_saida: "17:00",
    total_horas: "09:00",
    nome: "JOÃO",
    cargo: "AUXILIAR",
    setor: "EXPEDIÇÃO",
    unidade: "HUB",
    cc: "100001",
    motivo: "OPERAÇÃO",
    fornecedor: "LIDER",
    obs: "teste",
  };

  const registro = {
    id: "abc-123",
    loteId: "lote-1",
    data: "2026-03-14",
    turno: "1ª TURNO",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "09:00",
    nome: "JOÃO",
    cargo: "AUXILIAR",
    setor: "EXPEDIÇÃO",
    unidade: "HUB",
    cc: "100001",
    motivo: "OPERAÇÃO",
    fornecedor: "LIDER",
    obs: "teste",
  };

  it("converte row DB para Registro", () => {
    expect(dbToRegistro(dbRow)).toEqual(registro);
  });

  it("converte Registro para row DB", () => {
    expect(registroToDb(registro)).toEqual(dbRow);
  });

  it("ida e volta (round-trip) preserva dados", () => {
    const back = registroToDb(dbToRegistro(dbRow));
    expect(back).toEqual(dbRow);
  });

  it("lote_id null → loteId undefined", () => {
    const r = dbToRegistro({ ...dbRow, lote_id: null });
    expect(r.loteId).toBeUndefined();
  });

  it("loteId undefined → lote_id null", () => {
    const db = registroToDb({ ...registro, loteId: undefined });
    expect(db.lote_id).toBeNull();
  });
});

// ─── dataLimiteRetencao ──────────────────────────────────────────
describe("dataLimiteRetencao", () => {
  it("retorna data exatamente 5 anos atrás", () => {
    const result = dataLimiteRetencao();
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() - RETENCAO_ANOS);
    expect(result).toBe(expected.toISOString().slice(0, 10));
  });

  it("retorna formato YYYY-MM-DD", () => {
    expect(dataLimiteRetencao()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── KEY_TO_FIELD ────────────────────────────────────────────────
describe("KEY_TO_FIELD", () => {
  it("mapeia todas as 6 chaves de opções", () => {
    expect(Object.keys(KEY_TO_FIELD)).toHaveLength(6);
  });

  it("mapeia chaves corretas para campos do Registro", () => {
    expect(KEY_TO_FIELD.turnos).toBe("turno");
    expect(KEY_TO_FIELD.unidades).toBe("unidade");
    expect(KEY_TO_FIELD.fornecedores).toBe("fornecedor");
    expect(KEY_TO_FIELD.motivos).toBe("motivo");
    expect(KEY_TO_FIELD.cargos).toBe("cargo");
    expect(KEY_TO_FIELD.ccList).toBe("cc");
    });
});

// ─── buildWhatsAppMessage ────────────────────────────────────────
describe("buildWhatsAppMessage", () => {
  const baseReg = {
    id: "r1",
    data: "2026-03-15",
    turno: "Dia",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "09:00",
    nome: "João Silva",
    cargo: "Operador",
    setor: "",
    unidade: "SP-001",
    cc: "1234",
    motivo: "Demanda operacional",
    fornecedor: "ABC Serviços",
    obs: "Fez hora extra",
  };

  it("monta mensagem individual com todos os campos", () => {
    const msg = buildWhatsAppMessage([baseReg], WA_DEFAULT_TEMPLATE);
    expect(msg).toContain("*REGISTRO DE PRESENÇA*");
    expect(msg).toContain("*Data:* ");
    expect(msg).toContain("*Turno:* Dia");
    expect(msg).toContain("*Nome:* João Silva");
    expect(msg).toContain("*Cargo:* Operador");
    expect(msg).toContain("*Fornecedor:* ABC Serviços");
    expect(msg).toContain("*Unidade:* SP-001");
    expect(msg).toContain("*Centro de Custo:* 1234");
    expect(msg).toContain("*Hora Entrada:* 08:00");
    expect(msg).toContain("*Hora Saída:* 17:00");
    expect(msg).toContain("*Total Horas:* 09:00");
    expect(msg).toContain("*Motivo:* Demanda operacional");
    expect(msg).toContain("*Observação:* Fez hora extra");
  });

  it("monta mensagem individual com campos parciais", () => {
    const template: WhatsAppTemplate = { header: "TESTE", campos: ["data", "nome"] };
    const msg = buildWhatsAppMessage([baseReg], template);
    expect(msg).toContain("*TESTE*");
    expect(msg).toContain("*Nome:* João Silva");
    expect(msg).not.toContain("*Turno:*");
    expect(msg).not.toContain("*Cargo:*");
  });

  it("omite obs vazia em registro individual", () => {
    const reg = { ...baseReg, obs: "" };
    const msg = buildWhatsAppMessage([reg], WA_DEFAULT_TEMPLATE);
    expect(msg).not.toContain("*Observação:*");
  });

  it("monta mensagem de lote com colaboradores", () => {
    const lote = [
      { ...baseReg, loteId: "L1", nome: "João", horaEntrada: "08:00", horaSaida: "17:00", totalHoras: "09:00" },
      { ...baseReg, id: "r2", loteId: "L1", nome: "Maria", horaEntrada: "09:00", horaSaida: "18:00", totalHoras: "09:00" },
      { ...baseReg, id: "r3", loteId: "L1", nome: "Pedro", horaEntrada: "07:00", horaSaida: "16:00", totalHoras: "09:00" },
    ];
    const msg = buildWhatsAppMessage(lote, WA_DEFAULT_TEMPLATE);
    expect(msg).toContain("*REGISTRO DE PRESENÇA*");
    expect(msg).toContain("*Turno:* Dia");
    expect(msg).toContain("*Colaboradores (3):*");
    expect(msg).toContain("• João — 08:00 - 17:00 — (09:00)");
    expect(msg).toContain("• Maria — 09:00 - 18:00 — (09:00)");
    expect(msg).toContain("• Pedro — 07:00 - 16:00 — (09:00)");
  });

  it("retorna string vazia para array vazio", () => {
    expect(buildWhatsAppMessage([], WA_DEFAULT_TEMPLATE)).toBe("");
  });

  it("lote mostra obs do primeiro registro se presente", () => {
    const lote = [
      { ...baseReg, loteId: "L1", nome: "A", obs: "Nota importante" },
      { ...baseReg, id: "r2", loteId: "L1", nome: "B", obs: "" },
    ];
    const msg = buildWhatsAppMessage(lote, WA_DEFAULT_TEMPLATE);
    expect(msg).toContain("*Observação:* Nota importante");
  });

  it("lote omite obs se primeiro registro não tem obs", () => {
    const lote = [
      { ...baseReg, loteId: "L1", nome: "A", obs: "" },
      { ...baseReg, id: "r2", loteId: "L1", nome: "B", obs: "" },
    ];
    const msg = buildWhatsAppMessage(lote, WA_DEFAULT_TEMPLATE);
    expect(msg).not.toContain("*Observação:*");
  });

  it("WHATSAPP_FIELDS tem exatamente 12 campos", () => {
    expect(WHATSAPP_FIELDS).toHaveLength(12);
  });

  it("mensagem resultante é encodável para URL", () => {
    const msg = buildWhatsAppMessage([baseReg], WA_DEFAULT_TEMPLATE);
    const encoded = encodeURIComponent(msg);
    expect(encoded).toBeTruthy();
    expect(decodeURIComponent(encoded)).toBe(msg);
  });
});
