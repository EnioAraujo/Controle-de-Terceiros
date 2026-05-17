import { Navigate } from "react-router-dom";
import { useUserScope } from "@/hooks/useUserScope";

const Loading = () => (
  <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)" }}>
    <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>Verificando permissões…</div>
  </div>
);

function fornecedorTarget(): string {
  return sessionStorage.getItem("deviceMode") === "mobile" ? "/fornecedor/mobile" : "/fornecedor";
}

/**
 * Usado em rotas internas (/, /mobile, /admin): se o usuário for
 * fornecedor (e NÃO admin), redireciona para a página dedicada.
 * Admin atravessa livremente — admin tem acesso pleno a qualquer rota.
 */
export function RedirectFornecedor({ children }: { children: React.ReactNode }) {
  const { isAdmin, isFornecedorUser, loading } = useUserScope();
  if (loading) return <Loading />;
  if (isFornecedorUser && !isAdmin) {
    return <Navigate to={fornecedorTarget()} replace />;
  }
  return <>{children}</>;
}

/**
 * Usado em /fornecedor e /fornecedor/mobile: libera passagem
 * para fornecedor OU admin. Usuário interno comum vai para /.
 */
export function FornecedorRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isFornecedorUser, loading } = useUserScope();
  if (loading) return <Loading />;
  if (!isAdmin && !isFornecedorUser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
