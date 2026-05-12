import { ReactNode } from "react";
import { useAuthStatus } from "@/hooks/useAuthStatus";

interface Props {
  fornecedor: string;
  children: ReactNode;
}

export function FornecedorShell({ fornecedor, children }: Props) {
  const { signOut } = useAuthStatus();

  return (
    <div style={{ minHeight: "100vh", background: "#FAF9FB", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
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
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
