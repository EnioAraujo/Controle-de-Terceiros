import { useState, useRef } from "react";
import DOMPurify from "dompurify";
import { useI18n } from "@/hooks/use-i18n";
import type { Registro } from "@/types/attendance";

interface Props {
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
}

const sanitize = (v: string) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] });

// Maps Excel column headers (case-insensitive) to Registro fields
const HEADER_MAP: Record<string, keyof Registro> = {
  data_presenca: "data",
  turno: "turno",
  hora_entrada: "horaEntrada",
  hora_saida: "horaSaida",
  hora_saída: "horaSaida",
  total_horas: "totalHoras",
  nome_completo_terceiro: "nome",
  nome: "nome",
  cargo: "cargo",
  unidade: "unidade",
  centro_custo: "cc",
  cc: "cc",
  motivo: "motivo",
  fornecedor: "fornecedor",
  observação: "obs",
  observacao: "obs",
  obs: "obs",
};

/** Convert "DD/MM/YYYY" or Date object to "YYYY-MM-DD" */
function parseDate(raw: unknown): string | null {
  if (!raw) return null;

  // Date object (xlsx may parse dates this way)
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY
  const parts = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (parts) {
    const [, dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // Excel serial number
  const num = Number(s);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  return null;
}

/** Normalize time: "13:40:00" → "13:40", fractional → "HH:MM" */
function parseTime(raw: unknown): string {
  if (!raw) return "";
  const s = String(raw).trim();

  // HH:MM:SS or HH:MM
  const tm = s.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
  if (tm) {
    const hh = tm[1].padStart(2, "0");
    const mm = tm[2].padStart(2, "0");
    const ss = tm[4] ? tm[4].padStart(2, "0") : "00";
    return `${hh}:${mm}:${ss}`;
  }

  // Fractional day (xlsx pode retornar 0.5694 para 13:40)
  const n = Number(s);
  if (!isNaN(n) && n >= 0 && n < 1) {
    const totalSec = Math.round(n * 86400);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  // Se vier Date, extrai só hora
  if (raw instanceof Date) {
    const hh = String(raw.getHours()).padStart(2, "0");
    const mm = String(raw.getMinutes()).padStart(2, "0");
    const ss = String(raw.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  // Se vier string tipo "1899-12-30T05:20:00.000Z" (bug xlsx), extrai só hora
  const iso = s.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}:${iso[3]}`;

  return s;
}

type ParseResult = {
  parsed: Registro[];
  duplicates: number;
  errors: number;
  total: number;
};

export default function ImportExcelRegistros({ registros, setRegistros }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");

  const existingKeys = new Set(
    registros.map(r => `${r.nome.trim().toLowerCase()}|${r.data}|${r.turno.trim().toLowerCase()}`)
  );

  const handleFile = async (file: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    setImported(false);

    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (rows.length === 0) {
        setError(t("imp_err_empty"));
        setLoading(false);
        return;
      }

      // Build column mapping from actual headers
      const rawHeaders = Object.keys(rows[0]);
      const colMap: Record<string, keyof Registro> = {};
      for (const h of rawHeaders) {
        const normalised = h.trim().toLowerCase().replace(/\s+/g, "_");
        if (HEADER_MAP[normalised]) colMap[h] = HEADER_MAP[normalised];
      }

      // Validate required columns
      const mappedFields = new Set(Object.values(colMap));
      const required: (keyof Registro)[] = ["data", "turno", "nome", "fornecedor"];
      const missing = required.filter(f => !mappedFields.has(f));
      if (missing.length > 0) {
        setError(t("imp_err_cols").replace("{cols}", missing.join(", ")));
        setLoading(false);
        return;
      }

      const parsed: Registro[] = [];
      let duplicates = 0;
      let errors = 0;
      const seenInBatch = new Set<string>();

      for (const row of rows) {
        // Extract mapped values
        const rec: Record<string, string> = {};
        for (const [excelCol, regField] of Object.entries(colMap)) {
          rec[regField] = sanitize(String(row[excelCol] ?? "").trim());
        }

        // Parse date
        const dataRaw = Object.entries(colMap).find(([, v]) => v === "data")?.[0];
        const dataVal = dataRaw ? parseDate(row[dataRaw]) : null;
        if (!dataVal) { errors++; continue; }

        // Parse times
        const heRaw = Object.entries(colMap).find(([, v]) => v === "horaEntrada")?.[0];
        const hsRaw = Object.entries(colMap).find(([, v]) => v === "horaSaida")?.[0];
        const thRaw = Object.entries(colMap).find(([, v]) => v === "totalHoras")?.[0];

        const nome = rec.nome || "";
        const turno = rec.turno || "";
        if (!nome || !turno) { errors++; continue; }

        // Duplicate check against existing DB records
        const key = `${nome.toLowerCase()}|${dataVal}|${turno.toLowerCase()}`;
        if (existingKeys.has(key) || seenInBatch.has(key)) {
          duplicates++;
          continue;
        }
        seenInBatch.add(key);

        parsed.push({
          id: crypto.randomUUID(),
          data: dataVal,
          turno,
          horaEntrada: heRaw ? parseTime(row[heRaw]) : "",
          horaSaida: hsRaw ? parseTime(row[hsRaw]) : "",
          totalHoras: thRaw ? parseTime(row[thRaw]) : "",
          nome,
          cargo: rec.cargo || "",
          setor: rec.setor || "",
          unidade: rec.unidade || "",
          cc: rec.cc || "",
          motivo: rec.motivo || "",
          fornecedor: rec.fornecedor || "",
          obs: rec.obs || "",
        });
      }

      setResult({ parsed, duplicates, errors, total: rows.length });
    } catch (e) {
      setError(t("imp_err_parse"));
      console.error("Import error:", e);
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    if (!result || result.parsed.length === 0) return;

    // Generate a common lote_id for the import batch
    const loteId = crypto.randomUUID();
    const withLote = result.parsed.map(r => ({ ...r, loteId }));

    setRegistros([...registros, ...withLote]);
    setImported(true);
  };

  const reset = () => {
    setResult(null);
    setImported(false);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Preview: first 5 rows
  const preview = result?.parsed.slice(0, 5) ?? [];

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1A56DB", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("imp_title")}</div>
      </div>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14, paddingLeft: 20 }}>{t("imp_desc")}</div>

      {/* Upload area */}
      {!result && !imported && (
        <div style={{ paddingLeft: 20 }}>
          <label
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed #CBD5E1", borderRadius: 10, padding: "28px 20px", cursor: "pointer",
              background: "#F8FAFC", transition: "border-color .2s",
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#1A56DB"; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#CBD5E1";
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 8 }}>{t("imp_drop")}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>.xlsx, .xls</div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {loading && (
            <div style={{ fontSize: 12, color: "#1A56DB", marginTop: 10, fontWeight: 600 }}>{t("imp_loading")}</div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: "#E02424", marginTop: 10, fontWeight: 600, background: "#FEE2E2", borderRadius: 7, padding: "7px 12px" }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Preview & Confirm */}
      {result && !imported && (
        <div style={{ paddingLeft: 20 }}>
          {/* Summary badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, background: "#E0E7FF", color: "#1A56DB", borderRadius: 99, padding: "3px 12px" }}>
              {t("imp_total").replace("{n}", String(result.total))}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, background: "#D1FAE5", color: "#065F46", borderRadius: 99, padding: "3px 12px" }}>
              {t("imp_new").replace("{n}", String(result.parsed.length))}
            </span>
            {result.duplicates > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, background: "#FEF3C7", color: "#92400E", borderRadius: 99, padding: "3px 12px" }}>
                {t("imp_dup").replace("{n}", String(result.duplicates))}
              </span>
            )}
            {result.errors > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, background: "#FEE2E2", color: "#991B1B", borderRadius: 99, padding: "3px 12px" }}>
                {t("imp_err_rows").replace("{n}", String(result.errors))}
              </span>
            )}
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7, marginBottom: 6 }}>
                {t("imp_preview")}
              </div>
              <div style={{ overflowX: "auto", marginBottom: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9" }}>
                      {["Data", "Turno", "Nome", "Fornecedor", "Cargo", "H.Ent", "H.Saí", "Total"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#334155", borderBottom: "1px solid #E2E6EC" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "5px 8px" }}>{r.data}</td>
                        <td style={{ padding: "5px 8px" }}>{r.turno}</td>
                        <td style={{ padding: "5px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</td>
                        <td style={{ padding: "5px 8px" }}>{r.fornecedor}</td>
                        <td style={{ padding: "5px 8px" }}>{r.cargo}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "'DM Mono',monospace" }}>{r.horaEntrada}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "'DM Mono',monospace" }}>{r.horaSaida}</td>
                        <td style={{ padding: "5px 8px", fontFamily: "'DM Mono',monospace" }}>{r.totalHoras}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.parsed.length > 5 && (
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>
                  …{t("imp_more").replace("{n}", String(result.parsed.length - 5))}
                </div>
              )}
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {result.parsed.length > 0 && (
              <button
                onClick={confirmImport}
                style={{
                  background: "#0E9F6E", border: "none", borderRadius: 8, padding: "10px 20px",
                  cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                }}
              >
                {t("imp_confirm").replace("{n}", String(result.parsed.length))}
              </button>
            )}
            <button
              onClick={reset}
              style={{
                background: "#F1F5F9", border: "1px solid #E2E6EC", borderRadius: 8, padding: "10px 20px",
                cursor: "pointer", color: "#334155", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
              }}
            >
              {t("imp_cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {imported && (
        <div style={{ paddingLeft: 20 }}>
          <div style={{ fontSize: 13, color: "#0E9F6E", fontWeight: 700, background: "#D1FAE5", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
            ✓ {t("imp_success").replace("{n}", String(result?.parsed.length ?? 0))}
          </div>
          <button
            onClick={reset}
            style={{
              background: "#F1F5F9", border: "1px solid #E2E6EC", borderRadius: 8, padding: "10px 20px",
              cursor: "pointer", color: "#334155", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
            }}
          >
            {t("imp_another")}
          </button>
        </div>
      )}
    </div>
  );
}
