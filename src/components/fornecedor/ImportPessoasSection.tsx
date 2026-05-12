import { useState } from "react";
import { downloadTemplate } from "@/lib/fornecedor-pessoas-template";
import { parseImportFile, type ImportPessoasResult } from "@/lib/fornecedor-pessoas-import";

interface Props {
  cargosValidos: string[];
  onConfirm: (itens: { nome: string; cargo: string }[]) => Promise<{ inseridos: number }>;
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  background: "#212B36",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 16px",
  background: "transparent",
  color: "#212B36",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function ImportPessoasSection({ cargosValidos, onConfirm }: Props) {
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ImportPessoasResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsing(true);
    setMsg(null);
    try {
      const r = await parseImportFile(file, cargosValidos);
      setResult(r);
      setFilename(file.name);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao ler o arquivo.";
      setMsg({ ok: false, text });
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!result || result.valid.length === 0) return;
    setConfirming(true);
    setMsg(null);
    try {
      const { inseridos } = await onConfirm(result.valid);
      setMsg({ ok: true, text: `${inseridos} registro(s) importado(s).` });
      setResult(null);
      setFilename(null);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Erro ao importar.";
      setMsg({ ok: false, text });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#212B36" }}>Importar funcionários</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={btnSecondary} onClick={() => downloadTemplate()}>
            Baixar modelo (XLSX)
          </button>
          <label style={{ ...btnPrimary, display: "inline-block", textAlign: "center", cursor: parsing ? "default" : "pointer", opacity: parsing ? 0.6 : 1 }}>
            {parsing ? "Lendo…" : "Escolher arquivo"}
            <input type="file" accept=".csv,.xlsx,.xlsm,.txt" onChange={handleFile} style={{ display: "none" }} disabled={parsing} />
          </label>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? "#D1FAE5" : "#FEE2E2", color: msg.ok ? "#065F46" : "#991B1B", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {result && (
        <div>
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
            <strong>{filename}</strong> · {result.total} linha(s) ·{" "}
            <span style={{ color: "#0E9F6E" }}>{result.valid.length} válidas</span> ·{" "}
            <span style={{ color: "#EF4444" }}>{result.invalid.length} inválidas</span>
          </p>
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: "#F9FAFB", zIndex: 1 }}>
                <tr style={{ color: "#6B7280", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.08em" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: 60 }}>Linha</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Nome / Motivo</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Cargo</th>
                </tr>
              </thead>
              <tbody>
                {result.valid.map((p, i) => (
                  <tr key={`v-${i}`} style={{ background: "#ECFDF5" }}>
                    <td style={{ padding: "6px 12px", color: "#065F46" }}>OK</td>
                    <td style={{ padding: "6px 12px", color: "#065F46" }}>{p.nome}</td>
                    <td style={{ padding: "6px 12px", color: "#065F46" }}>{p.cargo}</td>
                  </tr>
                ))}
                {result.invalid.map((p, i) => (
                  <tr key={`i-${i}`} style={{ background: "#FEF2F2" }}>
                    <td style={{ padding: "6px 12px", color: "#991B1B" }}>{p.linha}</td>
                    <td style={{ padding: "6px 12px", color: "#991B1B" }} colSpan={2}>{p.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" style={btnSecondary} onClick={() => { setResult(null); setFilename(null); }} disabled={confirming}>
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...btnPrimary, opacity: confirming || result.valid.length === 0 ? 0.6 : 1 }}
              onClick={handleConfirm}
              disabled={confirming || result.valid.length === 0}
            >
              {confirming ? "Importando…" : `Confirmar (${result.valid.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
