interface Props {
  onClick: () => void;
}

export function MobileFab({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed", bottom: 88, right: 20, zIndex: 150,
        width: 56, height: 56, borderRadius: 99,
        background: "#F37E38", border: "none",
        boxShadow: "0 4px 16px rgba(243,126,56,0.45)",
        cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#fff",
      }}
      aria-label="Novo lançamento"
    >
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
