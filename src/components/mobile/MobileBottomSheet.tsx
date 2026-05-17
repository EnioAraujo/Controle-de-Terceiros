import { Registro } from "@/types/attendance";

const SheetBtn = ({ icon, label, color, bg, onClick }: {
  icon: string; label: string; color: string; bg: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      width: "100%", display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", border: "none", borderRadius: 12,
      background: bg, color, fontWeight: 700, fontSize: 15,
      fontFamily: "inherit", cursor: "pointer", marginBottom: 8,
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    {label}
  </button>
);

interface Props {
  item: Registro | Registro[] | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWhatsApp: () => void;
}

export function MobileBottomSheet({ item, onClose, onEdit, onDelete, onWhatsApp }: Props) {
  if (!item) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)" }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "20px 20px 36px",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
      }}>
        <div style={{ width: 40, height: 4, background: "#E2E6EC", borderRadius: 2, margin: "0 auto 20px" }} />
        <SheetBtn icon="✏️" label="Editar"           color="#1A56DB" bg="#EBF0FD" onClick={onEdit} />
        <SheetBtn icon="🗑️" label="Excluir"          color="#E02424" bg="#FDE8E8" onClick={onDelete} />
        <SheetBtn icon="💬" label="Enviar WhatsApp" color="#0E9F6E" bg="#ECFDF5" onClick={onWhatsApp} />
      </div>
    </>
  );
}
