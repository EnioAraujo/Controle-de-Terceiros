import { Icon } from "@/components/atoms";

export type TabBarItem = {
  id: string;
  label: string;
  icon: string;
};

type TabBarProps = {
  tabs: TabBarItem[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  closable?: boolean;
};

export function TabBar({ tabs, activeId, onActivate, onClose, closable = true }: TabBarProps) {
  const canClose = closable && tabs.length > 1;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#1A2430",
        borderBottom: "1px solid #2E3B4A",
        display: "flex",
        alignItems: "stretch",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      {tabs.map(t => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              minWidth: 120,
              maxWidth: 200,
              cursor: "pointer",
              background: active ? "#212B36" : "transparent",
              borderRight: "1px solid #2E3B4A",
              borderBottom: active ? "2px solid #F37E38" : "2px solid transparent",
              color: active ? "#FFFFFF" : "#9898B0",
              fontSize: 12,
              fontFamily: "'Inter',var(--font-body)",
              fontWeight: 500,
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
            onClick={() => onActivate(t.id)}
          >
            <Icon d={t.icon} size={13} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.label}</span>
            {canClose && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
                title="Fechar"
                style={{
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "transparent", color: "inherit", cursor: "pointer",
                  borderRadius: 4, padding: 0, opacity: 0.7,
                }}
              >
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
