import { useCallback, useState } from "react";
import { FornecedorShell, type FornecedorShellTab } from "@/components/layout/FornecedorShell";
import { ResumoAcumuladoFilters } from "@/components/fornecedor/ResumoAcumuladoFilters";
import { ResumoAcumuladoTable } from "@/components/fornecedor/ResumoAcumuladoTable";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";
import { useResumoAcumulado } from "@/hooks/useResumoAcumulado";

const tabs: FornecedorShellTab[] = [
  { label: "Funcionários", to: "/fornecedor" },
  { label: "Resumo", to: "/fornecedor/resumo" },
];

export default function ResumoAcumuladoPage() {
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string }>({ inicio: "", fim: "" });
  const onChangePeriodo = useCallback((inicio: string, fim: string) => {
    setPeriodo({ inicio, fim });
  }, []);

  const { resumo, total, loading, error, reload } = useResumoAcumulado(
    fornecedor,
    periodo.inicio,
    periodo.fim,
  );

  if (fornLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9FB", fontFamily: "var(--font-body)" }}>
        <span style={{ fontSize: 14, color: "#64748B" }}>Carregando…</span>
      </div>
    );
  }

  if (!isFornecedorUser || !fornecedor) {
    return (
      <FornecedorShell fornecedor="—" tabs={tabs}>
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: 20, color: "#92400E", fontSize: 14 }}>
          Você está acessando esta página como administrador. Para visualizar o resumo, faça login com um usuário vinculado a um fornecedor.
        </div>
      </FornecedorShell>
    );
  }

  return (
    <FornecedorShell fornecedor={fornecedor} tabs={tabs}>
      <div style={{ display: "grid", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        <ResumoAcumuladoFilters onChange={onChangePeriodo} />
        <ResumoAcumuladoTable
          resumo={resumo}
          total={total}
          loading={loading}
          error={error}
          onRetry={reload}
        />
      </div>
    </FornecedorShell>
  );
}
