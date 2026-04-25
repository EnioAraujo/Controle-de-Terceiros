import { sanitize } from "@/lib/audit";
import { calcHoras } from "@/lib/format-utils";
import type { Registro } from "@/types/attendance";

export interface ImportIssue {
  line: number;
  reason: string;
}

export interface ImportCsvResult {
  valid: Registro[];
  invalid: ImportIssue[];
  totalRows: number;
}

const normalizeHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const splitSemicolonLine = (line: string): string[] => {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  out.push(current.trim());
  return out;
};

const toUpperSafe = (value: string): string => sanitize(value.trim().toUpperCase());

const parseDateBrToIso = (value: string): string | null => {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
};

const parseTimeToHm = (value: string): string | null => {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const dedupKey = (r: Registro): string =>
  `${r.data}|${r.turno}|${r.nome}|${r.fornecedor}|${r.horaEntrada}|${r.horaSaida}`;

const conflitoTurnoKey = (r: Registro): string => `${r.data}|${r.nome}`;

export const importRegistrosFromCsv = (
  csvText: string,
  existentes: Registro[],
): ImportCsvResult => {
  const text = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return { valid: [], invalid: [{ line: 1, reason: "Arquivo sem dados." }], totalRows: 0 };
  }

  const headerCells = splitSemicolonLine(lines[0]).map(normalizeHeader);
  const indexByHeader = new Map(headerCells.map((h, idx) => [h, idx]));

  const required = [
    "data_presenca",
    "turno",
    "hora_entrada",
    "hora_saida",
    "nome_completo_terceiro",
    "cargo",
    "unidade",
    "centro_custo",
    "motivo",
    "fornecedor",
  ];

  const missingHeaders = required.filter(h => !indexByHeader.has(h));
  if (missingHeaders.length > 0) {
    return {
      valid: [],
      invalid: [{ line: 1, reason: `Cabeçalho ausente: ${missingHeaders.join(", ")}` }],
      totalRows: 0,
    };
  }

  const parsed: Array<{ row: Registro; line: number }> = [];
  const invalid: ImportIssue[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const cells = splitSemicolonLine(lines[i]);
    const get = (header: string): string => {
      const idx = indexByHeader.get(header);
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const data = parseDateBrToIso(get("data_presenca"));
    const turno = toUpperSafe(get("turno"));
    const horaEntrada = parseTimeToHm(get("hora_entrada"));
    const horaSaida = parseTimeToHm(get("hora_saida"));
    const nome = toUpperSafe(get("nome_completo_terceiro"));
    const cargo = toUpperSafe(get("cargo"));
    const unidade = toUpperSafe(get("unidade"));
    const cc = toUpperSafe(get("centro_custo"));
    const motivo = toUpperSafe(get("motivo")) || "NAO INFORMADO";
    const fornecedor = toUpperSafe(get("fornecedor"));
    const obs = toUpperSafe(get("obsevacao") || get("observacao"));

    if (!data) {
      invalid.push({ line: lineNumber, reason: "Data inválida (esperado DD/MM/YYYY)." });
      continue;
    }
    if (!nome) {
      invalid.push({ line: lineNumber, reason: "Nome obrigatório ausente." });
      continue;
    }
    if (!turno || !horaEntrada || !horaSaida) {
      invalid.push({ line: lineNumber, reason: "Turno/entrada/saída inválidos." });
      continue;
    }

    const totalInformado = parseTimeToHm(get("total_horas"));
    const totalHoras = totalInformado || calcHoras(horaEntrada, horaSaida);
    if (!totalHoras) {
      invalid.push({ line: lineNumber, reason: "Total de horas inválido." });
      continue;
    }

    parsed.push({
      line: lineNumber,
      row: {
        id: crypto.randomUUID(),
        data,
        turno,
        horaEntrada,
        horaSaida,
        totalHoras,
        nome,
        cargo,
        setor: "",
        unidade,
        cc,
        motivo,
        fornecedor,
        obs,
      },
    });
  }

  const seen = new Set(existentes.map(dedupKey));
  const turnosPorNomeData = new Map<string, string>();
  existentes.forEach(r => turnosPorNomeData.set(conflitoTurnoKey(r), r.turno));

  const valid: Registro[] = [];
  for (const item of parsed) {
    const keyTurno = conflitoTurnoKey(item.row);
    const turnoExistente = turnosPorNomeData.get(keyTurno);
    if (turnoExistente && turnoExistente !== item.row.turno) {
      invalid.push({ line: item.line, reason: `Conflito de turno: já existe ${turnoExistente} para este nome/data.` });
      continue;
    }

    const key = dedupKey(item.row);
    if (seen.has(key)) {
      invalid.push({ line: item.line, reason: "Registro duplicado (já existente ou repetido no arquivo)." });
      continue;
    }

    seen.add(key);
    turnosPorNomeData.set(keyTurno, item.row.turno);
    valid.push(item.row);
  }

  return { valid, invalid, totalRows: lines.length - 1 };
};
