import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export interface FornecedorShellTab {
  label: string;
  to: string;
}

interface Props {
  fornecedor: string;
  children: ReactNode;
  tabs?: FornecedorShellTab[];
}

export function FornecedorShell({ fornecedor, children, tabs }: Props) {
  const { signOut } = useAuthStatus();

  return (
    <div style={{ minHeight: "100vh", background: "#FAF9FB", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "#212B36",
          borderBottom: "1px solid #2E3B4A",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#F37E38",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
            }}
            aria-hidden
          >
            {fornecedor.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 2 }}>
              Fornecedor
            </p>
            <p
              style={{ fontSize: 14, color: "#F8FAFC", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              title={fornecedor}
            >
              {fornecedor}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          style={{
            background: "transparent",
            border: "1px solid #2E3B4A",
            borderRadius: 8,
            padding: "6px 14px",
            color: "#EF4444",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Sair
        </button>
      </header>
      {tabs && tabs.length > 0 && (
        <nav
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid #E5E7EB",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            overflowX: "auto",
          }}
          aria-label="Navegação do fornecedor"
        >
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              style={({ isActive }) => ({
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: isActive ? "#F37E38" : "#6B7280",
                borderBottom: `2px solid ${isActive ? "#F37E38" : "transparent"}`,
                textDecoration: "none",
                whiteSpace: "nowrap",
              })}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
