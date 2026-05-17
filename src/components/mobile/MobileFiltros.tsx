export interface MobileFiltrosState {
  data: string;
  turno: string;
  fornecedor: string;
}

interface Props {
  filtros: MobileFiltrosState;
  setFiltros: (f: MobileFiltrosState | ((prev: MobileFiltrosState) => MobileFiltrosState)) => void;
  showFiltros: boolean;
  toggleShow: () => void;
  turnosOpts: string[];
  fornecedoresOpts: string[];
}

const labelStyle = { fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: 0.7 };
const inputStyle = {
  border: "1.5px solid #E8E8EA", borderRadius: 8,
  padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
  color: "#0F1C2E", background: "#FAFAFA", width: "100%", boxSizing: "border-box" as const,
};

export function MobileFiltros({ filtros, setFiltros, showFiltros, toggleShow, turnosOpts, fornecedoresOpts }: Props) {
  return (
    <>
      <button
        onClick={toggleShow}
        style={{
          width: "100%", border: "1px solid #E2E6EC",
          background: "#fff", borderRadius: 10,
          padding: "11px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "inherit", cursor: "pointer", fontSize: 14,
          fontWeight: 600, color: "#334155",
        }}
      >
        <span>Filtros</span>
        <span style={{ color: "#94A3B8", fontSize: 16 }}>{showFiltros ? "▴" : "▾"}</span>
      </button>

      {showFiltros && (
        <div style={{
          background: "#fff", border: "1px solid #E2E6EC",
          borderRadius: 10, padding: "14px 14px",
          marginBottom: 10, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Data</span>
            <input
              type="date"
              value={filtros.data}
              onChange={e => setFiltros(f => ({ ...f, data: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Turno</span>
            <select
              value={filtros.turno}
              onChange={e => setFiltros(f => ({ ...f, turno: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Todos os turnos</option>
              {turnosOpts.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Fornecedor</span>
            <select
              value={filtros.fornecedor}
              onChange={e => setFiltros(f => ({ ...f, fornecedor: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Todos os fornecedores</option>
              {fornecedoresOpts.map(opt => <option key={opt}>{opt}</option>)}
            </select>
          </label>

          <button
            onClick={() => setFiltros({ data: "", turno: "", fornecedor: "" })}
            style={{
              border: "1px solid #E2E6EC", background: "#F8FAFC",
              borderRadius: 8, padding: "9px", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, color: "#64748B", cursor: "pointer",
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </>
  );
}
