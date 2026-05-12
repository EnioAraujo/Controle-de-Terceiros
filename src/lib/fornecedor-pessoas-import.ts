// Parser unificado CSV (separador ;) e XLSX para a importação de
// funcionários do fornecedor. Saída: { valid, invalid, total }.

export interface ImportPessoaValid {
  nome: string;
  cargo: string;
}

export interface ImportPessoaIssue {
  linha: number;
  motivo: string;
}

export interface ImportPessoasResult {
  valid: ImportPessoaValid[];
  invalid: ImportPessoaIssue[];
  total: number;
}

// ── normalização ─────────────────────────────────────────────
const stripDiacritics = (v: string): string =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeHeader = (v: string): string =>
  stripDiacritics(v).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const HEADER_ALIASES: Record<string, "nome" | "cargo"> = {
  nome_completo: "nome",
  nome: "nome",
  funcionario: "nome",
  cargo: "cargo",
  funcao: "cargo",
};

const cleanName = (v: string): string =>
  v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const cleanCargo = (v: string): string => cleanName(v);

// ── CSV ──────────────────────────────────────────────────────
const splitSemicolonLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i += 1; }
      else q = !q;
      continue;
    }
    if (ch === ";" && !q) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
};

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return clean.split("\n").filter(l => l.trim().length > 0).map(splitSemicolonLine);
}

// ── XLSX ─────────────────────────────────────────────────────
async function parseXlsx(file: File): Promise<string[][]> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as Array<string | number | undefined | null>;
    rows.push(values.slice(1).map(c => (c == null ? "" : String(c))));
  });
  return rows;
}

// ── núcleo ───────────────────────────────────────────────────
function buildResult(rows: string[][], cargosValidos: string[]): ImportPessoasResult {
  if (rows.length < 2) {
    return { valid: [], invalid: [{ linha: 1, motivo: "Arquivo sem dados." }], total: 0 };
  }

  const headers = rows[0].map(normalizeHeader);
  const idxNome = headers.findIndex(h => HEADER_ALIASES[h] === "nome");
  const idxCargo = headers.findIndex(h => HEADER_ALIASES[h] === "cargo");

  if (idxNome < 0 || idxCargo < 0) {
    return { valid: [], invalid: [{ linha: 1, motivo: "Cabeçalho deve conter colunas 'Nome Completo' e 'Cargo'." }], total: 0 };
  }

  const cargosSet = new Set(cargosValidos.map(c => cleanCargo(c)));
  const valid: ImportPessoaValid[] = [];
  const invalid: ImportPessoaIssue[] = [];
  const vistos = new Set<string>();

  for (let i = 1; i < rows.length; i += 1) {
    const linha = i + 1; // 1-based, considerando header
    const cells = rows[i];
    const nome = cleanName(cells[idxNome] ?? "");
    const cargo = cleanCargo(cells[idxCargo] ?? "");

    if (!nome) { invalid.push({ linha, motivo: "Nome vazio." }); continue; }
    if (nome.length < 3) { invalid.push({ linha, motivo: "Nome muito curto (mín. 3 caracteres)." }); continue; }
    if (!cargo) { invalid.push({ linha, motivo: "Cargo vazio." }); continue; }
    if (!cargosSet.has(cargo)) {
      invalid.push({ linha, motivo: `Cargo "${cargo}" não está na lista de cargos válidos.` });
      continue;
    }
    if (vistos.has(nome)) {
      invalid.push({ linha, motivo: "Nome duplicado neste arquivo." });
      continue;
    }
    vistos.add(nome);
    valid.push({ nome, cargo });
  }

  return { valid, invalid, total: rows.length - 1 };
}

export async function parseImportFile(file: File, cargosValidos: string[]): Promise<ImportPessoasResult> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xlsm") {
    const rows = await parseXlsx(file);
    return buildResult(rows, cargosValidos);
  }
  if (ext === "csv" || ext === "txt") {
    const text = await file.text();
    return buildResult(parseCsv(text), cargosValidos);
  }
  return { valid: [], invalid: [{ linha: 0, motivo: `Formato não suportado (.${ext}). Use .csv ou .xlsx.` }], total: 0 };
}
