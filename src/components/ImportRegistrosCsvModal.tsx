import { useState } from "react";
import { Btn, Modal } from "@/components/atoms";
import { useI18n } from "@/hooks/use-i18n";
import { logAudit } from "@/lib/audit";
import { importRegistrosFromCsv, type ImportCsvResult } from "@/lib/import-registros-csv";
import type { Registro } from "@/types/attendance";

interface ImportRegistrosCsvModalProps {
  onClose: () => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
}

export const ImportRegistrosCsvModal = ({ onClose, registros, setRegistros }: ImportRegistrosCsvModalProps) => {
  const { t } = useI18n();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportCsvResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const analisarArquivo = async (file: File) => {
    setErrorMsg("");
    setPreview(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = importRegistrosFromCsv(text, registros);
      setPreview(result);
    } catch {
      setErrorMsg("Falha ao ler o arquivo CSV.");
    }
  };

  const aplicarImportacao = () => {
    if (!preview || preview.valid.length === 0) return;
    setRegistros([...registros, ...preview.valid]);
    logAudit("IMPORT", "registros", undefined, {
      fonte: fileName,
      total_linhas: preview.totalRows,
      importados: preview.valid.length,
      rejeitados: preview.invalid.length,
    });
    onClose();
  };

  return (
    <Modal title={t("imp_csv_title")} subtitle={t("imp_csv_subtitle")} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E6EC", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>{t("imp_csv_help")}</div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void analisarArquivo(file);
            }}
          />
        </div>

        {errorMsg && (
          <div style={{ background: "#FDE8E8", color: "#B91C1C", borderRadius: 8, padding: "10px 12px", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {preview && (
          <div style={{ border: "1px solid #E2E6EC", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#F8FAFC", padding: "10px 12px", borderBottom: "1px solid #E2E6EC", fontSize: 12, color: "#475569", fontWeight: 700 }}>
              {fileName || t("imp_csv_select")}
            </div>
            <div style={{ padding: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "#ECFDF5", borderRadius: 8, padding: "10px 12px", color: "#065F46", fontSize: 12, fontWeight: 700 }}>
                  {t("imp_csv_valid").replace("{n}", String(preview.valid.length))}
                </div>
                <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 12px", color: "#991B1B", fontSize: 12, fontWeight: 700 }}>
                  {t("imp_csv_invalid").replace("{n}", String(preview.invalid.length))}
                </div>
              </div>

              {preview.invalid.length > 0 && (
                <div style={{ marginTop: 10, maxHeight: 140, overflowY: "auto", border: "1px solid #F1F5F9", borderRadius: 8, padding: "8px 10px" }}>
                  {preview.invalid.slice(0, 12).map(issue => (
                    <div key={`${issue.line}-${issue.reason}`} style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.5 }}>
                      Linha {issue.line}: {issue.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>{t("imp_csv_cancel")}</Btn>
          <Btn onClick={aplicarImportacao} disabled={!preview || preview.valid.length === 0}>
            {t("imp_csv_apply")}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};
