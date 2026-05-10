import { Icon } from "@/components/atoms";

export type ActivityItem = {
  id: string;
  label: string;
  icon: string;
};

type ActivityBarProps = {
  items: ActivityItem[];
  activeId: string;
  onOpen: (id: string) => void;
  brandImageSrc: string;
  brandImageAlt: string;
  isAdmin?: boolean;
  onAdmin?: () => void;
  onMobile?: () => void;
  onBack?: () => void;
  onLogout?: () => void;
  adminLabel?: string;
  mobileLabel?: string;
  backLabel?: string;
  logoutLabel?: string;
};

const BTN_BASE: React.CSSProperties = {
  position: "relative",
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  cursor: "pointer",
  color: "#9898B0",
  padding: 0,
};

export function ActivityBar({
  items, activeId, onOpen,
  brandImageSrc, brandImageAlt,
  isAdmin, onAdmin, onMobile, onBack, onLogout,
  adminLabel = "Admin", mobileLabel = "Mobile", backLabel = "Voltar", logoutLabel = "Sair",
}: ActivityBarProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#212B36",
        borderRight: "1px solid #2E3B4A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 4,
      }}
    >
      <div style={{ width: 34, height: 34, marginBottom: 6 }}>
        <img src={brandImageSrc} alt={brandImageAlt} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
      </div>

      {items.map(it => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            title={it.label}
            onClick={() => onOpen(it.id)}
            style={{ ...BTN_BASE, color: active ? "#FFFFFF" : "#9898B0" }}
          >
            {active && (
              <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, background: "#F37E38", borderRadius: 2 }} />
            )}
            <Icon d={it.icon} size={18} />
          </button>
        );
      })}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {isAdmin && onAdmin && (
          <button title={adminLabel} onClick={onAdmin} style={{ ...BTN_BASE, color: "#F37E38" }}>
            <img src="/admin.png" width={18} height={18} alt="" style={{ borderRadius: 4 }} />
          </button>
        )}
        {onMobile && (
          <button title={mobileLabel} onClick={onMobile} style={BTN_BASE}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          </button>
        )}
        {onBack && (
          <button title={backLabel} onClick={onBack} style={BTN_BASE}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}
        {onLogout && (
          <button title={logoutLabel} onClick={onLogout} style={{ ...BTN_BASE, color: "#EF4444" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
