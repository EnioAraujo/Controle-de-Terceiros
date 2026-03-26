import type { Registro } from "@/types/attendance";

// ─── FORMATAÇÃO DE DATA ──────────────────────────────────────────
export const hoje = () => new Date().toISOString().slice(0, 10);

export const fmt = (d: string, locale = "pt-BR") =>
  d ? new Date(d + "T00:00:00").toLocaleDateString(locale) : "—";

export const fmtMes = (ym: string, locale = "pt-BR") => {
  const d = new Date(ym + "-01T00:00:00");
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
  const year  = d.getFullYear();
  // Normaliza: capitalize + remove ponto final (ex: "mar." → "Mar")
  const m = month.charAt(0).toUpperCase() + month.slice(1).replace(/\.$/, "");
  if (locale === "en-US")
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(d);
  return `${m}/${year}`;
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
};

// ─── WHATSAPP ───────────────────────────────────────────────────

export type WhatsAppField = "data" | "turno" | "nome" | "cargo" | "fornecedor" | "unidade" | "cc" | "horaEntrada" | "horaSaida" | "totalHoras" | "motivo" | "obs";

export interface WhatsAppTemplate {
  header: string;
  campos: WhatsAppField[];
}

export const WHATSAPP_FIELDS: { key: WhatsAppField; label: string }[] = [
  { key: "data",        label: "Data" },
  { key: "turno",       label: "Turno" },
  { key: "nome",        label: "Nome" },
  { key: "cargo",       label: "Cargo" },
  { key: "fornecedor",  label: "Fornecedor" },
  { key: "unidade",     label: "Unidade" },
  { key: "cc",          label: "Centro de Custo" },
  { key: "horaEntrada", label: "Hora Entrada" },
  { key: "horaSaida",   label: "Hora Saída" },
  { key: "totalHoras",  label: "Total Horas" },
  { key: "motivo",      label: "Operação" },
  { key: "obs",         label: "Observação" },
];

const FIELD_LABELS: Record<WhatsAppField, string> = Object.fromEntries(
  WHATSAPP_FIELDS.map(f => [f.key, f.label])
) as Record<WhatsAppField, string>;

export const WA_DEFAULT_TEMPLATE: WhatsAppTemplate = {
  header: "REGISTRO DE PRESENÇA",
  campos: ["data", "turno", "nome", "cargo", "fornecedor", "unidade", "cc", "horaEntrada", "horaSaida", "totalHoras", "motivo", "obs"],
};

const toTitleCase = (s: string) =>
  s.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const fieldValue = (r: Registro, field: WhatsAppField): string => {
  if (field === "data") return fmt(r.data);
  if (field === "nome") return toTitleCase((r as Record<string, string>).nome ?? "");
  return (r as Record<string, string>)[field] ?? "";
};

/** Campos considerados "comuns" em lotes (aparecem uma vez, não por pessoa). */
const COMMON_FIELDS: Set<WhatsAppField> = new Set(["data", "turno", "cargo", "fornecedor", "unidade", "cc", "motivo"]);

/** Campos que são "por pessoa" em lotes. */
const PER_PERSON_FIELDS: Set<WhatsAppField> = new Set(["nome", "horaEntrada", "horaSaida", "totalHoras"]);

export const buildWhatsAppMessage = (registros: Registro[], template: WhatsAppTemplate): string => {
  if (registros.length === 0) return "";
  const { header, campos } = template;
  const lines: string[] = [];

  lines.push(`*${header}*`);
  lines.push("");

  if (registros.length === 1) {
    const r = registros[0];
    for (const campo of campos) {
      const val = fieldValue(r, campo);
      if (campo === "obs" && !val) continue;
      lines.push(`*${FIELD_LABELS[campo]}:* ${val}`);
    }
  } else {
    const first = registros[0];
    const commonCampos = campos.filter(c => COMMON_FIELDS.has(c));
    const personCampos = campos.filter(c => PER_PERSON_FIELDS.has(c));
    const hasObs = campos.includes("obs");

    for (const campo of commonCampos) {
      lines.push(`*${FIELD_LABELS[campo]}:* ${fieldValue(first, campo)}`);
    }

    lines.push("");
    lines.push(`*Colaboradores (${registros.length}):*`);
    for (const r of registros) {
      const nomeFormatado = personCampos.includes("nome") ? toTitleCase(r.nome) : "";
      let linha = nomeFormatado;
      if (personCampos.includes("horaEntrada") || personCampos.includes("horaSaida")) {
        const e = personCampos.includes("horaEntrada") ? r.horaEntrada : "";
        const s = personCampos.includes("horaSaida") ? r.horaSaida : "";
        const tempoStr = e && s ? `${e} - ${s}` : e || s;
        if (tempoStr) linha += `: ${tempoStr}`;
      }
      if (personCampos.includes("totalHoras") && r.totalHoras) linha += ` (${r.totalHoras})`;
      if (linha) lines.push(`• ${linha}`);
    }

    if (hasObs && first.obs) {
      lines.push("");
      lines.push(`*${FIELD_LABELS.obs}:* ${first.obs}`);
    }
  }

  return lines.join("\n");
};
