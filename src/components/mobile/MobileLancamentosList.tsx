import { Registro } from "@/types/attendance";
import { MobileLancamentoCard } from "./MobileLancamentoCard";

interface Props {
  loading: boolean;
  filtered: Registro[];
  totalCount: number;
  grupos: (Registro | Registro[])[];
  selectedIds: string[];
  onBulkDelete: () => void;
  onSelectItem: (item: Registro | Registro[]) => void;
  isChecked: (item: Registro | Registro[]) => boolean;
  toggleCheck: (item: Registro | Registro[], checked: boolean) => void;
  fornecedores: string[];
  lang: string;
}

export function MobileLancamentosList({
  loading, filtered, totalCount, grupos,
  selectedIds, onBulkDelete, onSelectItem,
  isChecked, toggleCheck, fornecedores, lang,
}: Props) {
  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 14 }}>Carregando...</div>;
  }

  return (
    <>
      <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 12, paddingLeft: 2 }}>
        Exibindo {filtered.length} de {totalCount} registros
      </div>

      {selectedIds.length > 0 && (
        <div style={{
          background: "#FDE8E8", borderRadius: 10,
          padding: "12px 14px", marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>
            {selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onBulkDelete}
            style={{
              background: "#E02424", border: "none", borderRadius: 8,
              padding: "8px 14px", color: "#fff", fontWeight: 700,
              fontSize: 13, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            Excluir selecionados
          </button>
        </div>
      )}

      {grupos.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "#fff", borderRadius: 12,
          border: "1px solid #E2E6EC",
          color: "#94A3B8", fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="4" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          Nenhum registro encontrado.
        </div>
      ) : (
        grupos.map(item => (
          <MobileLancamentoCard
            key={Array.isArray(item) ? item[0].loteId || item[0].id : item.id}
            item={item}
            checked={isChecked(item)}
            onCheck={checked => toggleCheck(item, checked)}
            onTap={() => onSelectItem(item)}
            fornecedores={fornecedores}
            lang={lang}
          />
        ))
      )}
    </>
  );
}
