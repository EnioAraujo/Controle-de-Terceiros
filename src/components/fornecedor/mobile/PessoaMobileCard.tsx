import type { Pessoa } from "@/types/hierarquia";

interface Props {
  pessoa: Pessoa;
  onEdit: (p: Pessoa) => void;
  onDelete: (p: Pessoa) => void;
}

export function PessoaMobileCard({ pessoa, onEdit, onDelete }: Props) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(26,28,29,0.06)",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "#212B36", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pessoa.nome}
        </p>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            background: "#F37E3815",
            color: "#F37E38",
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {pessoa.cargo || "—"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onEdit(pessoa)}
          style={{ background: "#F3F4F6", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onDelete(pessoa)}
          style={{ background: "#FEF2F2", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#EF4444" }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
