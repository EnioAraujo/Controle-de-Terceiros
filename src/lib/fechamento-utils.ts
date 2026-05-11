/**
 * Funções puras de cálculo para o módulo de Fechamento (billing).
 *
 * Regras de negócio:
 * - valor_hora = valor_diaria / hora_padrao_decimal
 * - Se horas_trabalhadas >= hora_padrao: valor_dia = valor_diaria (cheio)
 * - Se horas_trabalhadas < hora_padrao: valor_dia = valor_hora × horas_trabalhadas (proporcional)
 */

// ─── TIPOS ────────────────────────────────────────────────────

export interface TurnoConfig {
  turno: string;
  horaInicio: string;   // HH:MM
  horaFim: string;      // HH:MM
  horaPadrao: string;   // HH:MM
}

export interface DiariaConfig {
  id?: string;
  fornecedor: string;
  turno: string | null;  // null = fallback para qualquer turno
  valorDiaria: number;
  vigenciaInicio?: string | null; // YYYY-MM-DD; null = sem restrição de período
  vigenciaFim?: string | null;   // YYYY-MM-DD; null = sem restrição de período
}

export interface FechamentoItem {
  id?: string;
  fechamentoId?: string;
  registroId?: string | null;
  nome: string;
  data: string;        // YYYY-MM-DD
  turno: string;
  horas: string;       // HH:MM
  valorDiaria: number;
  valorHora: number;
  valorCalculado: number;
  ajusteManual: boolean;
  obs: string;
}

