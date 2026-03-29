import { describe, it, expect } from "vitest";
import {
  horasToDecimal,
  decimalToHoras,
  periodosPadrao,
  resolverDiaria,
  resolverHoraPadrao,
  calcularValorDia,
  gerarItensFechamento,
  calcularTotal,
  agruparPorPessoa,
  dbToFechamento,
  fechamentoToDb,
  dbToFechamentoItem,
  dbToDiariaConfig,
  dbToTurnoConfig,
  STATUS_COLORS,
  NEXT_STATUS,
  type DiariaConfig,
  type TurnoConfig,
} from "./fechamento-utils";

// ─── horasToDecimal ──────────────────────────────────────────

describe("horasToDecimal", () => {
  it("converte 08:20 para ~8.3333", () => {
    expect(horasToDecimal("08:20")).toBeCloseTo(8.3333, 3);
  });
  it("converte 07:20 para ~7.3333", () => {
    expect(horasToDecimal("07:20")).toBeCloseTo(7.3333, 3);
  });
  it("converte 09:48 para 9.8", () => {
    expect(horasToDecimal("09:48")).toBeCloseTo(9.8, 4);
  });
  it("converte 00:00 para 0", () => {
    expect(horasToDecimal("00:00")).toBe(0);
  });
  it("retorna 0 para string vazia", () => {
    expect(horasToDecimal("")).toBe(0);
  });
  it("retorna 0 para valor inválido", () => {
    expect(horasToDecimal("abc")).toBe(0);
  });
  it("converte 12:30 para 12.5", () => {
    expect(horasToDecimal("12:30")).toBe(12.5);
  });
});

// ─── decimalToHoras ──────────────────────────────────────────

describe("decimalToHoras", () => {
  it("converte 8.3333 para 08:20", () => {
    expect(decimalToHoras(8 + 20 / 60)).toBe("08:20");
  });
  it("converte 9.8 para 09:48", () => {
    expect(decimalToHoras(9.8)).toBe("09:48");
  });
  it("converte 0 para 00:00", () => {
    expect(decimalToHoras(0)).toBe("00:00");
  });
  it("converte negativo para 00:00", () => {
    expect(decimalToHoras(-3)).toBe("00:00");
  });
});

// ─── periodosPadrao ──────────────────────────────────────────

describe("periodosPadrao", () => {
  it("retorna 3 períodos para um mês", () => {
    const ps = periodosPadrao("2026-03");
    expect(ps).toHaveLength(3);
    expect(ps[0]).toEqual({ label: "1º", inicio: "2026-03-01", fim: "2026-03-10" });
    expect(ps[1]).toEqual({ label: "2º", inicio: "2026-03-11", fim: "2026-03-20" });
    expect(ps[2]).toEqual({ label: "3º", inicio: "2026-03-21", fim: "2026-03-31" });
  });
  it("o 3º período de fevereiro termina no dia 28 (ano normal)", () => {
    const ps = periodosPadrao("2025-02");
    expect(ps[2].fim).toBe("2025-02-28");
  });
  it("o 3º período de fevereiro termina no dia 29 (ano bissexto)", () => {
    const ps = periodosPadrao("2024-02");
    expect(ps[2].fim).toBe("2024-02-29");
  });
});

// ─── resolverDiaria ──────────────────────────────────────────

describe("resolverDiaria", () => {
  const configs: DiariaConfig[] = [
    { fornecedor: "JSS", turno: "1ª TURNO", valorDiaria: 200 },
    { fornecedor: "JSS", turno: "2ª TURNO", valorDiaria: 200 },
    { fornecedor: "JSS", turno: "3ª TURNO", valorDiaria: 230 },
    { fornecedor: "LIDER", turno: null, valorDiaria: 280 },
  ];

  it("retorna valor exato para JSS + 1ª TURNO", () => {
    expect(resolverDiaria("JSS", "1ª TURNO", configs)).toBe(200);
  });
  it("retorna valor exato para JSS + 3ª TURNO", () => {
    expect(resolverDiaria("JSS", "3ª TURNO", configs)).toBe(230);
  });
  it("retorna fallback do fornecedor quando turno não tem config específica", () => {
    expect(resolverDiaria("LIDER", "1ª TURNO", configs)).toBe(280);
  });
  it("retorna valor padrão global (250) quando não há config", () => {
    expect(resolverDiaria("DESCONHECIDO", "1ª TURNO", configs)).toBe(250);
  });
  it("retorna valor padrão para JSS + INTERMEDIÁRIO (sem config específica, sem fallback null)", () => {
    expect(resolverDiaria("JSS", "INTERMEDIÁRIO", configs)).toBe(250);
  });
});

