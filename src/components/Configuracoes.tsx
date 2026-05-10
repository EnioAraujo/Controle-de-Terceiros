import type { Registro, Opcoes } from "@/types/attendance";
import type { WhatsAppTemplate } from "@/lib/format-utils";
import type { TurnoCapacidade } from "@/lib/fechamento-utils";
import type { HierarquiaApi } from "@/hooks/useHierarquia";
import { useI18n } from "@/hooks/use-i18n";
import { BlockHeader } from "@/components/atoms";
import { ConfigOpcoesSection } from "@/components/configuracoes/ConfigOpcoesSection";
import { ConfigHierarquiaSection } from "@/components/configuracoes/ConfigHierarquiaSection";
import { ConfigPessoasSection } from "@/components/configuracoes/ConfigPessoasSection";
import { ConfigTurnosDiariasSection } from "@/components/configuracoes/ConfigTurnosDiariasSection";
import { ConfigCapacidadeSection } from "@/components/configuracoes/ConfigCapacidadeSection";
import { ConfigWhatsAppSection } from "@/components/configuracoes/ConfigWhatsAppSection";
import { ConfigLgpdSection } from "@/components/configuracoes/ConfigLgpdSection";

export { OPCOES_CONFIG } from "@/types/attendance";

interface ConfiguracoesProps {
  opcoes: Opcoes;
  setOpcoes: (val: Opcoes) => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  isAdmin: boolean;
  isAdminOrMod: boolean;
  setWaTemplate: (t: WhatsAppTemplate) => void;
  capacidadeConfig: TurnoCapacidade[];
  setCapacidadeConfig: (val: TurnoCapacidade[]) => void;
  hierarquiaApi: HierarquiaApi;
}

export const Configuracoes = ({
  opcoes,
  setOpcoes,
  registros,
  setRegistros,
  isAdmin,
  isAdminOrMod,
  setWaTemplate,
  capacidadeConfig,
  setCapacidadeConfig,
  hierarquiaApi,
}: ConfiguracoesProps) => {
  const { t } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <BlockHeader section={t("cfg_section")} title={t("cfg_title")} />
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{t("cfg_desc")}</div>
      </div>

      <ConfigHierarquiaSection
        hierarquia={hierarquiaApi.hierarquia}
        api={hierarquiaApi}
        isAdminOrMod={isAdminOrMod}
      />
      <ConfigPessoasSection
        pessoas={hierarquiaApi.hierarquia.pessoas}
        cargos={opcoes.cargos}
        fornecedores={opcoes.fornecedores}
        api={hierarquiaApi}
        isAdminOrMod={isAdminOrMod}
      />
      <ConfigOpcoesSection
        opcoes={opcoes}
        setOpcoes={setOpcoes}
        registros={registros}
        setRegistros={setRegistros}
        isAdminOrMod={isAdminOrMod}
      />
      <ConfigTurnosDiariasSection
        fornecedores={opcoes.fornecedores}
        turnos={opcoes.turnos}
        isAdminOrMod={isAdminOrMod}
      />
      <ConfigCapacidadeSection
        turnos={opcoes.turnos}
        capacidadeConfig={capacidadeConfig}
        setCapacidadeConfig={setCapacidadeConfig}
        isAdmin={isAdmin}
      />
      <ConfigWhatsAppSection
        setWaTemplate={setWaTemplate}
        isAdminOrMod={isAdminOrMod}
      />
      <ConfigLgpdSection
        registros={registros}
        setRegistros={setRegistros}
        isAdmin={isAdmin}
      />
    </div>
  );
};
