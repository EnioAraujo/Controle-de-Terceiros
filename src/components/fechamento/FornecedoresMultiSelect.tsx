import { useState } from "react";

interface FornecedoresMultiSelectProps {
  fornecedores: string[];
  selecionados: string[];
  onChange: (selecionados: string[]) => void;
  label: string;
  placeholder: string;
  selectedSuffix: string;
}

export const FornecedoresMultiSelect = ({
  fornecedores,
  selecionados,
  onChange,
  label,
  placeholder,
  selectedSuffix,
}: FornecedoresMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const toggleFornecedor = (fornecedor: string, checked: boolean) => {
    if (checked) {
      onChange([...selecionados, fornecedor]);
      return;
    }
    onChange(selecionados.filter((f) => f !== fornecedor));
  };

  return (
    <div>
      <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
      <div
        tabIndex={-1}
        style={{ position: "relative" }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", minWidth: 220, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%" }}
        >
          <span style={{ color: selecionados.length === 0 ? "#94A3B8" : "#0F1C2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selecionados.length === 0
              ? placeholder
              : selecionados.length === 1
                ? selecionados[0]
                : `${selecionados.length} ${selectedSuffix}`}
          </span>
          <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, background: "#fff", border: "1.5px solid #E2E6EC", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 220, maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
            {fornecedores.map((fornecedor) => (
              <label
                key={fornecedor}
                onMouseDown={(e) => e.preventDefault()}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, color: "#0F1C2E", fontFamily: "inherit", userSelect: "none" }}
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(fornecedor)}
                  onChange={(e) => toggleFornecedor(fornecedor, e.target.checked)}
                  style={{ accentColor: "#1A56DB", width: 15, height: 15, flexShrink: 0 }}
                />
                {fornecedor}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