// ─── resolverHoraPadrao ──────────────────────────────────────

describe("resolverHoraPadrao", () => {
  const turnosConfig: TurnoConfig[] = [
    { turno: "1ª TURNO", horaInicio: "05:21", horaFim: "13:40", horaPadrao: "08:20" },
    { turno: "3ª TURNO", horaInicio: "22:01", horaFim: "05:20", horaPadrao: "07:20" },
    { turno: "INTERMEDIÁRIO", horaInicio: "07:00", horaFim: "16:48", horaPadrao: "09:48" },
  ];

  it("retorna hora padrão do 1ª TURNO", () => {
    expect(resolverHoraPadrao("1ª TURNO", turnosConfig)).toBe("08:20");
  });
  it("retorna hora padrão do INTERMEDIÁRIO", () => {
    expect(resolverHoraPadrao("INTERMEDIÁRIO", turnosConfig)).toBe("09:48");
  });
  it("retorna 08:20 como fallback para turno desconhecido", () => {
    expect(resolverHoraPadrao("TURNO X", turnosConfig)).toBe("08:20");
  });
});

// ─── calcularValorDia ────────────────────────────────────────

describe("calcularValorDia", () => {
  const diarias: DiariaConfig[] = [
    { fornecedor: "JSS", turno: "1ª TURNO", valorDiaria: 200 },
  ];
  const turnos: TurnoConfig[] = [
    { turno: "1ª TURNO", horaInicio: "05:21", horaFim: "13:40", horaPadrao: "08:20" },
    { turno: "INTERMEDIÁRIO", horaInicio: "07:00", horaFim: "16:48", horaPadrao: "09:48" },
  ];

  it("valor cheio quando trabalhou a carga completa (08:20)", () => {
    const r = calcularValorDia("08:20", "1ª TURNO", "JSS", diarias, turnos);
    expect(r.valorCalculado).toBe(200);
    expect(r.valorDiaria).toBe(200);
  });

  it("valor cheio quando trabalhou MAIS que a carga (10:00 >= 08:20)", () => {
    const r = calcularValorDia("10:00", "1ª TURNO", "JSS", diarias, turnos);
    expect(r.valorCalculado).toBe(200); // valor cheio, sem extra
  });

  it("proporcional quando trabalhou MENOS que a carga (07:00 < 08:20)", () => {
    const r = calcularValorDia("07:00", "1ª TURNO", "JSS", diarias, turnos);
    // valor_hora = 200 / 8.3333 = 24.00
    // valor_dia = 24.00 × 7 = 168.00
    expect(r.valorCalculado).toBe(168);
  });

  it("usa valor padrão 250 para fornecedor sem config", () => {
    const r = calcularValorDia("08:20", "1ª TURNO", "OUTRO", diarias, turnos);
    expect(r.valorDiaria).toBe(250);
    expect(r.valorCalculado).toBe(250);
  });

  it("INTERMEDIÁRIO 09:48 com valor padrão 250 dá valor cheio", () => {
    const r = calcularValorDia("09:48", "INTERMEDIÁRIO", "OUTRO", [], turnos);
    expect(r.valorCalculado).toBe(250);
  });

  it("INTERMEDIÁRIO parcial (08:00) dá proporcional", () => {
    const r = calcularValorDia("08:00", "INTERMEDIÁRIO", "OUTRO", [], turnos);
    // valor_hora = 250 / 9.8 = 25.5102
    // valor_dia  = 25.5102 × 8 = 204.08
    expect(r.valorCalculado).toBeCloseTo(204.08, 1);
  });

  it("retorna 0 quando hora padrão é zero", () => {
    const zeroTurnos: TurnoConfig[] = [
      { turno: "ZERO", horaInicio: "00:00", horaFim: "00:00", horaPadrao: "00:00" },
    ];
    const r = calcularValorDia("08:00", "ZERO", "X", [], zeroTurnos);
    expect(r.valorCalculado).toBe(0);
  });
});

