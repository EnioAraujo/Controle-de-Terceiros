import { Registro } from "@/types/attendance";
import { fmt, fornCor } from "@/lib/format-utils";

const Chip = ({ label, color = "#1A56DB", bg }: { label: string; color?: string; bg?: string }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, color,
    background: bg || `${color}1A`,
    whiteSpace: "nowrap", letterSpacing: 0.2,
  }}>{label}</span>
);

interface Props {
  item: Registro | Registro[];
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onTap: () => void;
  fornecedores: string[];
  lang: string;
}

export function MobileLancamentoCard({ item, checked, onCheck, onTap, fornecedores, lang }: Props) {
  const isLote = Array.isArray(item);
  const r = isLote ? item[0] : item;
  const count = isLote ? item.length : 1;

  return (
    <div
      onClick={onTap}
      style={{
        background: "#fff",
        border: `1px solid ${checked ? "#1A56DB" : "#E2E6EC"}`,
        borderLeft: `4px solid ${isLote ? "#1A56DB" : fornCor(r.fornecedor, fornecedores)}`,
        borderRadius: 12,
        padding: "14px 14px 14px 12px",
        marginBottom: 10,
        cursor: "pointer",
        boxShadow: checked ? "0 0 0 2px #1A56DB22" : "0 1px 3px #00000010",
        wordBreak: "break-word",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          onClick={e => { e.stopPropagation(); onCheck(!checked); }}
          style={{
            width: 20, height: 20, flexShrink: 0,
            border: `2px solid ${checked ? "#1A56DB" : "#CBD5E1"}`,
            borderRadius: 5, background: checked ? "#1A56DB" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {checked && (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
          )}
        </span>
        <Chip label={r.turno} color="#1A56DB" />
        {isLote && (
          <span style={{
            background: "#1A56DB", color: "#fff",
            borderRadius: 99, padding: "1px 8px",
            fontSize: 11, fontWeight: 800,
          }}>{count}×</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
          {fmt(r.data, lang)}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, color: "#0F1C2E", marginBottom: 4, lineHeight: 1.3 }}>
        {r.nome}
      </div>
      {isLote && item.length > 1 && (
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>
          {item.slice(1).map(x => (
            <div key={x.id} style={{ lineHeight: 1.4 }}>{x.nome}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
          {r.horaEntrada}{r.horaSaida ? ` — ${r.horaSaida}` : ""}
        </span>
        {r.totalHoras && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#0E9F6E",
            background: "#ECFDF5", padding: "1px 8px", borderRadius: 8,
          }}>{r.totalHoras}</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label={r.fornecedor} color={fornCor(r.fornecedor, fornecedores)} />
        {r.cargo && <span style={{ fontSize: 11, color: "#94A3B8", alignSelf: "center" }}>{r.cargo}</span>}
      </div>
    </div>
  );
}
