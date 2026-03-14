import type { Registro } from "@/types/attendance";

// ─── FORMATAÇÃO DE DATA ──────────────────────────────────────────
export const hoje = () => new Date().toISOString().slice(0, 10);

export const fmt = (d: string, locale = "pt-BR") =>
  d ? new Date(d + "T00:00:00").toLocaleDateString(locale) : "—";

export const fmtMes = (ym: string, locale = "pt-BR") => {
  const d = new Date(ym + "-01");
  if (locale === "en-US")
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const [y, m] = ym.split("-");
  return (
    ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][+m - 1] +
    "/" +
    y
  );
};

export const mesAtual = () => new Date().toISOString().slice(0, 7);

// ─── CÁLCULO DE HORAS ───────────────────────────────────────────
export const calcHoras = (e: string, s: string) => {
  if (!e || !s) return "";
  const [eh, em] = e.split(":").map(Number);
  const [sh, sm] = s.split(":").map(Number);
  let m = (sh * 60 + sm) - (eh * 60 + em);
  if (m < 0) m += 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ─── LGPD ────────────────────────────────────────────────────────
export const RETENCAO_ANOS = 5;
export const dataLimiteRetencao = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - RETENCAO_ANOS);
  return d.toISOString().slice(0, 10);
};

// ─── PALETA DE CORES ────────────────────────────────────────────
export const FORN_PALETTE = [
  "#D97706", "#1A56DB", "#0E9F6E", "#6C63FF", "#E02424",
  "#0891B2", "#CA8A04", "#7C3AED", "#0F766E", "#64748B",
];
export const fornCor = (forn: string, lista: string[]) =>
  FORN_PALETTE[lista.indexOf(forn) % FORN_PALETTE.length] || "#64748B";

// ─── MAPEAMENTO DB ↔ MODELO ────────────────────────────────────
type DbRegistro = Record<string, unknown>;

export const dbToRegistro = (row: DbRegistro): Registro => ({
  id:          row.id as string,
  loteId:      (row.lote_id as string | null) ?? undefined,
  data:        row.data as string,
  turno:       row.turno as string,
  horaEntrada: row.hora_entrada as string,
  horaSaida:   row.hora_saida as string,
  totalHoras:  row.total_horas as string,
  nome:        row.nome as string,
  cargo:       row.cargo as string,
  setor:       row.setor as string,
  unidade:     row.unidade as string,
  cc:          row.cc as string,
  motivo:      row.motivo as string,
  fornecedor:  row.fornecedor as string,
  obs:         row.obs as string,
});

export const registroToDb = (r: Registro) => ({
  id:           r.id,
  lote_id:      r.loteId ?? null,
  data:         r.data,
  turno:        r.turno,
  hora_entrada: r.horaEntrada,
  hora_saida:   r.horaSaida,
  total_horas:  r.totalHoras,
  nome:         r.nome,
  cargo:        r.cargo,
  setor:        r.setor,
  unidade:      r.unidade,
  cc:           r.cc,
  motivo:       r.motivo,
  fornecedor:   r.fornecedor,
  obs:          r.obs,
});

// ─── CONSTANTES DE OPÇÕES ───────────────────────────────────────
export const KEY_TO_FIELD: Record<string, keyof Registro> = {
  turnos: "turno",
  unidades: "unidade",
  fornecedores: "fornecedor",
  motivos: "motivo",
  cargos: "cargo",
  ccList: "cc",
  setores: "setor",
};
