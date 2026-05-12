import { FornecedorShell } from "@/components/layout/FornecedorShell";
import { ContadorPessoas } from "@/components/fornecedor/ContadorPessoas";
import { ImportPessoasSection } from "@/components/fornecedor/ImportPessoasSection";
import { CrudPessoasSection } from "@/components/fornecedor/CrudPessoasSection";
import { FornecedorErrorBanner } from "@/components/fornecedor/FornecedorErrorBanner";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";
import { useTerceirosDoFornecedor } from "@/hooks/useTerceirosDoFornecedor";
import { useOpcoes } from "@/hooks/useOpcoes";

export default function FornecedorPage() {
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const { pessoas, loading: pessoasLoading, error: pessoasError, retry: retryPessoas, addPessoa, updatePessoa, deletePessoa, upsertMany } =
    useTerceirosDoFornecedor();
  const [opcoes, , , opcoesError] = useOpcoes();
  const erroCarga = pessoasError ?? opcoesError;

  const cargos = (opcoes.cargos ?? []).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (fornLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9FB", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <span style={{ fontSize: 14, color: "#64748B" }}>Carregando…</span>
      </div>
    );
  }

  // Admin acessando sem fornecedor próprio: mostra aviso (admin pode entrar em qualquer rota).
  if (!isFornecedorUser || !fornecedor) {
    return (
      <FornecedorShell fornecedor="—">
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: 20, color: "#92400E", fontSize: 14 }}>
          Você está acessando esta página como administrador. Para gerenciar funcionários, faça login com um usuário vinculado a um fornecedor.
        </div>
      </FornecedorShell>
    );
  }

  return (
    <FornecedorShell fornecedor={fornecedor}>
      <div style={{ display: "grid", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {erroCarga && (
          <FornecedorErrorBanner mensagem={erroCarga} onRetry={retryPessoas} />
        )}
        <ContadorPessoas pessoas={pessoas} />
        <ImportPessoasSection cargosValidos={cargos} onConfirm={upsertMany} />
        <CrudPessoasSection
          pessoas={pessoas}
          cargos={cargos}
          onAdd={addPessoa}
          onUpdate={updatePessoa}
          onDelete={deletePessoa}
        />
        {pessoasLoading && (
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>Sincronizando…</p>
        )}
      </div>
    </FornecedorShell>
  );
}
