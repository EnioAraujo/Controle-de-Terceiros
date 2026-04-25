import type { FechamentoItem } from "@/lib/fechamento-utils";
import type { TranslationKey } from "@/lib/i18n-translations";

interface FechamentoItensTableProps {
  itens: FechamentoItem[];
  total: number;
  lang: "pt-BR" | "en-US";
  t: (key: TranslationKey) => string;
  fmtCurrency: (v: number) => string;
  showFornecedorCol: boolean;
  resolverFornecedor: (item: FechamentoItem) => string;
  editIdx: number | null;
  editValor: string;
  editObs: string;
  onEditValorChange: (valor: string) => void;
  onEditObsChange: (obs: string) => void;
  onAplicarEdicao: (idx: number) => void;
  onCancelarEdicao: () => void;
  onIniciarEdicao: (idx: number, item: FechamentoItem) => void;
  fmtData: (data: string, lang: "pt-BR" | "en-US") => string;
}

export const FechamentoItensTable = ({
  itens,
  total,
  lang,
  t,
  fmtCurrency,
  showFornecedorCol,
  resolverFornecedor,
  editIdx,
  editValor,
  editObs,
  onEditValorChange,
  onEditObsChange,
  onAplicarEdicao,
  onCancelarEdicao,
  onIniciarEdicao,
  fmtData,
}: FechamentoItensTableProps) => {
  const colSpanAntesTotal = showFornecedorCol ? 6 : 5;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
            {[
              t("fech_col_data"),
              t("fech_col_turno"),
              ...(showFornecedorCol ? [t("fech_col_fornecedor")] : []),
              t("fech_col_nome"),
              t("fech_col_horas"),
              t("fech_col_diaria"),
              t("fech_col_vlr_dia"),
              t("fech_col_diff"),
              t("fech_col_obs"),
              t("fech_col_acoes"),
            ].map((h) => (
              <th key={h} style={{ padding: "8px 10px", fontWeight: 700, color: "#475569", borderBottom: "2px solid #E2E6EC", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: item.ajusteManual ? "#FFFBEB" : "transparent" }}>
              <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{fmtData(item.data, lang)}</td>
              <td style={{ padding: "7px 10px", color: "#64748B" }}>{item.turno}</td>
              {showFornecedorCol && (
                <td style={{ padding: "7px 10px", color: "#475569", whiteSpace: "nowrap" }}>{resolverFornecedor(item)}</td>
              )}
              <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0F1C2E", whiteSpace: "nowrap" }}>{item.nome}</td>
              <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{item.horas}</td>
              <td style={{ padding: "7px 10px", color: "#64748B" }}>{fmtCurrency(item.valorDiaria)}</td>
              {editIdx === idx ? (
                <>
                  <td style={{ padding: "4px 6px" }}>
                    <input
                      type="number"
                      step="0.01"
                      value={editValor}
                      onChange={(e) => onEditValorChange(e.target.value)}
                      style={{ width: 80, border: "1.5px solid #1A56DB", borderRadius: 5, padding: "4px 6px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                    />
                  </td>
                  <td></td>
                  <td style={{ padding: "4px 6px" }}>
                    <input
                      value={editObs}
                      onChange={(e) => onEditObsChange(e.target.value)}
                      placeholder={t("fech_col_obs")}
                      style={{ width: 100, border: "1.5px solid #E2E6EC", borderRadius: 5, padding: "4px 6px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                    />
                  </td>
                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                    <button onClick={() => onAplicarEdicao(idx)} style={{ background: "#0E9F6E", border: "none", borderRadius: 5, padding: "4px 10px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginRight: 4 }}>✓</button>
                    <button onClick={onCancelarEdicao} style={{ background: "#F1F5F9", border: "none", borderRadius: 5, padding: "4px 10px", color: "#64748B", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: "7px 10px", fontWeight: 700, color: item.ajusteManual ? "#D97706" : "#0E9F6E" }}>{fmtCurrency(item.valorCalculado)}</td>
                  {(() => {
                    const diff = item.valorCalculado - item.valorDiaria;
                    return (
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: diff < 0 ? "#E02424" : diff > 0 ? "#0E9F6E" : "#94A3B8" }}>
                        {diff !== 0 ? fmtCurrency(diff) : "—"}
                      </td>
                    );
                  })()}
                  <td style={{ padding: "7px 10px", color: "#94A3B8", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.obs}</td>
                  <td style={{ padding: "7px 10px" }}>
                    <button
                      onClick={() => onIniciarEdicao(idx, item)}
                      title={t("fech_ajuste")}
                      style={{ background: "transparent", border: "1px solid #E2E6EC", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit" }}
                    >
                      ✎
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#F1F5F9" }}>
            <td colSpan={colSpanAntesTotal} style={{ padding: "8px 10px", fontWeight: 800, color: "#0F1C2E", textAlign: "right" }}>{t("fech_total")}</td>
            <td style={{ padding: "8px 10px", fontWeight: 800, color: "#0E9F6E" }}>{fmtCurrency(total)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
