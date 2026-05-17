interface Props {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MobileConfirmDialog({ count, onConfirm, onCancel }: Props) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 301,
        transform: "translate(-50%,-50%)",
        background: "#fff", borderRadius: 16, padding: 24,
        width: "calc(100% - 48px)", maxWidth: 340,
        boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#0F1C2E", marginBottom: 8 }}>
          Confirmar exclusão
        </div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 20, lineHeight: 1.5 }}>
          Excluir {count} registro{count !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px", border: "1px solid #E2E6EC",
            borderRadius: 10, background: "#fff", cursor: "pointer",
            fontWeight: 600, fontSize: 14, fontFamily: "inherit", color: "#475569",
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px", border: "none",
            borderRadius: 10, background: "#E02424", cursor: "pointer",
            fontWeight: 700, fontSize: 14, fontFamily: "inherit", color: "#fff",
          }}>Excluir</button>
        </div>
      </div>
    </>
  );
}