export interface Fechamento {
  id?: string;
  fornecedor: string;
  dataInicio: string;  // YYYY-MM-DD
  dataFim: string;     // YYYY-MM-DD
  valorTotal: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ─── CONVERSÃO HH:MM → DECIMAL ────────────────────────────────

/** Converte "HH:MM" para horas decimais. Ex: "08:20" → 8.3333 */
export const horasToDecimal = (hhmm: string): number => {
  if (!hhmm || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h + m / 60;
};

/** Converte horas decimais para "HH:MM". Ex: 8.3333 → "08:20" */
export const decimalToHoras = (dec: number): string => {
  if (!dec || dec < 0) return "00:00";
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// ─── PERÍODOS DE FECHAMENTO ───────────────────────────────────

export interface Periodo {
  label: string;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
}

/** Retorna os 3 períodos padrão de um mês (1-10, 11-20, 21-fim) */
export const periodosPadrao = (ym: string): Periodo[] => {
  const [y, m] = ym.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    { label: "1º", inicio: `${ym}-01`, fim: `${ym}-10` },
    { label: "2º", inicio: `${ym}-11`, fim: `${ym}-20` },
    { label: "3º", inicio: `${ym}-21`, fim: `${ym}-${pad(ultimoDia)}` },
  ];
};

// ─── RESOLUÇÃO DE VALOR DA DIÁRIA ─────────────────────────────

const VALOR_PADRAO = 250;

/** Verifica se uma config está vigente na data informada (YYYY-MM-DD). */
const dentroVigencia = (c: DiariaConfig, data?: string): boolean => {
  if (c.vigenciaInicio == null) return true;   // sem restrição de período, sempre válido
  if (!data) return false;                       // tem restrição mas sem data para verificar
  if (data < c.vigenciaInicio) return false;
  if (c.vigenciaFim != null && data > c.vigenciaFim) return false;
  return true;
};

/**
 * Resolve o valor da diária para (fornecedor, turno) a partir da configuração.
 *
 * Prioridade:
 *   1. Match exato com vigência (fornecedor + turno + data dentro do período)
 *   2. Match exato sem restrição de período (vigenciaInicio = null)
 *   3. Fallback do fornecedor com vigência (turno = null + data dentro do período)
 *   4. Fallback do fornecedor sem restrição de período (turno = null + vigenciaInicio = null)
 *   5. Valor padrão global (R$ 250)
 *
 * Se `data` não for fornecida, configs com vigência nunca são selecionadas — apenas
 * configs sem restrição de período (vigenciaInicio = null) são consideradas.
 */
export const resolverDiaria = (
  fornecedor: string,
  turno: string,
  configs: DiariaConfig[],
  data?: string,
): number => {
  const exatas = configs.filter(c => c.fornecedor === fornecedor && c.turno === turno);

  // 1. exato + dentro da vigência
  const exactVig = exatas.find(c => c.vigenciaInicio != null && dentroVigencia(c, data));
  if (exactVig) return exactVig.valorDiaria;

  // 2. exato sem período (sempre válido)
  const exactSem = exatas.find(c => c.vigenciaInicio == null);
  if (exactSem) return exactSem.valorDiaria;

  const fallbacks = configs.filter(c => c.fornecedor === fornecedor && c.turno === null);

  // 3. fallback + dentro da vigência
  const fallVig = fallbacks.find(c => c.vigenciaInicio != null && dentroVigencia(c, data));
  if (fallVig) return fallVig.valorDiaria;

  // 4. fallback sem período
  const fallSem = fallbacks.find(c => c.vigenciaInicio == null);
  if (fallSem) return fallSem.valorDiaria;

  return VALOR_PADRAO;
};

// ─── RESOLUÇÃO DE HORA PADRÃO DO TURNO ──────────────────────

const HORA_PADRAO_DEFAULT = "08:20";

export const resolverHoraPadrao = (
  turno: string,
  turnosConfig: TurnoConfig[],
): string => {
  const found = turnosConfig.find(tc => tc.turno === turno);
  return found?.horaPadrao ?? HORA_PADRAO_DEFAULT;
};

// ─── CÁLCULO DO VALOR DE UM DIA ─────────────────────────────

export interface CalcDiaResult {
  valorDiaria: number;
  valorHora: number;
  valorCalculado: number;
  horaPadrao: string;
}

/**
 * Calcula o valor de um dia trabalhado.
 *
 * Regra: se trabalhou >= carga padrão, paga valor cheio.
 *        se trabalhou < carga padrão, paga proporcional.
 */
export const calcularValorDia = (
  horasTrabalhadas: string,  // HH:MM
  turno: string,
  fornecedor: string,
  diariasConfig: DiariaConfig[],
  turnosConfig: TurnoConfig[],
  data?: string,             // YYYY-MM-DD — para resolução de vigência
): CalcDiaResult => {
  const valorDiaria = resolverDiaria(fornecedor, turno, diariasConfig, data);
  const horaPadrao = resolverHoraPadrao(turno, turnosConfig);
  const hPadraoDec = horasToDecimal(horaPadrao);
  const hTrabDec = horasToDecimal(horasTrabalhadas);

  if (hPadraoDec === 0) {
    return { valorDiaria, valorHora: 0, valorCalculado: 0, horaPadrao };
  }

  const valorHora = valorDiaria / hPadraoDec;

  const valorCalculado = hTrabDec >= hPadraoDec
    ? valorDiaria                    // valor cheio
    : Math.round(valorHora * hTrabDec * 100) / 100;  // proporcional

  return {
    valorDiaria,
    valorHora: Math.round(valorHora * 10000) / 10000,
    valorCalculado,
    horaPadrao,
  };
};

// ─── GERAR ITENS DE FECHAMENTO A PARTIR DOS REGISTROS ───────

interface RegistroSimples {
  id: string;
  nome: string;
  data: string;
  turno: string;
  totalHoras: string;
  fornecedor: string;
}

/**
 * Gera os itens de fechamento a partir de registros de presença filtrados.
 */
export const gerarItensFechamento = (
  registros: RegistroSimples[],
  diariasConfig: DiariaConfig[],
  turnosConfig: TurnoConfig[],
): FechamentoItem[] => {
  return registros.map(r => {
    const calc = calcularValorDia(
      r.totalHoras,
      r.turno,
      r.fornecedor,
      diariasConfig,
      turnosConfig,
      r.data,  // passa a data para resolução de vigência
    );
    return {
      registroId: r.id,
      nome: r.nome,
      data: r.data,
      turno: r.turno,
      horas: r.totalHoras,
      valorDiaria: calc.valorDiaria,
      valorHora: calc.valorHora,
      valorCalculado: calc.valorCalculado,
      ajusteManual: false,
      obs: "",
    };
  });
};

/** Calcula o valor total a partir de uma lista de itens. */
export const calcularTotal = (itens: FechamentoItem[]): number =>
  Math.round(itens.reduce((acc, i) => acc + i.valorCalculado, 0) * 100) / 100;

// ─── AGRUPAMENTO POR PESSOA ─────────────────────────────────

export interface ResumoPessoa {
  nome: string;
  dias: number;
  totalHoras: number; // decimal
  valorTotal: number;
  itens: FechamentoItem[];
}

export const agruparPorPessoa = (itens: FechamentoItem[]): ResumoPessoa[] => {
  const map = new Map<string, FechamentoItem[]>();
  for (const item of itens) {
    const list = map.get(item.nome) ?? [];
    list.push(item);
    map.set(item.nome, list);
  }
  return Array.from(map.entries())
    .map(([nome, its]) => ({
      nome,
      dias: its.length,
      totalHoras: its.reduce((acc, i) => acc + horasToDecimal(i.horas), 0),
      valorTotal: Math.round(its.reduce((acc, i) => acc + i.valorCalculado, 0) * 100) / 100,
      itens: its.sort((a, b) => a.data.localeCompare(b.data)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

// ─── MAPEAMENTO DB ↔ MODELO ─────────────────────────────────

type DbRow = Record<string, unknown>;

export const dbToFechamento = (row: DbRow): Fechamento => ({
  id:         row.id as string,
  fornecedor: row.fornecedor as string,
  dataInicio: row.data_inicio as string,
  dataFim:    row.data_fim as string,
  valorTotal: Number(row.valor_total),
  createdAt:  row.created_at as string | undefined,
  updatedAt:  row.updated_at as string | undefined,
  createdBy:  row.created_by as string | undefined,
});

export const fechamentoToDb = (f: Fechamento) => ({
  ...(f.id ? { id: f.id } : {}),
  fornecedor:  f.fornecedor,
  data_inicio: f.dataInicio,
  data_fim:    f.dataFim,
  valor_total: f.valorTotal,
});

export const dbToFechamentoItem = (row: DbRow): FechamentoItem => ({
  id:             row.id as string,
  fechamentoId:   row.fechamento_id as string,
  registroId:     (row.registro_id as string | null) ?? null,
  nome:           row.nome as string,
  data:           row.data as string,
  turno:          row.turno as string,
  horas:          row.horas as string,
  valorDiaria:    Number(row.valor_diaria),
  valorHora:      Number(row.valor_hora),
  valorCalculado: Number(row.valor_calculado),
  ajusteManual:   row.ajuste_manual as boolean,
  obs:            (row.obs as string) ?? "",
});

export const fechamentoItemToDb = (i: FechamentoItem, fechamentoId: string) => ({
  ...(i.id ? { id: i.id } : {}),
  fechamento_id:   fechamentoId,
  registro_id:     i.registroId ?? null,
  nome:            i.nome,
  data:            i.data,
  turno:           i.turno,
  horas:           i.horas,
  valor_diaria:    i.valorDiaria,
  valor_hora:      i.valorHora,
  valor_calculado: i.valorCalculado,
  ajuste_manual:   i.ajusteManual,
  obs:             i.obs,
});

export const dbToDiariaConfig = (row: DbRow): DiariaConfig => ({
  id:             row.id as string,
  fornecedor:     row.fornecedor as string,
  turno:          (row.turno as string | null) ?? null,
  valorDiaria:    Number(row.valor_diaria),
  vigenciaInicio: (row.vigencia_inicio as string | null) ?? null,
  vigenciaFim:    (row.vigencia_fim    as string | null) ?? null,
});

export const dbToTurnoConfig = (row: DbRow): TurnoConfig => ({
  turno:      row.turno as string,
  horaInicio: row.hora_inicio as string,
  horaFim:    row.hora_fim as string,
  horaPadrao: row.hora_padrao as string,
});

// ─── CAPACIDADE POR TURNO ────────────────────────────────────

export interface TurnoCapacidade {
  id?: string;
  turno: string;
  qtdPadrao: number;
  vigenciaInicio: string; // YYYY-MM-DD
  vigenciaFim: string;    // YYYY-MM-DD
}

export const dbToTurnoCapacidade = (row: DbRow): TurnoCapacidade => ({
  id:             row.id as string,
  turno:          row.turno as string,
  qtdPadrao:      Number(row.qtd_padrao),
  vigenciaInicio: row.vigencia_inicio as string,
  vigenciaFim:    row.vigencia_fim as string,
});

export const turnoCapacidadeToDb = (c: TurnoCapacidade) => ({
  ...(c.id ? { id: c.id } : {}),
  turno:           c.turno,
  qtd_padrao:      c.qtdPadrao,
  vigencia_inicio: c.vigenciaInicio,
  vigencia_fim:    c.vigenciaFim,
});
