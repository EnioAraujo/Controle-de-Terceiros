import { useQueryClient } from "@tanstack/react-query";
import { useOpcoes } from "@/hooks/useOpcoes";
import { CriarUsuarioFornecedorForm } from "./CriarUsuarioFornecedorForm";
import { AtribuirFornecedorList } from "./AtribuirFornecedorList";

export function AdminFornecedoresTab() {
  const [opcoes] = useOpcoes();
  const qc = useQueryClient();
  const fornecedores = (opcoes.fornecedores ?? []).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ["admin-fornecedor-list"] });
    qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
  };

  if (fornecedores.length === 0) {
    return (
      <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: 16, color: "#92400E", fontSize: 13 }}>
        Nenhum fornecedor cadastrado em <strong>opcoes.fornecedores</strong>. Cadastre antes de atribuir.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <CriarUsuarioFornecedorForm fornecedores={fornecedores} onCreated={handleCreated} />
      <AtribuirFornecedorList fornecedores={fornecedores} />
    </div>
  );
}
