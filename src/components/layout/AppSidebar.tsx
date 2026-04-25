import { ReactNode } from "react";
import { Icon } from "@/components/atoms";

export type AppSidebarItem = {
  id: string;
  label: string;
  icon: string;
};

type AppSidebarProps = {
  items: AppSidebarItem[];
  activeItemId: string;
  onItemClick: (id: string) => void;
  brandImageSrc: string;
  brandImageAlt: string;
  footer?: ReactNode;
};

export function AppSidebar({
  items,
  activeItemId,
  onItemClick,
  brandImageSrc,
  brandImageAlt,
  footer,
}: AppSidebarProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#212B36",
        borderRight: "1px solid #2E3B4A",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", borderBottom: "1px solid #2E3B4A" }}>
        <img src={brandImageSrc} alt={brandImageAlt} style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} />
        <div>
          <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 14, letterSpacing: -0.4, lineHeight: 1.1 }}>Controle de</div>
          <div style={{ color: "#F37E38", fontWeight: 800, fontSize: 14, letterSpacing: -0.4, lineHeight: 1.1 }}>Terceiros</div>
        </div>
      </div>

      <nav style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => {
          const isActive = item.id === activeItemId;

          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 600,
                fontSize: 13,
                background: isActive ? "#F37E38" : "rgba(255,255,255,0.04)",
                color: isActive ? "#FFFFFF" : "#98A2B3",
              }}
            >
              <Icon d={item.icon} size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: 12, borderTop: "1px solid #2E3B4A" }}>{footer}</div>
    </div>
  );
}
