import type { Pessoa } from "@/types/hierarquia";

export interface PessoaEditState {
  id: number;
  nome: string;
  cargo: string;
}

interface Props {
  pessoa: Pessoa;
  cargos: string[];
  editing: PessoaEditState | null;
  busy: boolean;
  onEditStart: (p: Pessoa) => void;
  onEditChange: (next: PessoaEditState) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onDeleteAsk: (p: Pessoa) => void;
}

const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  outline: "none",
  width: "100%",
};

const btnPrimary: React.CSSProperties = {
  padding: "6px 12px",
  background: "#212B36",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export function PessoaTableRow({
  pessoa: p,
  cargos,
  editing,
  busy,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  onDeleteAsk,
}: Props) {
  const isEditing = editing?.id === p.id;
  return (
    <tr style={{ borderTop: "1px solid #F3F4F6" }}>
      <td style={{ padding: "8px 12px", color: "#212B36" }}>
        {isEditing ? (
          <input style={input} value={editing!.nome} onChange={e => onEditChange({ ...editing!, nome: e.target.value })} />
        ) : p.nome}
      </td>
      <td style={{ padding: "8px 12px", color: "#212B36" }}>
        {isEditing ? (
          <select style={input} value={editing!.cargo} onChange={e => onEditChange({ ...editing!, cargo: e.target.value })}>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : p.cargo}
      </td>
      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
        {isEditing ? (
          <>
            <button type="button" style={{ ...btnGhost, marginRight: 6 }} onClick={onEditCancel} disabled={busy}>Cancelar</button>
            <button type="button" style={btnPrimary} onClick={onEditSave} disabled={busy}>Salvar</button>
          </>
        ) : (
          <>
            <button type="button" style={{ ...btnGhost, marginRight: 6 }} onClick={() => onEditStart(p)}>Editar</button>
            <button type="button" style={{ ...btnGhost, color: "#EF4444", borderColor: "#FCA5A5" }} onClick={() => onDeleteAsk(p)}>Excluir</button>
          </>
        )}
      </td>
    </tr>
  );
}
