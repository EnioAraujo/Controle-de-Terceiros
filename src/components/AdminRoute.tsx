import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "allowed" | "denied";

/**
 * Route guard declarativo para /admin.
 * Chama rpc('is_admin') (SECURITY DEFINER) e bloqueia acesso se o resultado
 * for falso ou se ocorrer qualquer erro (fail-closed).
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data, error }) => {
      setStatus(error || !data ? "denied" : "allowed");
    });
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)" }}>
        <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>Verificando permissões…</div>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