// ─── gerarItensFechamento ────────────────────────────────────

describe("gerarItensFechamento", () => {
  const diarias: DiariaConfig[] = [
    { fornecedor: "JSS", turno: "1ª TURNO", valorDiaria: 200 },
  ];
  const turnos: TurnoConfig[] = [
    { turno: "1ª TURNO", horaInicio: "05:21", horaFim: "13:40", horaPadrao: "08:20" },
  ];

  it("gera itens a partir dos registros", () => {
    const regs = [
      { id: "r1", nome: "João", data: "2026-03-01", turno: "1ª TURNO", totalHoras: "08:20", fornecedor: "JSS" },
      { id: "r2", nome: "Maria", data: "2026-03-01", turno: "1ª TURNO", totalHoras: "07:00", fornecedor: "JSS" },
    ];
    const itens = gerarItensFechamento(regs, diarias, turnos);
    expect(itens).toHaveLength(2);
    expect(itens[0].valorCalculado).toBe(200);      // carga completa
    expect(itens[1].valorCalculado).toBe(168);       // proporcional
    expect(itens[0].ajusteManual).toBe(false);
    expect(itens[0].registroId).toBe("r1");
  });

  it("lista vazia retorna lista vazia", () => {
    expect(gerarItensFechamento([], diarias, turnos)).toHaveLength(0);
  });
});

// ─── calcularTotal ──────────────────────────────────────────

describe("calcularTotal", () => {
  it("soma os valores calculados", () => {
    const itens = [
      { nome: "A", data: "", turno: "", horas: "", valorDiaria: 0, valorHora: 0, valorCalculado: 200, ajusteManual: false, obs: "" },
      { nome: "B", data: "", turno: "", horas: "", valorDiaria: 0, valorHora: 0, valorCalculado: 168, ajusteManual: false, obs: "" },
    ];
    expect(calcularTotal(itens)).toBe(368);
  });
  it("retorna 0 para lista vazia", () => {
    expect(calcularTotal([])).toBe(0);
  });

  it("item único retorna o valor exato desse item", () => {
    const itens = [
      { nome: "A", data: "", turno: "", horas: "", valorDiaria: 0, valorHora: 0, valorCalculado: 175, ajusteManual: false, obs: "" },
    ];
    expect(calcularTotal(itens)).toBe(175);
  });
});

// ─── agruparPorPessoa ───────────────────────────────────────

describe("agruparPorPessoa", () => {
  it("agrupa itens por nome e calcula totais", () => {
    const itens = [
      { nome: "João", data: "2026-03-01", turno: "1ª", horas: "08:20", valorDiaria: 200, valorHora: 24, valorCalculado: 200, ajusteManual: false, obs: "" },
      { nome: "João", data: "2026-03-02", turno: "1ª", horas: "07:00", valorDiaria: 200, valorHora: 24, valorCalculado: 168, ajusteManual: false, obs: "" },
      { nome: "Maria", data: "2026-03-01", turno: "1ª", horas: "08:20", valorDiaria: 200, valorHora: 24, valorCalculado: 200, ajusteManual: false, obs: "" },
    ];
    const grupos = agruparPorPessoa(itens);
    expect(grupos).toHaveLength(2);

    const joao = grupos.find(g => g.nome === "João")!;
    expect(joao.dias).toBe(2);
    expect(joao.valorTotal).toBe(368);
    expect(joao.itens).toHaveLength(2);

    const maria = grupos.find(g => g.nome === "Maria")!;
    expect(maria.dias).toBe(1);
    expect(maria.valorTotal).toBe(200);
  });
  it("ordena por nome", () => {
    const itens = [
      { nome: "Zé", data: "2026-03-01", turno: "", horas: "08:00", valorDiaria: 250, valorHora: 30, valorCalculado: 250, ajusteManual: false, obs: "" },
      { nome: "Ana", data: "2026-03-01", turno: "", horas: "08:00", valorDiaria: 250, valorHora: 30, valorCalculado: 250, ajusteManual: false, obs: "" },
    ];
    const grupos = agruparPorPessoa(itens);
    expect(grupos[0].nome).toBe("Ana");
    expect(grupos[1].nome).toBe("Zé");
  });

  it("lista vazia retorna lista vazia", () => {
    expect(agruparPorPessoa([])).toEqual([]);
  });

  it("registro único forma grupo com 1 dia", () => {
    const itens = [
      { nome: "Carlos", data: "2026-03-01", turno: "1ª", horas: "08:20", valorDiaria: 200, valorHora: 24, valorCalculado: 200, ajusteManual: false, obs: "" },
    ];
    const grupos = agruparPorPessoa(itens);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].nome).toBe("Carlos");
    expect(grupos[0].dias).toBe(1);
    expect(grupos[0].valorTotal).toBe(200);
  });
});

