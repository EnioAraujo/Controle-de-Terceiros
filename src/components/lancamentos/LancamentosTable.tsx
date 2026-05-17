import { Registro } from "@/types/attendance";
import { fmt, fornCor } from "@/lib/format-utils";
import type { ExcedenteInfo } from "@/lib/excedente-utils";
import { Icon, Chip } from "@/components/atoms";
import { tk } from "@/lib/design-tokens";
import { useI18n } from "@/hooks/use-i18n";

interface Props {
  filtered: Registro[];
  grupos: (Registro | Registro[])[];
  selectedIds: string[];
  setSelectedIds: (val: string[] | ((v: string[]) => string[])) => void;
  excedenteMap: Map<string, ExcedenteInfo>;
  fornecedores: string[];
  onDetalhe: (item: Registro | Registro[]) => void;
  onEditar: (item: Registro | Registro[]) => void;
  onConfirmDelete: (ids: string[]) => void;
}

export function LancamentosTable({
  filtered, grupos, selectedIds, setSelectedIds, excedenteMap,
  fornecedores, onDetalhe, onEditar, onConfirmDelete,
}: Props) {
  const { t, lang } = useI18n();
  const cols = [
    t("lanc_col_data"), t("lanc_col_turno"), t("lanc_col_nome"), "Excedente",
    t("lanc_col_forn"), t("lanc_col_unidade"), t("lanc_col_entrada"), t("lanc_col_saida"),
    t("lanc_col_horas"), t("lanc_col_motivo"), t("lanc_col_acoes"),
  ];

  return (
    <div id="tour-tabela" style={{ background: tk.white, border: `1px solid ${tk.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: tk.surfaceLight }}>
              <th style={{ padding: "10px 12px", textAlign: "center", width: 32 }}>
                <input type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={e => setSelectedIds(e.target.checked ? filtered.map(r => r.id) : [])}
                />
              </th>
              {cols.map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: tk.textSecondary, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: .7, whiteSpace: "nowrap", borderBottom: `2px solid ${tk.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 48, color: tk.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                {t("lanc_empty")}
              </td></tr>
            )}
            {grupos.map((item, i) => {
              const isLote = Array.isArray(item);
              const r = isLote ? item[0] : item;
              const count = isLote ? item.length : 1;
              const allIds = isLote ? item.map(x => x.id) : [r.id];
              const bgBase = i % 2 === 0 ? tk.white : tk.surfaceNearly;
              const isChecked = allIds.every(id => selectedIds.includes(id));
              return (
                <tr key={isLote ? r.loteId : r.id}
                  style={{ borderBottom: `1px solid ${tk.surfaceAlt}`, background: bgBase, cursor: "pointer",
                    borderLeft: isLote ? `3px solid ${tk.blue}` : "3px solid transparent" }}
                  onClick={() => onDetalhe(item)}
                  onMouseEnter={e => (e.currentTarget.style.background = tk.blueHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = bgBase)}>
                  <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={e => {
                      e.stopPropagation();
                      setSelectedIds(val => e.target.checked ? [...new Set([...val, ...allIds])] : val.filter(id => !allIds.includes(id)));
                    }} />
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: tk.textSecondary }}>{fmt(r.data, lang)}</td>
                  <td style={{ padding: "10px 12px" }}><Chip label={r.turno} color={tk.blue} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontWeight: 700, color: tk.textPrimary, whiteSpace: "nowrap" }}>{r.nome}</div>
                      {isLote && <span style={{ background: tk.blue, color: tk.white, borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{count}×</span>}
                    </div>
                    {isLote && <div style={{ fontSize: 10, color: tk.textMuted, marginTop: 2 }}>{item.slice(1, 3).map(x => x.nome).join(", ")}{count > 3 ? ` +${count - 3}` : ""}</div>}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {(() => {
                      const info = excedenteMap.get(`${r.data}|${r.turno}`);
                      if (!info || info.limite === null) return <span style={{ color: tk.borderMuted, fontSize: 11 }}>—</span>;
                      if (info.excedente > 0) return (
                        <span style={{ background: tk.redLight, color: tk.red, borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>+{info.excedente}</span>
                      );
                      return <span style={{ color: tk.green, fontSize: 11, fontWeight: 700 }}>✓</span>;
                    })()}
                  </td>
                  <td style={{ padding: "10px 12px" }}><Chip label={r.fornecedor} color={fornCor(r.fornecedor, fornecedores)} /></td>
                  <td style={{ padding: "10px 12px" }}><Chip label={r.unidade} color={tk.green} /></td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: tk.textBody }}>{r.horaEntrada}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: tk.textBody }}>{r.horaSaida}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 800, color: tk.green }}>{r.totalHoras}</td>
                  <td style={{ padding: "10px 12px", color: tk.textSecondary, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.motivo}</td>
                  <td style={{ padding: "10px 12px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => onDetalhe(item)} title="Ver detalhes" style={{ background: tk.surfaceAlt, border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: tk.textSecondary, display: "flex" }}><Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /></button>
                      <button onClick={() => onEditar(item)} title="Editar" style={{ background: tk.blueAccent, border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: tk.blue, display: "flex" }}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                      <button onClick={() => onConfirmDelete(isLote ? item.map(x => x.id) : [r.id])} title="Excluir" style={{ background: tk.redBg, border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: tk.red, display: "flex" }}><Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
