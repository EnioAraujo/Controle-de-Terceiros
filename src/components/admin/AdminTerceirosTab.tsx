import { useState } from "react";
import { ContadorPessoas } from "@/components/fornecedor/ContadorPessoas";
import { CrudPessoasSection } from "@/components/fornecedor/CrudPessoasSection";
import { ImportPessoasSection } from "@/components/fornecedor/ImportPessoasSection";
import { FornecedorErrorBanner } from "@/components/fornecedor/FornecedorErrorBanner";
import { useTerceirosDoFornecedor } from "@/hooks/useTerceirosDoFornecedor";
import { useOpcoes } from "@/hooks/useOpcoes";

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  outline: "none",
};

export function AdminTerceirosTab() {
  const [opcoes, , opcoesLoading, opcoesError] = useOpcoes();
  const [selected, setSelected] = useState<string>("");

  const fornecedores = (opcoes.fornecedores ?? [])
    .slice()
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cargos = (opcoes.cargos ?? [])
    .slice()
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const fornecedorAtivo = selected || undefined;
  const {
    pessoas,
    loading: pessoasLoading,
    error: pessoasError,
    retry: retryPessoas,
    addPessoa,
    updatePessoa,
    deletePessoa,
    upsertMany,
  } = useTerceirosDoFornecedor(fornecedorAtivo);

  const erro = pessoasError ?? opcoesError;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={card}>
        <p style={{ fontSize: 11, color: "#9898B0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>
          Fornecedor
        </p>
        <select
          style={{ ...input, minWidth: 260 }}
          value={selected}
          onChange={e => setSelected(e.target.value)}
          disabled={opcoesLoading}
        >
          <option value="">— Selecione um fornecedor —</option>
          {fornecedores.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {!selected ? (
        <div style={{ ...card, color: "#6B7280", fontSize: 13 }}>
          Selecione um fornecedor para gerenciar seus terceiros.
        </div>
      ) : (
        <>
          {erro && (
            <FornecedorErrorBanner mensagem={erro} onRetry={retryPessoas} />
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
        </>
      )}
    </div>
  );
}