// ─── DB mapping ──────────────────────────────────────────────

describe("dbToFechamento / fechamentoToDb", () => {
  it("mapeia ida e volta corretamente", () => {
    const row = {
      id: "abc",
      fornecedor: "JSS",
      data_inicio: "2026-03-01",
      data_fim: "2026-03-10",
      status: "rascunho",
      valor_total: "1500.50",
      created_at: "2026-03-14T10:00:00Z",
      updated_at: "2026-03-14T10:00:00Z",
      created_by: "user1",
    };
    const f = dbToFechamento(row);
    expect(f.fornecedor).toBe("JSS");
    expect(f.valorTotal).toBe(1500.5);
    expect(f.status).toBe("rascunho");

    const db = fechamentoToDb(f);
    expect(db.fornecedor).toBe("JSS");
    expect(db.data_inicio).toBe("2026-03-01");
    expect(db.valor_total).toBe(1500.5);
  });
});

describe("dbToFechamentoItem", () => {
  it("mapeia corretamente", () => {
    const row = {
      id: "item1",
      fechamento_id: "fech1",
      registro_id: "reg1",
      nome: "João",
      data: "2026-03-01",
      turno: "1ª TURNO",
      horas: "08:20",
      valor_diaria: 200,
      valor_hora: 24.0,
      valor_calculado: 200,
      ajuste_manual: false,
      obs: "",
    };
    const item = dbToFechamentoItem(row);
    expect(item.nome).toBe("João");
    expect(item.valorDiaria).toBe(200);
    expect(item.ajusteManual).toBe(false);
  });
});

describe("dbToDiariaConfig / dbToTurnoConfig", () => {
  it("mapeia DiariaConfig", () => {
    const d = dbToDiariaConfig({ id: "x", fornecedor: "JSS", turno: "1ª TURNO", valor_diaria: 200 });
    expect(d.fornecedor).toBe("JSS");
    expect(d.turno).toBe("1ª TURNO");
    expect(d.valorDiaria).toBe(200);
  });
  it("DiariaConfig com turno null", () => {
    const d = dbToDiariaConfig({ id: "x", fornecedor: "JSS", turno: null, valor_diaria: 300 });
    expect(d.turno).toBeNull();
  });
  it("mapeia TurnoConfig", () => {
    const t = dbToTurnoConfig({ turno: "1ª TURNO", hora_inicio: "05:21", hora_fim: "13:40", hora_padrao: "08:20" });
    expect(t.turno).toBe("1ª TURNO");
    expect(t.horaPadrao).toBe("08:20");
  });
});

// ─── Constantes ──────────────────────────────────────────────

describe("constantes", () => {
  it("STATUS_COLORS tem 4 status", () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(4);
  });
  it("NEXT_STATUS: rascunho → enviado", () => {
    expect(NEXT_STATUS.rascunho).toBe("enviado");
  });
  it("NEXT_STATUS: enviado → aprovado", () => {
    expect(NEXT_STATUS.enviado).toBe("aprovado");
  });
  it("NEXT_STATUS: revisao → enviado", () => {
    expect(NEXT_STATUS.revisao).toBe("enviado");
  });
});
