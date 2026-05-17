import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function MobileFormModal({ title, onClose, children }: Props) {
  return (
    <>
      <style>{`
        .mobile-form-worker-outer {
          min-width: unset !important;
          overflow: visible !important;
        }
        .mobile-form-worker-header {
          display: none !important;
        }
        .mobile-form-worker-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr 1fr !important;
          gap: 8px !important;
          padding: 10px 12px !important;
          border-radius: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .mobile-form-worker-grid > div:first-child {
          grid-column: 1 / -1 !important;
          font-size: 11px !important;
          color: #94A3B8 !important;
          text-align: left !important;
          font-weight: 700 !important;
        }
        .mobile-form-worker-grid > select {
          grid-column: 1 / -1 !important;
          width: 100% !important;
          font-size: 15px !important;
          padding: 10px 12px !important;
          border-radius: 8px !important;
          border: 1.5px solid #E2E6EC !important;
          background: #FAFBFC !important;
          box-sizing: border-box !important;
        }
        .mobile-form-worker-grid > div:not(:first-child):not(:last-child) {
          grid-column: 1 / -1 !important;
          width: 100% !important;
          min-width: 0 !important;
        }
        .mobile-form-worker-grid > div:not(:first-child):not(:last-child) > div {
          width: 100% !important;
        }
        .mobile-form-worker-grid > div:not(:first-child):not(:last-child) input {
          width: 100% !important;
          font-size: 15px !important;
          padding: 11px 12px !important;
        }
        .mobile-form-worker-grid > input[type="time"] {
          width: 100% !important;
          font-size: 14px !important;
          padding: 10px 4px !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
          text-align: center !important;
        }
        .mobile-form-worker-grid > div:last-child {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 13px !important;
        }
        .mobile-form-worker-obs {
          padding: 0 12px 10px !important;
        }
        .mobile-form-worker-obs__spacer {
          display: none !important;
        }
        .mobile-form-worker-obs > input {
          width: 100% !important;
          font-size: 14px !important;
          padding: 10px 12px !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
        }
      `}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,18,35,0.6)", backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 401,
        background: "#FAF9FB", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: "#212B36", borderBottom: "1px solid #2E3B4A",
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 1,
        }}>
          <button onClick={onClose} style={{
            width: 36, height: 36, border: "none",
            background: "rgba(255,255,255,0.1)", borderRadius: 8,
            cursor: "pointer", color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{title}</span>
        </div>
        <div style={{ padding: "16px", flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  );
}
